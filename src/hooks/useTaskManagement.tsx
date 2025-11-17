import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, format, parseISO, startOfDay, endOfDay } from 'date-fns';

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
  confirmation_attempts?: any[];
  required_confirmations?: number;
  completed_confirmations?: number;
  confirmation_sequence?: number;
  due_at?: string | null;
  is_overdue?: boolean;
  assigned_role?: string | null;
  routing_mode?: string | null;
  pipeline_stage?: string;
  follow_up_sequence?: number;
  total_follow_ups?: number;
}

export function useTaskManagement(teamId: string, userId: string, userRole?: string) {
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [queueTasks, setQueueTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Force fresh module load
  console.log('[useTaskManagement] Hook initialized at:', new Date().toISOString());

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

      // Load follow-up config to get total counts per stage
      const { data: followUpConfigs } = await supabase
        .from('team_follow_up_flow_config')
        .select('pipeline_stage, sequence')
        .eq('team_id', teamId)
        .eq('enabled', true);

      // Create map of total follow-ups per stage
      const totalsByStage = (followUpConfigs || []).reduce((acc, config) => {
        acc[config.pipeline_stage] = Math.max(
          acc[config.pipeline_stage] || 0,
          config.sequence
        );
        return acc;
      }, {} as Record<string, number>);

      // Load confirmation tasks (including those awaiting reschedule)
      const { data: tasks, error } = await supabase
        .from('confirmation_tasks')
        .select(`
          *,
          appointment:appointments(*),
          assigned_role,
          routing_mode
        `)
        .eq('team_id', teamId)
        .in('status', ['pending', 'awaiting_reschedule'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load MRR follow-up tasks for next 30 days (not just today)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = addDays(new Date(), 30).toISOString().split('T')[0];
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
        .gte('due_date', today)
        .lte('due_date', futureDate)
        .order('due_date', { ascending: true });

      if (mrrError) throw mrrError;

      // Add total_follow_ups to all tasks
      const tasksWithTotals = (tasks || []).map(task => ({
        ...task,
        total_follow_ups: task.pipeline_stage ? totalsByStage[task.pipeline_stage] : undefined
      }));

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
      let filteredTasks = tasksWithTotals || [];
      if (savedEventTypes && savedEventTypes.length > 0) {
        filteredTasks = filteredTasks.filter(task => {
          const eventTypeUri = task.appointment?.event_type_uri;
          // If no event type URI, still show the task (don't filter it out)
          if (!eventTypeUri) return true;
          
          // Check if the appointment's event type URI matches any saved event type
          return savedEventTypes.some((savedUri: string) => {
            // Handle both full URIs and scheduling URLs
            return eventTypeUri === savedUri || 
                   eventTypeUri.includes(savedUri) || 
                   savedUri.includes(eventTypeUri);
          });
        });
      }

      // DEFENSIVE LOGGING: Check what code version is running
      console.log('[FILTER VERSION CHECK] Using parseISO + defensive error handling - Code updated:', new Date().toISOString());
      console.log('[FILTER INPUT] Total tasks before filter:', filteredTasks.length);
      filteredTasks.forEach(t => {
        if (t.appointment?.lead_name?.toLowerCase().includes('byron')) {
          console.log('[BYRON DETECTED] Before filter:', {
            id: t.id,
            lead_name: t.appointment?.lead_name,
            has_due_at: !!t.due_at,
            due_at_value: t.due_at,
            due_at_type: typeof t.due_at,
            task_type: t.task_type,
            status: t.status,
            assigned_to: t.assigned_to
          });
        }
      });

      // Filter tasks based on appointment status and due dates
      filteredTasks = filteredTasks.filter(task => {
        const aptStatus = task.appointment?.status;
        const appointment = task.appointment;
        
        // Don't show call confirmation tasks for appointments that are already confirmed, closed, cancelled, or rescheduled
        // UNLESS the task itself is awaiting_reschedule (we want to keep showing those)
        if (task.task_type === 'call_confirmation' && 
            task.status !== 'awaiting_reschedule' &&
            (aptStatus === 'CONFIRMED' || aptStatus === 'CLOSED' || aptStatus === 'CANCELLED' || aptStatus === 'RESCHEDULED')) {
          return false;
        }
        
        // Show ALL call_confirmation tasks regardless of due date
        // Only hide tasks for appointments that are already processed
        if (task.task_type === 'call_confirmation') {
          return true;
        }
        
        // Show follow-up tasks for the next 30 days
        if (task.task_type === 'follow_up' && task.follow_up_date) {
          return task.follow_up_date <= futureDate;
        }
        
        // Show reschedule tasks for the next 30 days
        if (task.task_type === 'reschedule' && task.reschedule_date) {
          return task.reschedule_date <= futureDate;
        }
        
        // Default: don't show tasks that don't match any criteria above (fail closed)
        console.log('[FILTER] Task did not match any criteria - HIDING:', {
          lead_name: appointment?.lead_name,
          task_type: task.task_type,
          has_due_at: !!task.due_at,
          has_follow_up_date: !!task.follow_up_date,
          has_reschedule_date: !!task.reschedule_date
        });
        return false;
      });

      // Use confirmation tasks + MRR tasks due today
      const allTasks = [...filteredTasks, ...convertedMrrTasks];

      // Remove duplicates - keep only one task per appointment (most recent)
      const uniqueTasksMap = new Map<string, Task>();
      allTasks.forEach(task => {
        const existingTask = uniqueTasksMap.get(task.appointment_id);
        // Cast confirmation_attempts properly when it exists
        const taskWithCastedAttempts: Task = {
          ...task,
          confirmation_attempts: ('confirmation_attempts' in task && task.confirmation_attempts) 
            ? (task.confirmation_attempts as unknown as any[]) 
            : []
        };
        if (!existingTask || new Date(task.created_at) > new Date(existingTask.created_at)) {
          uniqueTasksMap.set(task.appointment_id, taskWithCastedAttempts);
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
        .update({ 
          setter_id: userId,
          assignment_source: 'manual_claim'
        })
        .eq('id', appointmentId)
        .is('setter_id', null)
        .is('closer_id', null);

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
      if (!currentTask) {
        toast.error('Task not found');
        return;
      }

      // Store previous state for undo
      const previousState = {
        taskId,
        appointmentId,
        taskData: {
          confirmation_attempts: currentTask.confirmation_attempts || [],
          completed_confirmations: currentTask.completed_confirmations || 0,
          confirmation_sequence: currentTask.confirmation_sequence || 1,
          due_at: currentTask.due_at,
          status: 'pending' as const,
          is_overdue: false,
          completed_at: null
        },
        appointmentStatus: currentTask.appointment?.status || 'NEW' as const,
        appointmentPipelineStage: currentTask.appointment?.pipeline_stage || 'booked',
        appointmentSetterId: currentTask.appointment?.setter_id
      };

      // Record this confirmation attempt
      const newAttempt = {
        timestamp: new Date().toISOString(),
        confirmed_by: userId,
        notes: note || '',
        sequence: currentTask.confirmation_sequence || 1
      };

      const attempts = [...(currentTask.confirmation_attempts || []), newAttempt];
      const completedCount = (currentTask.completed_confirmations || 0) + 1;
      const requiredCount = currentTask.required_confirmations || 1;

      // Check if we need more confirmations
      if (completedCount < requiredCount) {
        // Get team schedule to find next window
        const { data: team } = await supabase
          .from('teams')
          .select('confirmation_schedule')
          .eq('id', teamId)
          .single();

        const schedule = team?.confirmation_schedule || [
          {sequence: 1, hours_before: 24, label: "24h Before"},
          {sequence: 2, hours_before: 1, label: "1h Before"},
          {sequence: 3, hours_before: 0.17, label: "10min Before"}
        ];
        const nextWindow = schedule[completedCount]; // next in array

        // Calculate next due_at
        const appointmentTime = new Date(currentTask.appointment.start_at_utc);
        const nextDueAt = new Date(
          appointmentTime.getTime() - (nextWindow.hours_before * 60 * 60 * 1000)
        );

        // Update task with new confirmation data + next window
        const { error: taskError } = await supabase
          .from('confirmation_tasks')
          .update({
            confirmation_attempts: attempts,
            completed_confirmations: completedCount,
            confirmation_sequence: completedCount + 1,
            due_at: nextDueAt.toISOString(),
            is_overdue: false
          })
          .eq('id', taskId);

        if (taskError) throw taskError;

        // Update appointment setter if needed (only if both setter and closer are unassigned)
        const { error: aptError } = await supabase
          .from('appointments')
          .update({ setter_id: userId })
          .eq('id', appointmentId)
          .is('setter_id', null)
          .is('closer_id', null);

        if (aptError) throw aptError;

        await logActivity(appointmentId, 'Confirmation Recorded', 
          note ? `${note} (${completedCount}/${requiredCount})` : `Confirmation ${completedCount}/${requiredCount} completed. Next due: ${nextWindow.label}`);

        toast.success(`Confirmation ${completedCount}/${requiredCount} recorded! Next: ${nextWindow.label}`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                // Revert task to previous state
                await supabase
                  .from('confirmation_tasks')
                  .update(previousState.taskData)
                  .eq('id', taskId);

                // Revert appointment setter if it was changed
                if (previousState.appointmentSetterId !== userId) {
                  await supabase
                    .from('appointments')
                    .update({ setter_id: previousState.appointmentSetterId })
                    .eq('id', appointmentId);
                }

                await logActivity(appointmentId, 'Undone', 'Confirmation undone');
                toast.success('Confirmation undone');
                loadTasks();
              } catch (error) {
                console.error('Error undoing confirmation:', error);
                toast.error('Failed to undo');
              }
            }
          },
          duration: 10000
        });
        
        loadTasks();

      } else {
        // All confirmations complete!
        const { error: taskError } = await supabase
          .from('confirmation_tasks')
          .update({
            confirmation_attempts: attempts,
            completed_confirmations: completedCount,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (taskError) throw taskError;

        // Mark appointment as confirmed
        const { error: aptError } = await supabase
          .from('appointments')
          .update({
            status: 'CONFIRMED',
            pipeline_stage: 'booked',
            setter_id: userId
          })
          .eq('id', appointmentId);

        if (aptError) throw aptError;

        await logActivity(appointmentId, 'Confirmed', 
          note ? `${note} - All ${requiredCount} confirmations completed!` : `All ${requiredCount} confirmations completed. Appointment confirmed!`);

        toast.success('🎉 All confirmations complete! Appointment confirmed.', {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                // Revert task to previous state
                await supabase
                  .from('confirmation_tasks')
                  .update(previousState.taskData)
                  .eq('id', taskId);

                // Revert appointment
                await supabase
                  .from('appointments')
                  .update({
                    status: previousState.appointmentStatus,
                    pipeline_stage: previousState.appointmentPipelineStage,
                    setter_id: previousState.appointmentSetterId
                  })
                  .eq('id', appointmentId);

                await logActivity(appointmentId, 'Undone', 'Final confirmation undone');
                toast.success('Confirmation undone');
                loadTasks();
              } catch (error) {
                console.error('Error undoing confirmation:', error);
                toast.error('Failed to undo');
              }
            }
          },
          duration: 10000
        });
        
        loadTasks();
      }
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
        const { data: closerTeamMember } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', appointment.closer_id)
          .maybeSingle();

        if (closerTeamMember?.role !== 'offer_owner') {
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
