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

      // Remove duplicates - keep only one task per appointment (most recent)
      const uniqueTasksMap = new Map<string, Task>();
      filteredTasks.forEach(task => {
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

  useEffect(() => {
    loadTasks();

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId]);

  return {
    myTasks,
    queueTasks,
    loading,
    claimTask,
    confirmTask,
    noShowTask,
    rescheduleTask,
    refreshTasks: loadTasks
  };
}
