import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, CheckCircle, XCircle, Pause, Ban, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface MRRScheduleWithProgress {
  id: string;
  client_name: string;
  client_email: string;
  mrr_amount: number;
  appointment_id: string;
  next_payment_due: string | null;
  payment_due_today: boolean;
  confirmed_count: number;
  total_months: number;
  current_task_id: string | null;
  status: string;
  notes: string | null;
}

interface MRRFollowUpsProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
}

export function MRRFollowUps({ teamId, userRole, currentUserId }: MRRFollowUpsProps) {
  const [schedules, setSchedules] = useState<MRRScheduleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<MRRScheduleWithProgress | null>(null);
  const [notes, setNotes] = useState('');
  const [taskStats, setTaskStats] = useState({ due: 0, confirmed: 0, canceled: 0, paused: 0 });
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [scheduleToReactivate, setScheduleToReactivate] = useState<string | null>(null);
  const [nextPaymentDate, setNextPaymentDate] = useState<Date>();

  useEffect(() => {
    loadSchedules();
    loadTaskStats();

    const channel = supabase
      .channel(`mrr-schedules-${teamId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_follow_up_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadSchedules();
          loadTaskStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_schedules',
          filter: `team_id=eq.${teamId}`
        },
        () => loadSchedules()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadSchedules = async () => {
    try {
      // Load schedules with proper filtering
      let schedulesQuery = supabase
        .from('mrr_schedules')
        .select('*')
        .eq('team_id', teamId);

      if (userRole === 'closer' && currentUserId) {
        schedulesQuery = schedulesQuery.eq('assigned_to', currentUserId);
      }

      const { data: schedulesData, error: schedulesError } = await schedulesQuery;
      if (schedulesError) throw schedulesError;

      if (!schedulesData || schedulesData.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // Load appointments to get mrr_months
      const appointmentIds = schedulesData.map(s => s.appointment_id);
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('id, mrr_months')
        .in('id', appointmentIds);

      const appointmentsMap = new Map(appointmentsData?.map(a => [a.id, a]) || []);

      // Load all tasks for these schedules
      const scheduleIds = schedulesData.map(s => s.id);
      const { data: tasksData } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*')
        .eq('team_id', teamId)
        .in('mrr_schedule_id', scheduleIds)
        .order('due_date', { ascending: true });

      const today = new Date().toISOString().split('T')[0];

      // Build schedule progress data
      const schedulesWithProgress: MRRScheduleWithProgress[] = schedulesData.map(schedule => {
        const tasks = tasksData?.filter(t => t.mrr_schedule_id === schedule.id) || [];
        const confirmedTasks = tasks.filter(t => t.status === 'confirmed');
        const dueTasks = tasks.filter(t => t.status === 'due');
        const todayTask = dueTasks.find(t => t.due_date === today);
        
        const appointment = appointmentsMap.get(schedule.appointment_id);
        const totalMonths = appointment?.mrr_months || 0;

        return {
          id: schedule.id,
          client_name: schedule.client_name,
          client_email: schedule.client_email,
          mrr_amount: schedule.mrr_amount,
          appointment_id: schedule.appointment_id,
          next_payment_due: dueTasks[0]?.due_date || null,
          payment_due_today: !!todayTask,
          confirmed_count: confirmedTasks.length,
          total_months: totalMonths,
          current_task_id: todayTask?.id || dueTasks[0]?.id || null,
          status: schedule.status,
          notes: schedule.notes
        };
      });

      setSchedules(schedulesWithProgress);
    } catch (error) {
      console.error('Error loading MRR schedules:', error);
      toast.error('Failed to load MRR schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskStats = async () => {
    try {
      // Load schedules with proper filtering
      let schedulesQuery = supabase
        .from('mrr_schedules')
        .select('id')
        .eq('team_id', teamId);

      if (userRole === 'closer' && currentUserId) {
        schedulesQuery = schedulesQuery.eq('assigned_to', currentUserId);
      }

      const { data: schedulesData, error: schedulesError } = await schedulesQuery;
      if (schedulesError) throw schedulesError;

      if (!schedulesData || schedulesData.length === 0) {
        setTaskStats({ due: 0, confirmed: 0, canceled: 0, paused: 0 });
        return;
      }

      const scheduleIds = schedulesData.map(s => s.id);

      // Load tasks only for visible schedules
      const { data, error } = await supabase
        .from('mrr_follow_up_tasks')
        .select('status')
        .eq('team_id', teamId)
        .in('mrr_schedule_id', scheduleIds);

      if (error) throw error;

      const stats = {
        due: data?.filter(t => t.status === 'due').length || 0,
        confirmed: data?.filter(t => t.status === 'confirmed').length || 0,
        canceled: data?.filter(t => t.status === 'canceled').length || 0,
        paused: data?.filter(t => t.status === 'paused').length || 0,
      };

      setTaskStats(stats);
    } catch (error) {
      console.error('Error loading task stats:', error);
    }
  };

  const pauseSchedule = async (scheduleId: string) => {
    try {
      // Pause the schedule
      const { error: scheduleError } = await supabase
        .from('mrr_schedules')
        .update({ status: 'paused' })
        .eq('id', scheduleId);

      if (scheduleError) throw scheduleError;

      // Pause all pending tasks for this schedule
      const { error: tasksError } = await supabase
        .from('mrr_follow_up_tasks')
        .update({ status: 'paused' })
        .eq('mrr_schedule_id', scheduleId)
        .eq('status', 'due');

      if (tasksError) throw tasksError;

      toast.success('Schedule paused');
      setSelectedSchedule(null);
      loadSchedules();
    } catch (error) {
      console.error('Error pausing schedule:', error);
      toast.error('Failed to pause schedule');
    }
  };

  const cancelSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('mrr_schedules')
        .update({ status: 'canceled' })
        .eq('id', scheduleId);

      if (error) throw error;

      toast.success('Schedule canceled');
      setSelectedSchedule(null);
      loadSchedules();
    } catch (error) {
      console.error('Error canceling schedule:', error);
      toast.error('Failed to cancel schedule');
    }
  };

  const reactivateSchedule = async (scheduleId: string, newPaymentDate: Date) => {
    try {
      const formattedDate = format(newPaymentDate, 'yyyy-MM-dd');
      
      // Reactivate the schedule and update next renewal date
      const { error: scheduleError } = await supabase
        .from('mrr_schedules')
        .update({ 
          status: 'active',
          next_renewal_date: formattedDate
        })
        .eq('id', scheduleId);

      if (scheduleError) throw scheduleError;

      // Find all paused tasks for this schedule
      const { data: pausedTasks } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*')
        .eq('mrr_schedule_id', scheduleId)
        .eq('status', 'paused')
        .order('due_date', { ascending: true });

      // Update the first paused task with the new date and mark as due
      if (pausedTasks && pausedTasks.length > 0) {
        const { error: taskError } = await supabase
          .from('mrr_follow_up_tasks')
          .update({ 
            status: 'due',
            due_date: formattedDate
          })
          .eq('id', pausedTasks[0].id);

        if (taskError) throw taskError;
      }

      toast.success('Schedule reactivated');
      setSelectedSchedule(null);
      setReactivateDialogOpen(false);
      setScheduleToReactivate(null);
      setNextPaymentDate(undefined);
      loadSchedules();
    } catch (error) {
      console.error('Error reactivating schedule:', error);
      toast.error('Failed to reactivate schedule');
    }
  };

  const handleReactivateClick = (scheduleId: string) => {
    setScheduleToReactivate(scheduleId);
    setReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = () => {
    if (scheduleToReactivate && nextPaymentDate) {
      reactivateSchedule(scheduleToReactivate, nextPaymentDate);
    } else {
      toast.error('Please select a payment date');
    }
  };

  const confirmPayment = async (schedule: MRRScheduleWithProgress) => {
    if (!schedule.current_task_id) {
      toast.error('No payment task to confirm');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Close dialog and update optimistically
      setSelectedSchedule(null);
      setNotes('');

      // Mark task as confirmed
      const { error: taskError } = await supabase
        .from('mrr_follow_up_tasks')
        .update({
          status: 'confirmed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: notes || undefined
        })
        .eq('id', schedule.current_task_id);

      if (taskError) throw taskError;

      // Update appointment cc_collected
      const { data: appointment } = await supabase
        .from('appointments')
        .select('cc_collected, setter_id, closer_id')
        .eq('id', schedule.appointment_id)
        .single();

      if (appointment) {
        const newCollected = (appointment.cc_collected || 0) + schedule.mrr_amount;
        
        await supabase
          .from('appointments')
          .update({ cc_collected: newCollected })
          .eq('id', schedule.appointment_id);

        // Create commissions
        const month_date = new Date().toISOString().split('T')[0];
        const commissions = [];

        if (appointment.setter_id) {
          const { data: setterTeamMember } = await supabase
            .from('team_members')
            .select('user_id, profiles!inner(full_name)')
            .eq('user_id', appointment.setter_id)
            .eq('team_id', teamId)
            .single();

          if (setterTeamMember) {
            const { data: teamSettings } = await supabase
              .from('teams')
              .select('setter_commission_percentage')
              .eq('id', teamId)
              .single();

            const setterCommission = schedule.mrr_amount * ((teamSettings?.setter_commission_percentage || 5) / 100);
            
            commissions.push({
              team_id: teamId,
              appointment_id: schedule.appointment_id,
              team_member_id: appointment.setter_id,
              team_member_name: (setterTeamMember.profiles as any)?.full_name || 'Unknown',
              role: 'setter',
              prospect_name: schedule.client_name,
              prospect_email: schedule.client_email,
              month_date,
              mrr_amount: schedule.mrr_amount,
              commission_percentage: teamSettings?.setter_commission_percentage || 5,
              commission_amount: setterCommission
            });
          }
        }

        if (appointment.closer_id) {
          const { data: closerTeamMember } = await supabase
            .from('team_members')
            .select('user_id, role, profiles!inner(full_name)')
            .eq('user_id', appointment.closer_id)
            .eq('team_id', teamId)
            .single();

          if (closerTeamMember) {
            const { data: teamSettings } = await supabase
              .from('teams')
              .select('closer_commission_percentage')
              .eq('id', teamId)
              .single();

            // Only add commission if closer is NOT offer owner
            if (closerTeamMember.role !== 'offer_owner') {
              const closerCommission = schedule.mrr_amount * ((teamSettings?.closer_commission_percentage || 10) / 100);
              
              commissions.push({
                team_id: teamId,
                appointment_id: schedule.appointment_id,
                team_member_id: appointment.closer_id,
                team_member_name: (closerTeamMember.profiles as any)?.full_name || 'Unknown',
                role: 'closer',
                prospect_name: schedule.client_name,
                prospect_email: schedule.client_email,
                month_date,
                mrr_amount: schedule.mrr_amount,
                commission_percentage: teamSettings?.closer_commission_percentage || 10,
                commission_amount: closerCommission
              });
            }
          }
        }

        if (commissions.length > 0) {
          await supabase.from('mrr_commissions').insert(commissions);
        }
      }

      // Log activity
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id || '')
        .maybeSingle();

      await supabase.from('activity_logs').insert({
        team_id: teamId,
        appointment_id: schedule.appointment_id,
        actor_id: user?.id,
        actor_name: profile?.full_name || 'Unknown',
        action_type: 'MRR Payment Confirmed',
        note: notes || undefined
      });

      toast.success(`Payment confirmed! ${schedule.confirmed_count + 1}/${schedule.total_months} months collected`);
      loadSchedules();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
      loadSchedules();
    }
  };

  const activeSchedules = schedules.filter(s => s.status === 'active');
  const pausedSchedules = schedules.filter(s => s.status === 'paused');
  const canceledSchedules = schedules.filter(s => s.status === 'canceled');
  const completedSchedules = schedules.filter(s => s.status === 'completed' || (s.status === 'active' && s.confirmed_count >= s.total_months));
  
  const totalMRR = activeSchedules.reduce((sum, s) => sum + s.mrr_amount, 0);

  const handleQuickPayment = async (schedule: MRRScheduleWithProgress) => {
    if (!schedule.current_task_id) {
      toast.error('No payment task to confirm');
      return;
    }
    await confirmPayment(schedule);
  };

  const EnhancedSubscriptionCard = ({ schedule, onMarkPaid, onPause, onCancel, onViewDetails }: {
    schedule: MRRScheduleWithProgress;
    onMarkPaid: () => void;
    onPause: () => void;
    onCancel: () => void;
    onViewDetails: () => void;
  }) => {
    const isDueToday = schedule.payment_due_today;
    const daysUntilDue = schedule.next_payment_due 
      ? differenceInDays(parseISO(schedule.next_payment_due), new Date())
      : null;
    
    const getDueDateText = () => {
      if (isDueToday) return '⚠️ Due Today!';
      if (daysUntilDue === null) return 'No upcoming payment';
      if (daysUntilDue < 0) return `⚠️ Overdue by ${Math.abs(daysUntilDue)} days`;
      if (daysUntilDue === 1) return 'Due Tomorrow';
      if (daysUntilDue <= 7) return `Due in ${daysUntilDue} days`;
      return `Next: ${format(parseISO(schedule.next_payment_due), 'MMM dd')}`;
    };

    return (
      <Card 
        className={cn(
          "group relative cursor-pointer transition-all duration-300",
          "hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1",
          isDueToday && "border-orange-500 dark:border-orange-400 shadow-orange-200 dark:shadow-orange-900/50",
          daysUntilDue !== null && daysUntilDue < 0 && "border-red-500 dark:border-red-400 animate-pulse"
        )}
      >
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg",
          isDueToday ? "bg-orange-500" : daysUntilDue !== null && daysUntilDue < 0 ? "bg-red-500" : "bg-success"
        )} />
        
        <CardContent className="p-5 pl-6 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate group-hover:text-primary transition-colors">
                {schedule.client_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {schedule.client_email}
              </p>
            </div>
            <Badge variant={isDueToday ? "default" : "secondary"} className="shrink-0">
              {schedule.confirmed_count}/{schedule.total_months}
            </Badge>
          </div>

          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ${schedule.mrr_amount.toLocaleString()}/mo
          </div>

          <div className={cn(
            "flex items-center gap-2 text-sm font-medium",
            isDueToday && "text-orange-600 dark:text-orange-400",
            daysUntilDue !== null && daysUntilDue < 0 && "text-red-600 dark:text-red-400"
          )}>
            <Calendar className="h-4 w-4" />
            {getDueDateText()}
          </div>

          <div className="pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
            {(isDueToday || (daysUntilDue !== null && daysUntilDue < 0)) && (
              <Button 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}
                className="flex-1"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Mark Paid
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onPause(); }}
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            >
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ScheduleCard = ({ schedule }: { schedule: MRRScheduleWithProgress }) => {
    const isDueToday = schedule.payment_due_today;
    const progress = `${schedule.confirmed_count}/${schedule.total_months}`;

    return (
      <Card
        className="group cursor-pointer hover:shadow-xl hover:scale-[1.03] hover:-translate-y-1 transition-all duration-300 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/80"
        onClick={() => {
          setSelectedSchedule(schedule);
          setNotes(schedule.notes || '');
        }}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base group-hover:text-primary transition-colors truncate">
                {schedule.client_name}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {schedule.client_email}
              </p>
            </div>
            <Badge 
              variant={isDueToday ? "success" : "secondary"}
              className="shrink-0"
            >
              {progress} months
            </Badge>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/30">
            <div className="flex flex-col gap-1">
              {schedule.next_payment_due && (
                <div className={`flex items-center gap-1.5 text-xs ${isDueToday ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    {isDueToday ? 'Due Today!' : `Next: ${format(parseISO(schedule.next_payment_due), 'MMM dd, yyyy')}`}
                  </span>
                </div>
              )}
            </div>
            <div className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ${schedule.mrr_amount.toLocaleString()}/mo
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Active Subscriptions Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success animate-pulse"></div>
                Active Subscriptions
              </CardTitle>
              <div className="flex items-center gap-4">
                <Badge variant="success" className="text-lg px-4 py-2">
                  {activeSchedules.length} Active
                </Badge>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total MRR</p>
                  <p className="text-2xl font-bold text-success">
                    ${totalMRR.toLocaleString()}/mo
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* MRR Task Status Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-card border rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium">Due Tasks</p>
                <p className="text-2xl font-bold text-primary">{taskStats.due}</p>
              </div>
              <div className="bg-card border rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium">Confirmed</p>
                <p className="text-2xl font-bold text-success">{taskStats.confirmed}</p>
              </div>
              <div className="bg-card border rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium">Canceled</p>
                <p className="text-2xl font-bold text-destructive">{taskStats.canceled}</p>
              </div>
              <div className="bg-card border rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium">Paused</p>
                <p className="text-2xl font-bold text-warning">{taskStats.paused}</p>
              </div>
            </div>
            {activeSchedules.length === 0 ? (
              <div className="text-center py-12 px-4 bg-card/50 rounded-lg border border-dashed">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active subscriptions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSchedules.map(schedule => (
                  <EnhancedSubscriptionCard 
                    key={schedule.id}
                    schedule={schedule}
                    onMarkPaid={() => handleQuickPayment(schedule)}
                    onPause={() => pauseSchedule(schedule.id)}
                    onCancel={() => cancelSchedule(schedule.id)}
                    onViewDetails={() => {
                      setSelectedSchedule(schedule);
                      setNotes(schedule.notes || '');
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Follow-Up Tasks Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border border-primary/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Payment Follow-Up Tasks
              </h2>
              <p className="text-xs text-muted-foreground">Track and manage payment confirmations</p>
            </div>
          </div>
        </div>

        {/* Follow-Up Columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Active Column */}
          <div className="flex-1 min-w-[350px]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Active
                  </CardTitle>
                  <Badge variant="secondary">{activeSchedules.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {activeSchedules.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No active schedules</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {activeSchedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Paused Column */}
          <div className="flex-1 min-w-[350px]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Pause className="h-4 w-4 text-warning" />
                    Paused
                  </CardTitle>
                  <Badge variant="warning">{pausedSchedules.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {pausedSchedules.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
                      <Pause className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No paused schedules</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {pausedSchedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Canceled Column */}
          <div className="flex-1 min-w-[350px]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    Canceled
                  </CardTitle>
                  <Badge variant="destructive">{canceledSchedules.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {canceledSchedules.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
                      <Ban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No canceled schedules</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {canceledSchedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Completed Column */}
          <div className="flex-1 min-w-[350px]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    Completed
                  </CardTitle>
                  <Badge variant="success">{completedSchedules.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {completedSchedules.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No completed schedules</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {completedSchedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedSchedule} onOpenChange={() => setSelectedSchedule(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MRR Schedule Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedSchedule && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl p-5 border border-border/50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-lg font-bold mb-1">{selectedSchedule.client_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedSchedule.client_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      ${selectedSchedule.mrr_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Progress:</span>
                    <Badge variant="success" className="text-base">
                      {selectedSchedule.confirmed_count} / {selectedSchedule.total_months} months
                    </Badge>
                  </div>
                  
                  {selectedSchedule.next_payment_due && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {selectedSchedule.payment_due_today 
                          ? '🔔 Payment Due Today!' 
                          : `Next Payment: ${format(parseISO(selectedSchedule.next_payment_due), 'MMMM dd, yyyy')}`
                        }
                      </span>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-2">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      💡 Total collected: ${(selectedSchedule.confirmed_count * selectedSchedule.mrr_amount).toLocaleString()} of ${(selectedSchedule.total_months * selectedSchedule.mrr_amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {selectedSchedule.confirmed_count < selectedSchedule.total_months && (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <span>Payment Notes</span>
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Record payment details, conversation notes, or next steps..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <Button
                    onClick={() => confirmPayment(selectedSchedule)}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all h-12"
                    disabled={!selectedSchedule.current_task_id}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {selectedSchedule.payment_due_today ? 'Confirm Payment' : 'Confirm Payment Early'}
                  </Button>
                  
                  {!selectedSchedule.payment_due_today && selectedSchedule.next_payment_due && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Payment is scheduled for {format(parseISO(selectedSchedule.next_payment_due), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedSchedule.confirmed_count >= selectedSchedule.total_months && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    All {selectedSchedule.total_months} payments collected!
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border/50">
                {selectedSchedule.status === 'active' ? (
                  <>
                    <Button
                      onClick={() => pauseSchedule(selectedSchedule.id)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Schedule
                    </Button>
                    <Button
                      onClick={() => cancelSchedule(selectedSchedule.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Cancel Schedule
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleReactivateClick(selectedSchedule.id)}
                    variant="default"
                    className="flex-1"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Reactivate Schedule
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reactivate Schedule Dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reactivate Schedule</DialogTitle>
            <DialogDescription>
              Choose the date for the next payment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !nextPaymentDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {nextPaymentDate ? format(nextPaymentDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={nextPaymentDate}
                  onSelect={setNextPaymentDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReactivateDialogOpen(false);
                setScheduleToReactivate(null);
                setNextPaymentDate(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmReactivate}
              disabled={!nextPaymentDate}
            >
              Reactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
