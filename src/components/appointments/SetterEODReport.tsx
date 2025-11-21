import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, AlertCircle, Clock, Phone, TrendingUp, Download, DollarSign, PhoneCall, XCircle, RefreshCw, CalendarIcon } from "lucide-react";
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

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
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "custom">("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`setter-eod-${userId}-${date.getTime()}-${timePeriod}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId, date, timePeriod, customRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      let startDate: Date;
      let endDate: Date;
      
      if (timePeriod === "today") {
        startDate = new Date();
        endDate = new Date();
      } else if (timePeriod === "week") {
        startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
        endDate = endOfWeek(new Date(), { weekStartsOn: 0 });
      } else {
        // custom
        if (!customRange?.from) return;
        startDate = customRange.from;
        endDate = customRange.to || customRange.from;
      }
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Load all data in parallel for much faster performance
      const [
        { data: appts },
        { data: tasks },
        { data: mrr },
        { data: overdue },
        { data: activity },
        { data: noShowLogs }
      ] = await Promise.all([
        // Load appointments booked in period
        supabase
          .from('appointments')
          .select('*')
          .eq('setter_id', userId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
        
        // Load ALL completed confirmation tasks in period
        supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(*)')
          .eq('assigned_to', userId)
          .eq('status', 'completed')
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString())
          .order('completed_at', { ascending: false }),
        
        // Load MRR follow-up tasks completed in period
        supabase
          .from('mrr_follow_up_tasks')
          .select('*, mrr_schedule:mrr_schedules(*)')
          .eq('completed_by', userId)
          .eq('status', 'confirmed')
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString())
          .order('completed_at', { ascending: false }),
        
        // Load overdue tasks
        supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(*)')
          .eq('assigned_to', userId)
          .eq('status', 'pending')
          .lt('appointment.start_at_utc', new Date().toISOString()),
        
        // Load last activity
        supabase
          .from('activity_logs')
          .select('created_at')
          .eq('actor_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Get no-shows from activity logs
        supabase
          .from('activity_logs')
          .select('*')
          .eq('actor_id', userId)
          .eq('action_type', 'No Show')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      ]);

      const allTasks = tasks || [];
      
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

  const activityStatus = getActivityStatus();

  const getPeriodLabel = () => {
    if (timePeriod === "today") {
      return format(new Date(), 'EEEE, MMMM d, yyyy');
    } else if (timePeriod === "week") {
      return `${format(startOfWeek(new Date()), 'MMM d')} - ${format(endOfWeek(new Date()), 'MMM d, yyyy')}`;
    } else if (customRange?.from) {
      if (customRange.to && customRange.to.getTime() !== customRange.from.getTime()) {
        return `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`;
      }
      return format(customRange.from, 'MMMM d, yyyy');
    }
    return 'Select dates';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl font-bold">{userName}</CardTitle>
            <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
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
        
        <div className="flex items-center gap-2">
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as "today" | "week" | "custom")}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="custom">Custom Date</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {timePeriod === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !customRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from ? (
                    customRange.to ? (
                      <>{format(customRange.from, "LLL dd")} - {format(customRange.to, "LLL dd, y")}</>
                    ) : (
                      format(customRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  initialFocus
                  mode="range"
                  defaultMonth={customRange?.from}
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <Phone className="h-6 w-6 text-primary mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-10 w-20 mx-auto mb-2" />
                ) : (
                  <p className="text-4xl font-bold text-primary">{appointmentsBooked.length}</p>
                )}
                <p className="text-sm font-medium text-muted-foreground">
                  {timePeriod === "today" ? "Booked Today" : 
                   timePeriod === "week" ? "Booked This Week" : 
                   customRange?.from ? `Booked ${format(customRange.from, 'M/d/yyyy')}${customRange.to ? ` - ${format(customRange.to, 'M/d/yyyy')}` : ''}` : 
                   'Booked'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From links sent</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-10 w-20 mx-auto mb-2" />
                ) : (
                  <p className="text-4xl font-bold text-success">{callConfirmations.length}</p>
                )}
                <p className="text-sm font-medium text-muted-foreground">
                  {timePeriod === "today" ? "Confirmed Today" : 
                   timePeriod === "week" ? "Confirmed This Week" : 
                   customRange?.from ? `Confirmed ${format(customRange.from, 'M/d/yyyy')}${customRange.to ? ` - ${format(customRange.to, 'M/d/yyyy')}` : ''}` : 
                   'Confirmed'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Call confirmations</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-5 w-5 text-info mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-info">{callConfirmations.length + mrrTasks.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Tasks Done</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-chart-2/5 border-chart-2/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="h-5 w-5 text-chart-2 mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-chart-2">{noShows.length}</p>
                )}
                <p className="text-sm text-muted-foreground">No Shows</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <RefreshCw className="h-5 w-5 text-accent mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-accent">{reschedules.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Rescheduled</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn("border-destructive/20", overdueTasks.length > 0 ? "bg-destructive/5" : "bg-muted/20")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className={cn("h-5 w-5 mx-auto mb-2", overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className={cn("text-3xl font-bold", overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground")}>{overdueTasks.length}</p>
                )}
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
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : appointmentsBooked.length === 0 && callConfirmations.length === 0 && mrrTasks.length === 0 && noShows.length === 0 && reschedules.length === 0 && overdueTasks.length === 0 ? (
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
                          Appointment: {formatDateTimeWithTimezone(new Date(apt.start_at_utc), 'MMM dd, h:mm a')}
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
                            For: {formatDateTimeWithTimezone(new Date(task.appointment.start_at_utc), 'MMM dd, h:mm a')}
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
                        <p className="font-medium">{log.note || 'No Show'}</p>
                        <p className="text-xs text-muted-foreground">
                          Marked as no-show
                        </p>
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
                    <div key={task.id} className="flex items-start gap-3 p-4 rounded-lg border-l-4 border-destructive bg-destructive/5 border border-destructive/20">
                      <div className="text-xs text-destructive font-bold min-w-[80px]">OVERDUE</div>
                      <Badge variant="destructive" className="shrink-0 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Overdue
                      </Badge>
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-destructive text-base">{task.appointment?.lead_name}</p>
                        <p className="text-sm text-muted-foreground">{task.appointment?.lead_email}</p>
                        {task.appointment?.lead_phone && (
                          <p className="text-sm font-medium text-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {task.appointment?.lead_phone}
                          </p>
                        )}
                        {task.appointment?.start_at_utc && (
                          <p className="text-xs text-destructive mt-1">
                            Due: {formatDateTimeWithTimezone(new Date(task.appointment.start_at_utc), 'MMM dd, h:mm a')}
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
