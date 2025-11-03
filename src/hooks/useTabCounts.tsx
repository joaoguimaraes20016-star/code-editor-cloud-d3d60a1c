import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTabCounts(teamId: string, userId: string, userRole: string) {
  const [counts, setCounts] = useState({
    myTasks: 0,
    queueTasks: 0,
    mrrDue: 0,
    followUps: 0,
    overdue: 0,
    totalPendingTasks: 0,
    unassigned: 0,
  });

  useEffect(() => {
    loadCounts();

    const channel = supabase
      .channel('tab-counts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'confirmation_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => loadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_follow_up_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => loadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => loadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId]);

  const loadCounts = async () => {
    try {
      // Auto-assign any unassigned tasks first
      await supabase.rpc('auto_assign_unassigned_tasks');

      // My Tasks
      const { count: myTasksCount } = await supabase
        .from('confirmation_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('assigned_to', userId)
        .eq('status', 'pending');

      // Queue Tasks
      const { count: queueTasksCount } = await supabase
        .from('confirmation_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .is('assigned_to', null)
        .eq('status', 'pending');

      // MRR Due
      const { count: mrrDueCount } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'due');

      // Follow Ups (retarget)
      const today = new Date().toISOString().split('T')[0];
      const { count: followUpsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .not('retarget_date', 'is', null)
        .lte('retarget_date', today);

      // Overdue tasks (appointments before today that are still pending/awaiting)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: overdueCount } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments!inner(start_at_utc)', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .in('status', ['pending', 'awaiting_reschedule'])
        .lt('appointment.start_at_utc', todayStart.toISOString());

      // Total pending tasks (all confirmation tasks, excluding closed appointments)
      const { count: totalPendingCount } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments!inner(status, pipeline_stage)', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .not('appointment.status', 'in', '(CLOSED,CANCELLED,RESCHEDULED)')
        .not('appointment.pipeline_stage', 'in', '(won,closed,cancelled,no_show,lost,rescheduled,disqualified)');

      // Unassigned appointments
      const { count: unassignedCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .is('setter_id', null)
        .eq('status', 'NEW');

      setCounts({
        myTasks: myTasksCount || 0,
        queueTasks: queueTasksCount || 0,
        mrrDue: mrrDueCount || 0,
        followUps: followUpsCount || 0,
        overdue: overdueCount || 0,
        totalPendingTasks: totalPendingCount || 0,
        unassigned: unassignedCount || 0,
      });
    } catch (error) {
      console.error('Error loading tab counts:', error);
    }
  };

  return counts;
}
