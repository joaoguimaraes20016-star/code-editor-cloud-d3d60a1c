import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle, AlertCircle, Clock, Phone, TrendingUp, Download } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SetterEODReportProps {
  teamId: string;
  userId: string;
  userName: string;
  date: Date;
  compact?: boolean;
}

export function SetterEODReport({ teamId, userId, userName, date, compact = false }: SetterEODReportProps) {
  const [loading, setLoading] = useState(true);
  const [appointmentsBooked, setAppointmentsBooked] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`setter-eod-${userId}-${date.getTime()}`)
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

      // Load appointments booked today
      const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .eq('setter_id', userId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      // Load confirmations completed today
      const { data: tasks } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString());

      // Load overdue tasks
      const { data: overdue } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('assigned_to', userId)
        .eq('status', 'pending')
        .lt('appointment.start_at_utc', new Date().toISOString());

      // Load last activity
      const { data: activity } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setAppointmentsBooked(appts || []);
      setConfirmations(tasks || []);
      setOverdueTasks(overdue || []);
      setLastActivity(activity ? new Date(activity.created_at) : null);
    } catch (error) {
      console.error('Error loading setter EOD data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityStatus = () => {
    if (!lastActivity) return { color: 'bg-muted', text: 'No Activity', icon: '⚪' };
    const hoursSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 2) return { color: 'bg-success', text: 'Active', icon: '🟢' };
    if (hoursSince < 4) return { color: 'bg-warning', text: 'Idle', icon: '🟡' };
    return { color: 'bg-destructive', text: 'Inactive', icon: '🔴' };
  };

  const exportToCSV = () => {
    const data = [
      ['Setter EOD Report', userName, format(date, 'MMM dd, yyyy')],
      [],
      ['Appointments Booked'],
      ['Lead Name', 'Email', 'Time', 'Event Type', 'Status'],
      ...appointmentsBooked.map(apt => [
        apt.lead_name,
        apt.lead_email,
        format(new Date(apt.start_at_utc), 'h:mm a'),
        apt.event_type_name || '',
        apt.status
      ]),
      [],
      ['Confirmations Completed'],
      ['Lead Name', 'Confirmation Time'],
      ...confirmations.map(task => [
        task.appointment?.lead_name || '',
        format(new Date(task.completed_at), 'h:mm a')
      ])
    ];

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userName}_EOD_${format(date, 'yyyy-MM-dd')}.csv`;
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
        {/* Appointments Booked */}
        <div className="space-y-2">
          <div 
            className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded-lg transition-colors"
            onClick={() => setExpandedSection(expandedSection === 'booked' ? null : 'booked')}
          >
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium">Appointments Booked</span>
            </div>
            <Badge variant="default" className="bg-primary">
              {appointmentsBooked.length}
            </Badge>
          </div>
          {(expandedSection === 'booked' || compact === false) && appointmentsBooked.slice(0, compact ? 3 : undefined).map(apt => (
            <div key={apt.id} className="ml-6 p-3 bg-accent/20 rounded-lg border border-border space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{apt.lead_name}</p>
                <Badge variant="secondary">{apt.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(apt.start_at_utc), 'MMM dd, h:mm a')}
                {apt.event_type_name && ` • ${apt.event_type_name}`}
              </div>
            </div>
          ))}
          {compact && appointmentsBooked.length > 3 && expandedSection !== 'booked' && (
            <Button variant="ghost" size="sm" className="ml-6 w-full" onClick={() => setExpandedSection('booked')}>
              Show all {appointmentsBooked.length} appointments
            </Button>
          )}
        </div>

        {/* Confirmations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-success/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="font-medium">Confirmations</span>
            </div>
            <Badge variant="success">{confirmations.length}</Badge>
          </div>
        </div>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="space-y-2">
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-destructive/10 p-2 rounded-lg transition-colors border border-destructive"
              onClick={() => setExpandedSection(expandedSection === 'overdue' ? null : 'overdue')}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Overdue Tasks</span>
              </div>
              <Badge variant="destructive">{overdueTasks.length}</Badge>
            </div>
            {(expandedSection === 'overdue' || !compact) && overdueTasks.map(task => (
              <div key={task.id} className="ml-6 p-3 bg-destructive/5 rounded-lg border border-destructive space-y-1">
                <p className="font-medium">{task.appointment?.lead_name}</p>
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <Clock className="h-3 w-3" />
                  Overdue by {formatDistanceToNow(new Date(task.appointment?.start_at_utc))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {!compact && (
          <div className="pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{appointmentsBooked.length}</p>
              <p className="text-xs text-muted-foreground">Booked</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{confirmations.length}</p>
              <p className="text-xs text-muted-foreground">Confirmed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
