import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Task {
  id: string;
  appointment_id: string;
  assigned_to: string | null;
  status: string;
  created_at: string;
  assigned_at: string | null;
  auto_return_at: string | null;
  task_type: 'call_confirmation' | 'follow_up' | 'reschedule';
  follow_up_date: string | null;
  follow_up_reason: string | null;
  reschedule_date: string | null;
  mrr_schedule_id?: string;
  mrr_amount?: number;
  mrr_confirmed_months?: number;
  mrr_total_months?: number;
  appointment?: any;
}

export function useTaskManagement(teamId: string, userId: string, userRole?: string) {
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [queueTasks, setQueueTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    try {
      // Auto-assign any unassigned tasks first
      await supabase.rpc('auto_assign_unassigned_tasks');

      // Get team's saved event types filter
      const { data: teamData } = await supabase
        .from('teams')
        .select('calendly_event_types')
        .eq('id', teamId)
        .single();

      const savedEventTypes = teamData?.calendly_event_types || [];

      // Load confirmation tasks (including those awaiting reschedule)
      const { data: tasks, error } = await supabase
        .from('confirmation_tasks')
        .select(`
          *,
          appointment:appointments(*)
        `)
        .eq('team_id', teamId)
        .in('status', ['pending', 'awaiting_reschedule'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load MRR follow-up tasks due today (for closers to confirm)
      const today = new Date().toISOString().split('T')[0];
      const { data: mrrTasks, error: mrrError } = await supabase
        .from('mrr_follow_up_tasks')
        .select(`
          *,
          mrr_schedule:mrr_schedules(
            appointment_id,
            client_name,
            client_email,
            assigned_to,
            mrr_amount
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'due')
        .eq('due_date', today)
        .order('due_date', { ascending: true });

      if (mrrError) throw mrrError;

      // Deduplicate MRR tasks by client email
      const mrrTasksByClient = new Map();
      (mrrTasks || []).forEach(task => {
        const clientKey = task.mrr_schedule?.client_email?.toLowerCase().trim();
        if (clientKey && !mrrTasksByClient.has(clientKey)) {
          mrrTasksByClient.set(clientKey, task);
        }
      });
      
      const uniqueMrrTasks = Array.from(mrrTasksByClient.values());

      // Convert MRR tasks to match Task interface
      const convertedMrrTasks = await Promise.all(uniqueMrrTasks.map(async (mrrTask) => {
        const schedule = mrrTask.mrr_schedule;
        const { data: appointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', schedule?.appointment_id)
          .maybeSingle();

        // Count confirmed months
        const { count: confirmedCount } = await supabase
          .from('mrr_follow_up_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('mrr_schedule_id', mrrTask.mrr_schedule_id)
          .eq('status', 'confirmed');

        const totalMonths = appointment?.mrr_months || 0;
        const confirmedMonths = confirmedCount || 0;

        return {
          id: mrrTask.id,
          appointment_id: schedule?.appointment_id || '',
          assigned_to: schedule?.assigned_to || null,
          status: 'pending',
          created_at: mrrTask.created_at,
          assigned_at: null,
          auto_return_at: null,
          task_type: 'follow_up' as const,
          follow_up_date: mrrTask.due_date,
          follow_up_reason: `MRR Payment Due: $${schedule?.mrr_amount}/mo (${confirmedMonths}/${totalMonths} months)`,
          reschedule_date: null,
          mrr_schedule_id: mrrTask.mrr_schedule_id,
          mrr_amount: schedule?.mrr_amount || 0,
          mrr_confirmed_months: confirmedMonths,
          mrr_total_months: totalMonths,
          appointment: appointment || {
            id: schedule?.appointment_id,
            lead_name: schedule?.client_name,
            lead_email: schedule?.client_email,
            start_at_utc: mrrTask.due_date,
            event_type_name: 'MRR Payment Confirmation',
            setter_id: null,
            setter_name: null,
            closer_id: schedule?.assigned_to,
            closer_name: null,
            team_id: teamId,
            mrr_months: totalMonths,
            mrr_amount: schedule?.mrr_amount
          }
        };
      }));

      // Filter tasks to only include appointments with event types that match saved filter
      let filteredTasks = tasks || [];
      if (savedEventTypes.length > 0) {
        filteredTasks = filteredTasks.filter(task => {
          const eventTypeUri = task.appointment?.event_type_uri;
          if (!eventTypeUri) return false;
          
          // Check if the appointment's event type URI matches any saved event type
          return savedEventTypes.some((savedUri: string) => {
            // Handle both full URIs and scheduling URLs
            return eventTypeUri === savedUri || 
                   eventTypeUri.includes(savedUri) || 
                   savedUri.includes(eventTypeUri);
          });
        });
      }

      // Filter tasks based on appointment status and due dates
      filteredTasks = filteredTasks.filter(task => {
        const aptStatus = task.appointment?.status;
        
        // Don't show call confirmation tasks for appointments that are already confirmed, closed, cancelled, or rescheduled
        // UNLESS the task itself is awaiting_reschedule (we want to keep showing those)
        if (task.task_type === 'call_confirmation' && 
            task.status !== 'awaiting_reschedule' &&
            (aptStatus === 'CONFIRMED' || aptStatus === 'CLOSED' || aptStatus === 'CANCELLED' || aptStatus === 'RESCHEDULED')) {
          return false;
        }
        
        // Show follow-up tasks only if they're due today or overdue (regardless of appointment status)
        if (task.task_type === 'follow_up' && task.follow_up_date) {
          return task.follow_up_date <= today;
        }
        
        // Show reschedule tasks only if due today or overdue
        if (task.task_type === 'reschedule' && task.reschedule_date) {
          return task.reschedule_date <= today;
        }
        
        return true;
      });

      // Use confirmation tasks + MRR tasks due today
      const allTasks = [...filteredTasks, ...convertedMrrTasks];

      // Remove duplicates - keep only one task per appointment (most recent)
      const uniqueTasksMap = new Map<string, Task>();
      allTasks.forEach(task => {
        const existingTask = uniqueTasksMap.get(task.appointment_id);
        if (!existingTask || new Date(task.created_at) > new Date(existingTask.created_at)) {
          uniqueTasksMap.set(task.appointment_id, task);
        }
      });
      
      const uniqueTasks = Array.from(uniqueTasksMap.values());
      
      console.log('Total unique tasks after filtering:', uniqueTasks.length);
      console.log('User role:', userRole);
      console.log('User ID:', userId);
      
      // Filter tasks based on who they're assigned to
      const my = userRole === 'admin' || userRole === 'offer_owner'
        ? uniqueTasks // Admins see all tasks (assigned + unassigned)
        : uniqueTasks.filter(t => t.assigned_to === userId || t.assigned_to === null); // Regular users see their tasks + unassigned
      
      // Queue tasks: completely unassigned (no assigned_to)
      const queue = uniqueTasks.filter(t => t.assigned_to === null);

      console.log('My tasks count:', my.length);
      console.log('Queue tasks count:', queue.length);

      setMyTasks(my);
      setQueueTasks(queue);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async (appointmentId: string, action: string, note?: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      await supabase.from('activity_logs').insert({
        team_id: teamId,
        appointment_id: appointmentId,
        actor_id: userId,
        actor_name: profile?.full_name || 'Unknown',
        action_type: action,
        note: note
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const claimTask = async (taskId: string, appointmentId: string) => {
    try {
      // Update task assignment
      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          assigned_to: userId,
          assigned_at: new Date().toISOString(),
          auto_return_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          claimed_manually: true
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Assign appointment to me if it's unassigned
      const { error: aptError } = await supabase
        .from('appointments')
        .update({ setter_id: userId })
        .eq('id', appointmentId)
        .is('setter_id', null);

      if (aptError) throw aptError;

      await logActivity(appointmentId, 'Task Claimed & Assigned');
      toast.success('Task claimed and assigned to you');
      loadTasks();
    } catch (error) {
      console.error('Error claiming task:', error);
      toast.error('Failed to claim task');
    }
  };

  const confirmTask = async (taskId: string, appointmentId: string, setterId: string | null, note?: string) => {
    try {
      // Get current task to store previous state
      const currentTask = myTasks.find(t => t.id === taskId);
      const previousState = {
        taskId,
        appointmentId,
        taskStatus: 'pending' as const,
        appointmentStatus: currentTask?.appointment?.status || 'NEW' as const,
        appointmentPipelineStage: currentTask?.appointment?.pipeline_stage || 'booked'
      };

      const updateData: any = {
        status: 'CONFIRMED',
        pipeline_stage: 'booked',
        setter_id: userId // Always assign to the person confirming
      };

      const { error: aptError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      await logActivity(appointmentId, 'Confirmed', note || 'Assigned to you');
      
      toast.success('Confirmed & Assigned to You', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              // Revert appointment
              await supabase
                .from('appointments')
                .update({
                  status: previousState.appointmentStatus,
                  pipeline_stage: previousState.appointmentPipelineStage,
                  setter_id: setterId
                })
                .eq('id', appointmentId);

              // Revert task
              await supabase
                .from('confirmation_tasks')
                .update({
                  status: 'pending',
                  completed_at: null
                })
                .eq('id', taskId);

              await logActivity(appointmentId, 'Undone', 'Confirmation reverted');
              toast.success('Confirmation undone');
              loadTasks();
            } catch (error) {
              console.error('Error undoing confirmation:', error);
              toast.error('Failed to undo');
            }
          }
        }
      });
      
      loadTasks();
    } catch (error) {
      console.error('Error confirming task:', error);
      toast.error('Failed to confirm');
    }
  };

  const noShowTask = async (taskId: string, appointmentId: string) => {
    try {
      const { error: aptError } = await supabase
        .from('appointments')
        .update({
          status: 'CANCELLED',
          pipeline_stage: 'no_show',
          retarget_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      await logActivity(appointmentId, 'No-Show', 'Added to follow-ups');
      toast.success('Marked as no-show');
      loadTasks();
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Failed to mark no-show');
    }
  };

  const rescheduleTask = async (taskId: string, appointmentId: string) => {
    try {
      const { error: aptError } = await supabase
        .from('appointments')
        .update({
          status: 'RESCHEDULED',
          pipeline_stage: 'rescheduled'
        })
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      await logActivity(appointmentId, 'Rescheduled');
      toast.success('Marked as rescheduled');
      loadTasks();
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to mark rescheduled');
    }
  };

  const markAwaitingReschedule = async (
    taskId: string, 
    appointmentId: string, 
    reason: string,
    notes?: string
  ): Promise<void> => {
    try {
      // Update task status to awaiting_reschedule
      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({ 
          status: 'awaiting_reschedule',
          auto_return_at: null, // Remove auto-return since we're waiting for webhook
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Log activity with reason and notes
      const logNote = notes 
        ? `Setter marked as awaiting reschedule - ${reason}\nNotes: ${notes}`
        : `Setter marked as awaiting reschedule - ${reason}`;
      
      await logActivity(appointmentId, 'Awaiting Reschedule', logNote);
      
      loadTasks();
    } catch (error) {
      console.error('Error marking task as awaiting reschedule:', error);
      throw error; // Re-throw to let dialog handle the error
    }
  };

  const confirmMRRPayment = async (taskId: string, appointmentId: string, mrrAmount: number) => {
    try {
      // Get MRR task details to find the schedule
      const { data: mrrTask } = await supabase
        .from('mrr_follow_up_tasks')
        .select('mrr_schedule_id, due_date')
        .eq('id', taskId)
        .single();

      if (!mrrTask) throw new Error('MRR task not found');

      // Get appointment and schedule details
      const { data: appointment } = await supabase
        .from('appointments')
        .select('*, setter_name, closer_name, setter_id, closer_id, lead_name, lead_email')
        .eq('id', appointmentId)
        .single();

      const { data: schedule } = await supabase
        .from('mrr_schedules')
        .select('*')
        .eq('id', mrrTask.mrr_schedule_id)
        .single();

      if (!appointment || !schedule) throw new Error('Appointment or schedule not found');

      // Get team commission settings
      const { data: team } = await supabase
        .from('teams')
        .select('setter_commission_percentage, closer_commission_percentage')
        .eq('id', teamId)
        .single();

      const setterCommissionPct = team?.setter_commission_percentage || 5;
      const closerCommissionPct = team?.closer_commission_percentage || 10;

      // Create commission records for this month
      const mrrCommissions = [];

      if (appointment.setter_id && appointment.setter_name) {
        mrrCommissions.push({
          team_id: teamId,
          appointment_id: appointmentId,
          team_member_id: appointment.setter_id,
          team_member_name: appointment.setter_name,
          prospect_name: appointment.lead_name,
          prospect_email: appointment.lead_email,
          role: 'setter',
          month_date: mrrTask.due_date,
          mrr_amount: mrrAmount,
          commission_amount: mrrAmount * (setterCommissionPct / 100),
          commission_percentage: setterCommissionPct,
        });
      }

      if (appointment.closer_id && appointment.closer_name) {
        mrrCommissions.push({
          team_id: teamId,
          appointment_id: appointmentId,
          team_member_id: appointment.closer_id,
          team_member_name: appointment.closer_name,
          prospect_name: appointment.lead_name,
          prospect_email: appointment.lead_email,
          role: 'closer',
          month_date: mrrTask.due_date,
          mrr_amount: mrrAmount,
          commission_amount: mrrAmount * (closerCommissionPct / 100),
          commission_percentage: closerCommissionPct,
        });
      }

      // Insert commission records
      if (mrrCommissions.length > 0) {
        const { error: commError } = await supabase
          .from('mrr_commissions')
          .insert(mrrCommissions);

        if (commError) throw commError;
      }

      // Mark the MRR task as confirmed
      const { error: taskError } = await supabase
        .from('mrr_follow_up_tasks')
        .update({
          status: 'confirmed',
          completed_at: new Date().toISOString(),
          completed_by: userId
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Add MRR amount to appointment's cc_collected
      const currentCC = appointment.cc_collected || 0;
      const { error: aptError } = await supabase
        .from('appointments')
        .update({
          cc_collected: Number(currentCC) + Number(mrrAmount)
        })
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      await logActivity(appointmentId, 'MRR Payment Confirmed', `$${mrrAmount} collected for ${mrrTask.due_date}`);
      toast.success(`MRR Payment Confirmed: $${mrrAmount}`);
      loadTasks();
    } catch (error) {
      console.error('Error confirming MRR payment:', error);
      toast.error('Failed to confirm MRR payment');
    }
  };

  useEffect(() => {
    loadTasks();

    // Subscribe to confirmation tasks changes
    const confirmationChannel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'confirmation_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => loadTasks()
      )
      .subscribe();

    // Subscribe to MRR follow-up tasks changes
    const mrrChannel = supabase
      .channel('mrr-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_follow_up_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => loadTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(confirmationChannel);
      supabase.removeChannel(mrrChannel);
    };
  }, [teamId, userId, userRole]);

  return {
    myTasks,
    queueTasks,
    loading,
    claimTask,
    confirmTask,
    noShowTask,
    rescheduleTask,
    markAwaitingReschedule,
    confirmMRRPayment,
    refreshTasks: loadTasks
  };
}
