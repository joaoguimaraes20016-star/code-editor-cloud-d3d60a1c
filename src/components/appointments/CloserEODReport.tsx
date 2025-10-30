import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, AlertCircle, Clock, ArrowRight, Download } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface CloserEODReportProps {
  teamId: string;
  userId: string;
  userName: string;
  date: Date;
  compact?: boolean;
}

export function CloserEODReport({ teamId, userId, userName, date, compact = false }: CloserEODReportProps) {
  const [loading, setLoading] = useState(true);
  const [dealsClosed, setDealsClosed] = useState<any[]>([]);
  const [depositsCollected, setDepositsCollected] = useState<any[]>([]);
  const [pipelineActivity, setPipelineActivity] = useState<any[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<any[]>([]);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`closer-eod-${userId}-${date.getTime()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId, date]);

  const loadData = async () => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Load deals closed today
      const { data: closed } = await supabase
        .from('appointments')
        .select('*')
        .eq('closer_id', userId)
        .eq('status', 'CLOSED')
        .gte('updated_at', startOfDay.toISOString())
        .lte('updated_at', endOfDay.toISOString());

      // Load deposits collected today
      const { data: deposits } = await supabase
        .from('activity_logs')
        .select('*, appointment:appointments(*)')
        .eq('actor_id', userId)
        .eq('action_type', 'Deposit Collected')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      // Load pipeline activity
      const { data: pipeline } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('actor_id', userId)
        .in('action_type', ['Stage Changed', 'Note Added', 'Rescheduled'])
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      // Load overdue follow-ups
      const { data: overdue } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('assigned_to', userId)
        .eq('status', 'pending')
        .eq('task_type', 'follow_up')
        .lt('follow_up_date', today.toISOString());

      // Load last activity
      const { data: activity } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDealsClosed(closed || []);
      setDepositsCollected(deposits || []);
      setPipelineActivity(pipeline || []);
      setOverdueFollowUps(overdue || []);
      setLastActivity(activity ? new Date(activity.created_at) : null);
    } catch (error) {
      console.error('Error loading closer EOD data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = dealsClosed.reduce((sum, d) => sum + (Number(d.cc_collected) || 0), 0);
  const totalCommission = totalRevenue * 0.10; // Approximate 10% commission

  const getActivityStatus = () => {
    if (!lastActivity) return { color: 'bg-muted', text: 'No Activity', icon: '⚪' };
    const hoursSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 2) return { color: 'bg-success', text: 'Active', icon: '🟢' };
    if (hoursSince < 4) return { color: 'bg-warning', text: 'Idle', icon: '🟡' };
    return { color: 'bg-destructive', text: 'Inactive', icon: '🔴' };
  };

  const exportToCSV = () => {
    const data = [
      ['Closer EOD Report', userName, format(date, 'MMM dd, yyyy')],
      [],
      ['Deals Closed'],
      ['Lead Name', 'Amount', 'Product', 'Commission'],
      ...dealsClosed.map(deal => [
        deal.lead_name,
        `$${Number(deal.cc_collected).toLocaleString()}`,
        deal.product_name || '',
        `$${(Number(deal.cc_collected) * 0.10).toFixed(2)}`
      ]),
      [],
      ['Summary'],
      ['Total Revenue', `$${totalRevenue.toLocaleString()}`],
      ['Total Commission', `$${totalCommission.toFixed(2)}`],
      ['Deals Closed', dealsClosed.length.toString()],
      ['Pipeline Moves', pipelineActivity.length.toString()]
    ];

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userName}_Closer_EOD_${format(date, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const activityStatus = getActivityStatus();

  return (
    <Card className={cn("transition-all duration-300", compact && "hover:shadow-xl")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-3 w-3 rounded-full animate-pulse", activityStatus.color)} />
            <CardTitle className="text-lg">{userName}</CardTitle>
            <Badge variant="outline">{activityStatus.text}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {lastActivity && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(lastActivity, { addSuffix: true })}
              </span>
            )}
            {!compact && (
              <Button size="sm" variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revenue Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg border border-primary/20">
          <div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Commission Earned</p>
            <p className="text-2xl font-bold text-success">${totalCommission.toFixed(2)}</p>
          </div>
        </div>

        {/* Deals Closed */}
        {dealsClosed.length > 0 && (
          <div className="space-y-2">
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-success/10 p-2 rounded-lg transition-colors"
              onClick={() => setExpandedSection(expandedSection === 'deals' ? null : 'deals')}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="font-medium">Deals Closed</span>
              </div>
              <Badge variant="success">{dealsClosed.length}</Badge>
            </div>
            {(expandedSection === 'deals' || !compact) && dealsClosed.slice(0, compact ? 3 : undefined).map(deal => (
              <div key={deal.id} className="ml-6 p-3 bg-success/5 rounded-lg border border-success/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{deal.lead_name}</p>
                  <Badge variant="success">${Number(deal.cc_collected).toLocaleString()}</Badge>
                </div>
                {deal.product_name && (
                  <p className="text-sm text-muted-foreground">{deal.product_name}</p>
                )}
                <p className="text-xs text-success">Commission: ${(Number(deal.cc_collected) * 0.10).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Activity */}
        {pipelineActivity.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-medium">Pipeline Moves</span>
              </div>
              <Badge variant="default">{pipelineActivity.length}</Badge>
            </div>
            {!compact && pipelineActivity.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="ml-6 p-2 bg-accent/20 rounded text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{activity.action_type}</span>
                  <span className="text-muted-foreground">• {format(new Date(activity.created_at), 'h:mm a')}</span>
                </div>
                {activity.note && <p className="text-muted-foreground">{activity.note}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Overdue Follow-ups */}
        {overdueFollowUps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg border border-destructive bg-destructive/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Overdue Follow-ups</span>
              </div>
              <Badge variant="destructive">{overdueFollowUps.length}</Badge>
            </div>
            {!compact && overdueFollowUps.map(task => (
              <div key={task.id} className="ml-6 p-3 bg-destructive/5 rounded-lg border border-destructive space-y-1">
                <p className="font-medium">{task.appointment?.lead_name}</p>
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <Clock className="h-3 w-3" />
                  Overdue since {format(new Date(task.follow_up_date), 'MMM dd')}
                </div>
                {task.follow_up_reason && (
                  <p className="text-xs text-muted-foreground">{task.follow_up_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {!compact && (
          <div className="pt-4 border-t border-border grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-success">{dealsClosed.length}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{depositsCollected.length}</p>
              <p className="text-xs text-muted-foreground">Deposits</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{pipelineActivity.length}</p>
              <p className="text-xs text-muted-foreground">Moves</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{overdueFollowUps.length}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
