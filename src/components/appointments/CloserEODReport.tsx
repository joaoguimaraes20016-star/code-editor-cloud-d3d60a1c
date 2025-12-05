import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, AlertCircle, Clock, ArrowRight, Download, CheckCircle, Phone, PhoneCall, RefreshCw, CreditCard, CalendarIcon } from "lucide-react";
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

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
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "custom">("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`closer-eod-${userId}-${date.getTime()}-${timePeriod}`)
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Load all data in parallel for much faster performance
      const [
        { data: closed },
        { data: deposits },
        { data: pipeline },
        { data: overdue },
        { data: mrrTasks },
        { data: confirmTasks },
        { data: activity }
      ] = await Promise.all([
        // Load deals closed in period
        supabase
          .from('appointments')
          .select('*')
          .eq('closer_id', userId)
          .eq('status', 'CLOSED')
          .gte('updated_at', startDate.toISOString())
          .lte('updated_at', endDate.toISOString()),
        
        // Load deposits collected in period
        supabase
          .from('activity_logs')
          .select('*')
          .eq('actor_id', userId)
          .eq('action_type', 'Deposit Collected')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),
        
        // Load pipeline activity in period
        supabase
          .from('activity_logs')
          .select('*')
          .eq('actor_id', userId)
          .in('action_type', ['Stage Changed', 'Note Added', 'Rescheduled'])
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
        
        // Load overdue follow-ups (only for upcoming appointments) - filtered by team
        supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments!inner(*)')
          .eq('team_id', teamId)
          .eq('assigned_to', userId)
          .eq('status', 'pending')
          .eq('task_type', 'follow_up')
          .lt('due_at', today.toISOString())
          .gte('appointment.start_at_utc', new Date().toISOString())
          .eq('appointment.team_id', teamId),
        
        // Load MRR follow-up tasks completed in period
        supabase
          .from('mrr_follow_up_tasks')
          .select('*, mrr_schedule:mrr_schedules(*)')
          .eq('completed_by', userId)
          .eq('status', 'confirmed')
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString())
          .order('completed_at', { ascending: false }),
        
        // Load confirmation tasks completed in period
        supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(*)')
          .eq('assigned_to', userId)
          .eq('status', 'completed')
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString())
          .order('completed_at', { ascending: false }),
        
        // Load last activity
        supabase
          .from('activity_logs')
          .select('created_at')
          .eq('actor_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      setDealsClosed(closed || []);
      setDepositsCollected(deposits || []);
      setPipelineActivity(pipeline || []);
      setOverdueFollowUps(overdue || []);
      setMrrTasksCompleted((mrrTasks || []).filter(t => t.completed_at));
      setConfirmTasksCompleted((confirmTasks || []).filter(t => t.completed_at));
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
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-6 w-6 text-success mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-10 w-20 mx-auto mb-2" />
                ) : (
                  <p className="text-4xl font-bold text-success">{dealsClosed.length}</p>
                )}
                <p className="text-sm font-medium text-muted-foreground">
                  {timePeriod === "today" ? "Deals Closed Today" : 
                   timePeriod === "week" ? "Deals Closed This Week" : 
                   customRange?.from ? `Deals Closed ${format(customRange.from, 'M/d/yyyy')}${customRange.to ? ` - ${format(customRange.to, 'M/d/yyyy')}` : ''}` : 
                   'Deals Closed'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total closed deals</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-chart-3/5 border-chart-3/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 text-chart-3 mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-10 w-32 mx-auto mb-2" />
                ) : (
                  <p className="text-4xl font-bold text-chart-3">${totalRevenue.toLocaleString()}</p>
                )}
                <p className="text-sm font-medium text-muted-foreground">
                  {timePeriod === "today" ? "Revenue Today" : 
                   timePeriod === "week" ? "Revenue This Week" : 
                   customRange?.from ? `Revenue ${format(customRange.from, 'M/d/yyyy')}${customRange.to ? ` - ${format(customRange.to, 'M/d/yyyy')}` : ''}` : 
                   'Revenue'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total collected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-5 w-5 text-success mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-success">{dealsClosed.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Closed Today</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-chart-1/5 border-chart-1/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-5 w-5 text-chart-1 mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-chart-1">{pipelineActivity.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Pipeline Moves</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-chart-3/5 border-chart-3/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-5 w-5 text-chart-3 mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-6 w-24 mx-auto mb-2" />
                ) : (
                  <p className="text-xl font-bold text-chart-3">${totalRevenue.toLocaleString()}</p>
                )}
                <p className="text-sm text-muted-foreground">Revenue Today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-5 w-5 text-info mx-auto mb-2" />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className="text-3xl font-bold text-info">{mrrTasksCompleted.length + confirmTasksCompleted.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Tasks Done</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn("border-destructive/20", overdueFollowUps.length > 0 ? "bg-destructive/5" : "bg-muted/20")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className={cn("h-5 w-5 mx-auto mb-2", overdueFollowUps.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                {loading ? (
                  <Skeleton className="h-9 w-16 mx-auto mb-2" />
                ) : (
                  <p className={cn("text-3xl font-bold", overdueFollowUps.length > 0 ? "text-destructive" : "text-muted-foreground")}>{overdueFollowUps.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Tasks Details */}
        {overdueFollowUps.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                Overdue Follow-Ups - Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueFollowUps.slice(0, 10).map((task) => {
                  const dueAt = task.due_at ? new Date(task.due_at) : null;
                  const aptTime = task.appointment?.start_at_utc ? new Date(task.appointment.start_at_utc) : null;
                  const hoursOverdue = dueAt ? Math.round((Date.now() - dueAt.getTime()) / (1000 * 60 * 60)) : 0;
                  
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg bg-background/50 border border-destructive/20">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.appointment?.lead_name || 'Unknown Lead'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-destructive border-destructive/30">
                            {hoursOverdue}h overdue
                          </Badge>
                          <span>Due: {dueAt ? format(dueAt, 'MMM d, h:mm a') : 'N/A'}</span>
                        </div>
                        {aptTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Appointment: {format(aptTime, 'MMM d, h:mm a')}
                          </p>
                        )}
                        {task.follow_up_reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reason: {task.follow_up_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {overdueFollowUps.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    + {overdueFollowUps.length - 10} more overdue tasks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                      <Badge variant="success" className="shrink-0 gap-1">
                        <DollarSign className="h-3 w-3" />
                        Deal Closed
                      </Badge>
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
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <RefreshCw className="h-3 w-3" />
                        MRR Confirmed
                      </Badge>
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
                      <Badge variant="default" className="shrink-0 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Call Confirmed
                      </Badge>
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
                      <Badge variant="info" className="shrink-0 gap-1">
                        <CreditCard className="h-3 w-3" />
                        Deposit Collected
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{deposit.note || 'Deposit collected'}</p>
                        <p className="text-xs text-muted-foreground">
                          Payment processed
                        </p>
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
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {activity.action_type}
                      </Badge>
                      <div className="flex-1">
                        {activity.note && <p className="text-sm text-muted-foreground">{activity.note}</p>}
                      </div>
                    </div>
                  )
                })),
                /* Overdue tasks removed from activity timeline - shown in metric card only */
              ]
                .sort((a, b) => b.time.getTime() - a.time.getTime())
                .map((item, idx) => (
                  <div key={idx}>{item.content}</div>
                ))}
              
              {dealsClosed.length === 0 && 
               mrrTasksCompleted.length === 0 && 
               confirmTasksCompleted.length === 0 && 
               depositsCollected.length === 0 && 
               pipelineActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No activity for this date</p>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
