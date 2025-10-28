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
      // Get team's saved event types filter
      const { data: teamData } = await supabase
        .from('teams')
        .select('calendly_event_types')
        .eq('id', teamId)
        .single();

      const savedEventTypes = teamData?.calendly_event_types || [];

      // Load confirmation tasks
      const { data: tasks, error } = await supabase
        .from('confirmation_tasks')
        .select(`
          *,
          appointment:appointments(*)
        `)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load MRR follow-up tasks (only show when due date is today or earlier)
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
        .in('status', ['due', 'overdue'])
        .lte('due_date', today)
        .order('due_date', { ascending: true });

      if (mrrError) throw mrrError;

      // Convert MRR tasks to match Task interface
      const convertedMrrTasks = await Promise.all((mrrTasks || []).map(async (mrrTask) => {
        const schedule = mrrTask.mrr_schedule;
        // Get appointment details
        const { data: appointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', schedule?.appointment_id)
          .maybeSingle();

        // Count total confirmed MRR payments for this schedule
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
          follow_up_reason: `MRR Follow-up: $${schedule?.mrr_amount}/mo (${confirmedMonths}/${totalMonths} months)`,
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
            event_type_name: 'MRR Follow-Up',
            setter_id: schedule?.assigned_to,
            setter_name: null,
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

      // Combine confirmation tasks and MRR tasks
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
        ? uniqueTasks.filter(t => t.assigned_to !== null) // All assigned tasks
        : uniqueTasks.filter(t => t.assigned_to === userId); // Only tasks assigned to me
      
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

  const confirmTask = async (taskId: string, appointmentId: string, setterId: string | null) => {
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

      await logActivity(appointmentId, 'Confirmed', 'Assigned to you');
      
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

  const confirmMRRPayment = async (taskId: string, appointmentId: string, mrrAmount: number) => {
    try {
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
      const { data: appointment } = await supabase
        .from('appointments')
        .select('cc_collected')
        .eq('id', appointmentId)
        .single();

      const currentCC = appointment?.cc_collected || 0;
      const { error: aptError } = await supabase
        .from('appointments')
        .update({
          cc_collected: Number(currentCC) + Number(mrrAmount)
        })
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      await logActivity(appointmentId, 'MRR Payment Confirmed', `$${mrrAmount} collected`);
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
    confirmMRRPayment,
    refreshTasks: loadTasks
  };
}
