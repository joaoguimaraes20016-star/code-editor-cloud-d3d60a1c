import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle, AlertCircle, Clock, Phone, TrendingUp, Download, DollarSign, PhoneCall, XCircle, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SetterEODReportProps {
  teamId: string;
  userId: string;
  userName: string;
  date: Date;
}

export function SetterEODReport({ teamId, userId, userName, date }: SetterEODReportProps) {
  const [loading, setLoading] = useState(true);
  const [appointmentsBooked, setAppointmentsBooked] = useState<any[]>([]);
  const [callConfirmations, setCallConfirmations] = useState<any[]>([]);
  const [mrrTasks, setMrrTasks] = useState<any[]>([]);
  const [noShows, setNoShows] = useState<any[]>([]);
  const [reschedules, setReschedules] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({ booked: 0, closed: 0 });

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

      // Load ALL completed confirmation tasks today
      const { data: tasks } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .order('completed_at', { ascending: false });

      // Load MRR follow-up tasks completed today
      const { data: mrr } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*, mrr_schedule:mrr_schedules(*, appointment:appointments(*))')
        .eq('completed_by', userId)
        .eq('status', 'confirmed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .order('completed_at', { ascending: false });

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

      // Load monthly stats
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const { data: monthlyBooked } = await supabase
        .from('appointments')
        .select('id, status')
        .eq('setter_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      setMonthlyStats({
        booked: monthlyBooked?.length || 0,
        closed: monthlyBooked?.filter(a => a.status === 'CLOSED').length || 0
      });

      // Separate tasks by type and check for no-shows via activity logs
      const allTasks = tasks || [];
      
      // Get no-shows from activity logs
      const { data: noShowLogs } = await supabase
        .from('activity_logs')
        .select('*, appointment:appointments(*)')
        .eq('actor_id', userId)
        .eq('action_type', 'No Show')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      setAppointmentsBooked(appts || []);
      setCallConfirmations(allTasks.filter(t => t.task_type === 'call_confirmation' && t.completed_at));
      setNoShows(noShowLogs || []);
      setReschedules(allTasks.filter(t => t.task_type === 'reschedule' && t.completed_at));
      setMrrTasks((mrr || []).filter(t => t.completed_at));
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
      ['Confirmations & Tasks Completed'],
      ['Lead Name', 'Task Type', 'Time'],
      ...callConfirmations.map(task => [
        task.appointment?.lead_name || '',
        'Call Confirmation',
        format(new Date(task.completed_at), 'h:mm a')
      ]),
      ...mrrTasks.map(task => [
        task.mrr_schedule?.client_name || '',
        'MRR Confirmation',
        format(new Date(task.completed_at), 'h:mm a')
      ]),
      ...noShows.map(log => [
        log.appointment?.lead_name || '',
        'No Show',
        format(new Date(log.created_at), 'h:mm a')
      ]),
      ...reschedules.map(task => [
        task.appointment?.lead_name || '',
        'Rescheduled',
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
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <Phone className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-4xl font-bold text-primary">{monthlyStats.booked}</p>
                <p className="text-sm font-medium text-muted-foreground">Appointments Booked (Month)</p>
                <p className="text-xs text-muted-foreground mt-1">{appointmentsBooked.length} today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-4xl font-bold text-success">{monthlyStats.closed}</p>
                <p className="text-sm font-medium text-muted-foreground">Deals Closed (Month)</p>
                <p className="text-xs text-muted-foreground mt-1">Commission eligible</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-5 w-5 text-info mx-auto mb-2" />
                <p className="text-3xl font-bold text-info">{callConfirmations.length + mrrTasks.length}</p>
                <p className="text-sm text-muted-foreground">Tasks Done</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-chart-2/5 border-chart-2/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="h-5 w-5 text-chart-2 mx-auto mb-2" />
                <p className="text-3xl font-bold text-chart-2">{noShows.length}</p>
                <p className="text-sm text-muted-foreground">No Shows</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <RefreshCw className="h-5 w-5 text-accent mx-auto mb-2" />
                <p className="text-3xl font-bold text-accent">{reschedules.length}</p>
                <p className="text-sm text-muted-foreground">Rescheduled</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn("border-destructive/20", overdueTasks.length > 0 ? "bg-destructive/5" : "bg-muted/20")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className={cn("h-5 w-5 mx-auto mb-2", overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                <p className={cn("text-3xl font-bold", overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground")}>{overdueTasks.length}</p>
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
              {appointmentsBooked.length === 0 && callConfirmations.length === 0 && mrrTasks.length === 0 && noShows.length === 0 && reschedules.length === 0 && overdueTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity for this date</p>
              ) : (
                <>
                  {/* Appointments Booked */}
                  {appointmentsBooked.map(apt => (
                    <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-primary bg-primary/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(apt.created_at), 'h:mm a')}
                      </div>
                      <Badge variant="default" className="shrink-0 gap-1">
                        <Phone className="h-3 w-3" />
                        Booked
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{apt.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
                        <p className="text-sm text-muted-foreground">{apt.lead_phone || 'No phone'}</p>
                        {apt.event_type_name && <Badge variant="secondary" className="mt-1">{apt.event_type_name}</Badge>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Appointment: {format(new Date(apt.start_at_utc), 'MMM dd, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Call Confirmations */}
                  {callConfirmations.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-success bg-success/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(task.completed_at), 'h:mm a')}
                      </div>
                      <Badge variant="success" className="shrink-0 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Confirmed
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_phone || 'No phone'}</p>
                        {task.appointment?.start_at_utc && (
                          <p className="text-xs text-muted-foreground mt-1">
                            For: {format(new Date(task.appointment.start_at_utc), 'MMM dd, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* MRR Confirmations */}
                  {mrrTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-accent bg-accent/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(task.completed_at), 'h:mm a')}
                      </div>
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <DollarSign className="h-3 w-3" />
                        MRR Confirmed
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{task.mrr_schedule?.client_name}</p>
                        <p className="text-sm text-muted-foreground">{task.mrr_schedule?.client_email}</p>
                        <p className="text-sm text-success font-medium">
                          ${Number(task.mrr_schedule?.mrr_amount || 0).toLocaleString()} MRR
                        </p>
                        {task.notes && <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>}
                      </div>
                    </div>
                  ))}

                  {/* No-Shows */}
                  {noShows.map((log, idx) => (
                    <div key={`noshow-${idx}`} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-chart-2 bg-chart-2/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(log.created_at), 'h:mm a')}
                      </div>
                      <Badge variant="warning" className="shrink-0 gap-1">
                        <XCircle className="h-3 w-3" />
                        No Show
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{log.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{log.appointment?.lead_email}</p>
                        {log.note && <p className="text-xs text-muted-foreground mt-1">{log.note}</p>}
                      </div>
                    </div>
                  ))}

                  {/* Reschedules */}
                  {reschedules.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-info bg-info/5">
                      <div className="text-xs text-muted-foreground min-w-[80px]">
                        {format(new Date(task.completed_at), 'h:mm a')}
                      </div>
                      <Badge variant="info" className="shrink-0 gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Rescheduled
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        {task.reschedule_date && (
                          <p className="text-xs text-info mt-1">
                            New date: {format(new Date(task.reschedule_date), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Overdue Tasks */}
                  {overdueTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-destructive bg-destructive/5">
                      <div className="text-xs text-destructive min-w-[80px]">OVERDUE</div>
                      <Badge variant="destructive" className="shrink-0 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Overdue
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium text-destructive">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        {task.appointment?.start_at_utc && (
                          <p className="text-xs text-destructive mt-1">
                            Due: {format(new Date(task.appointment.start_at_utc), 'MMM dd, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
