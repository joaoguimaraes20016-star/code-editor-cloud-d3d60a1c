import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, AlertCircle, Clock, ArrowRight, Download, CheckCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface CloserEODReportProps {
  teamId: string;
  userId: string;
  userName: string;
  date: Date;
}

export function CloserEODReport({ teamId, userId, userName, date }: CloserEODReportProps) {
  const [loading, setLoading] = useState(true);
  const [dealsClosed, setDealsClosed] = useState<any[]>([]);
  const [depositsCollected, setDepositsCollected] = useState<any[]>([]);
  const [pipelineActivity, setPipelineActivity] = useState<any[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<any[]>([]);
  const [mrrTasksCompleted, setMrrTasksCompleted] = useState<any[]>([]);
  const [confirmTasksCompleted, setConfirmTasksCompleted] = useState<any[]>([]);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

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

      // Load MRR follow-up tasks completed today
      const { data: mrrTasks } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*, mrr_schedule:mrr_schedules(*, appointment:appointments(*))')
        .eq('completed_by', userId)
        .eq('status', 'confirmed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .order('completed_at', { ascending: false });

      // Load confirmation tasks completed (if closer also does confirmations)
      const { data: confirmTasks } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .order('completed_at', { ascending: false });

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
      setMrrTasksCompleted(mrrTasks || []);
      setConfirmTasksCompleted(confirmTasks || []);
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
      ['Pipeline Moves', pipelineActivity.length.toString()],
      ['MRR Tasks', mrrTasksCompleted.length.toString()],
      ['Confirmation Tasks', confirmTasksCompleted.length.toString()]
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{userName}</CardTitle>
            <p className="text-sm text-muted-foreground">{format(date, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={activityStatus.color === 'bg-success' ? 'default' : activityStatus.color === 'bg-warning' ? 'secondary' : 'outline'}>
              {activityStatus.text}
            </Badge>
            <Button size="sm" variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-5 w-5 text-success mx-auto mb-2" />
                <p className="text-3xl font-bold text-success">{dealsClosed.length}</p>
                <p className="text-sm text-muted-foreground">Closed</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold text-primary">{pipelineActivity.length}</p>
                <p className="text-sm text-muted-foreground">Moves</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-5 w-5 text-accent mx-auto mb-2" />
                <p className="text-xl font-bold text-accent">${totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Revenue</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-5 w-5 text-info mx-auto mb-2" />
                <p className="text-3xl font-bold text-info">{mrrTasksCompleted.length + confirmTasksCompleted.length}</p>
                <p className="text-sm text-muted-foreground">Tasks Done</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn("border-destructive/20", overdueFollowUps.length > 0 ? "bg-destructive/5" : "bg-muted/20")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className={cn("h-5 w-5 mx-auto mb-2", overdueFollowUps.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                <p className={cn("text-3xl font-bold", overdueFollowUps.length > 0 ? "text-destructive" : "text-muted-foreground")}>{overdueFollowUps.length}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ...dealsClosed.map(deal => ({
                  time: new Date(deal.updated_at),
                  type: 'deal_closed',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-success bg-success/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(deal.updated_at), 'h:mm a')}
                      </div>
                      <Badge variant="success" className="shrink-0">💰 Deal Closed</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-lg">{deal.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{deal.lead_email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="default" className="text-base font-bold">
                            ${Number(deal.cc_collected).toLocaleString()}
                          </Badge>
                          {deal.product_name && <Badge variant="secondary">{deal.product_name}</Badge>}
                        </div>
                        <p className="text-sm text-success font-medium mt-1">
                          Your commission: ${(Number(deal.cc_collected) * 0.10).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )
                })),
                ...mrrTasksCompleted.map(task => ({
                  time: new Date(task.completed_at),
                  type: 'mrr_confirmed',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-accent bg-accent/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(task.completed_at), 'h:mm a')}
                      </div>
                      <Badge variant="secondary" className="shrink-0">🔄 MRR Confirmed</Badge>
                      <div className="flex-1">
                        <p className="font-medium">{task.mrr_schedule?.client_name}</p>
                        <p className="text-sm text-muted-foreground">{task.mrr_schedule?.client_email}</p>
                        <p className="text-sm text-accent font-medium mt-1">
                          ${Number(task.mrr_schedule?.mrr_amount || 0).toLocaleString()} MRR payment confirmed
                        </p>
                        {task.notes && <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>}
                      </div>
                    </div>
                  )
                })),
                ...confirmTasksCompleted.map(task => ({
                  time: new Date(task.completed_at),
                  type: 'call_confirmed',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-primary bg-primary/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(task.completed_at), 'h:mm a')}
                      </div>
                      <Badge variant="default" className="shrink-0">✓ Call Confirmed</Badge>
                      <div className="flex-1">
                        <p className="font-medium">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        <Badge variant="outline" className="mt-1">{task.task_type?.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  )
                })),
                ...depositsCollected.map(deposit => ({
                  time: new Date(deposit.created_at),
                  type: 'deposit',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-info bg-info/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(deposit.created_at), 'h:mm a')}
                      </div>
                      <Badge variant="info" className="shrink-0">💳 Deposit Collected</Badge>
                      <div className="flex-1">
                        <p className="font-medium">{deposit.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{deposit.appointment?.lead_email}</p>
                        {deposit.note && <p className="text-sm text-muted-foreground mt-1">{deposit.note}</p>}
                      </div>
                    </div>
                  )
                })),
                ...pipelineActivity.slice(0, 10).map(activity => ({
                  time: new Date(activity.created_at),
                  type: 'pipeline',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-primary bg-muted/20">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(activity.created_at), 'h:mm a')}
                      </div>
                      <Badge variant="outline" className="shrink-0">📊 {activity.action_type}</Badge>
                      <div className="flex-1">
                        {activity.note && <p className="text-sm text-muted-foreground">{activity.note}</p>}
                      </div>
                    </div>
                  )
                })),
                ...overdueFollowUps.map(task => ({
                  time: new Date(),
                  type: 'overdue',
                  content: (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-destructive bg-destructive/5">
                      <div className="text-xs text-destructive min-w-[80px]">OVERDUE</div>
                      <Badge variant="destructive" className="shrink-0">⚠️ Overdue Follow-up</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-destructive">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        <p className="text-xs text-destructive mt-1">
                          Due: {format(new Date(task.follow_up_date), 'MMM dd, yyyy')}
                        </p>
                        {task.follow_up_reason && (
                          <p className="text-xs text-muted-foreground mt-1">{task.follow_up_reason}</p>
                        )}
                      </div>
                    </div>
                  )
                }))
              ]
                .sort((a, b) => b.time.getTime() - a.time.getTime())
                .map((item, idx) => (
                  <div key={idx}>{item.content}</div>
                ))}
              
              {dealsClosed.length === 0 && 
               mrrTasksCompleted.length === 0 && 
               confirmTasksCompleted.length === 0 && 
               depositsCollected.length === 0 && 
               pipelineActivity.length === 0 && 
               overdueFollowUps.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No activity for this date</p>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
