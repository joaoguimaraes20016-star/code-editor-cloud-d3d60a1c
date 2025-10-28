import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle, XCircle, Pause, Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

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

  useEffect(() => {
    loadSchedules();

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
        () => loadSchedules()
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
        .eq('team_id', teamId)
        .eq('status', 'active');

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
            .select('user_id, profiles!inner(full_name)')
            .eq('user_id', appointment.closer_id)
            .eq('team_id', teamId)
            .single();

          if (closerTeamMember) {
            const { data: teamSettings } = await supabase
              .from('teams')
              .select('closer_commission_percentage')
              .eq('id', teamId)
              .single();

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

  const activeSchedules = schedules.filter(s => s.payment_due_today || s.confirmed_count < s.total_months);
  const completedSchedules = schedules.filter(s => !s.payment_due_today && s.confirmed_count >= s.total_months);

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
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border border-primary/30 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MRR Follow-Ups
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Monthly renewal tracking and payment confirmation</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-muted/20 via-background to-muted/10 rounded-2xl p-6 border border-primary/10 shadow-lg">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Active MRR Schedules
                <Badge variant="secondary" className="ml-auto">{activeSchedules.length}</Badge>
              </h3>
              
              {activeSchedules.length === 0 ? (
                <div className="text-center py-12 px-4 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-dashed border-border/50">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground font-medium">No active MRR schedules</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSchedules.map(schedule => (
                    <ScheduleCard key={schedule.id} schedule={schedule} />
                  ))}
                </div>
              )}
            </div>

            {completedSchedules.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Completed
                  <Badge variant="success" className="ml-auto">{completedSchedules.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedSchedules.map(schedule => (
                    <ScheduleCard key={schedule.id} schedule={schedule} />
                  ))}
                </div>
              </div>
            )}
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

              {selectedSchedule.payment_due_today && (
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
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirm Payment
                  </Button>
                </>
              )}

              {!selectedSchedule.payment_due_today && selectedSchedule.next_payment_due && (
                <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Next payment will be available to confirm on {format(parseISO(selectedSchedule.next_payment_due), 'MMMM dd, yyyy')}
                  </p>
                </div>
              )}

              {selectedSchedule.confirmed_count >= selectedSchedule.total_months && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    All {selectedSchedule.total_months} payments collected!
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
