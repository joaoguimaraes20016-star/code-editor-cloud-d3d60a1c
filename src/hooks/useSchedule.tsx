import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAppointmentAssignedToUser, isTaskAssignedToUser } from "@/lib/assignment";

export interface ScheduleAppointment {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  start_at_utc: string;
  status: string;
  closer_id: string | null;
  closer_name: string | null;
  setter_id: string | null;
  setter_name: string | null;
  event_type_name: string | null;
  pipeline_stage: string | null;
  meeting_link: string | null;
}

export interface ScheduleTask {
  id: string;
  task_type: string;
  status: string;
  due_at: string;
  assigned_to: string | null;
  assigned_role: string | null;
  appointment_id: string;
  follow_up_reason: string | null;
  pipeline_stage: string | null;
  appointment?: {
    lead_name: string;
    lead_email: string;
    lead_phone: string | null;
    start_at_utc: string;
  };
  assignee_name?: string;
}

/**
 * Hook to fetch the current user's schedule (appointments and tasks).
 * 
 * ASSIGNMENT LOGIC:
 * - Appointments: Fetched where user is either setter_id OR closer_id
 * - Tasks: Fetched where assigned_to equals the user's ID
 * 
 * Uses centralized assignment helpers for filtering.
 */
export function useMySchedule(teamId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-schedule", teamId, userId],
    queryFn: async () => {
      if (!teamId || !userId) return { appointments: [], tasks: [] };
      
      const now = new Date().toISOString();
      
      // Fetch appointments where user is closer or setter
      // Uses Supabase OR filter which maps to: closer_id = userId OR setter_id = userId
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, lead_name, lead_email, lead_phone, start_at_utc, status, closer_id, closer_name, setter_id, setter_name, event_type_name, pipeline_stage, meeting_link")
        .eq("team_id", teamId)
        .or(`closer_id.eq.${userId},setter_id.eq.${userId}`)
        .gte("start_at_utc", now)
        .not("status", "in", "(CLOSED,CANCELLED)")
        .order("start_at_utc", { ascending: true });
      
      if (appointmentsError) throw appointmentsError;
      
      // Fetch tasks assigned to user
      // Task assignment uses the assigned_to field on confirmation_tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("confirmation_tasks")
        .select(`
          id, task_type, status, due_at, assigned_to, assigned_role, appointment_id, follow_up_reason, pipeline_stage,
          appointment:appointments!inner(lead_name, lead_email, lead_phone, start_at_utc)
        `)
        .eq("team_id", teamId)
        .eq("assigned_to", userId)
        .eq("status", "pending")
        .order("due_at", { ascending: true });
      
      if (tasksError) throw tasksError;
      
      return {
        appointments: appointments as ScheduleAppointment[],
        tasks: tasks as ScheduleTask[]
      };
    },
    enabled: !!teamId && !!userId,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to fetch the entire team's schedule (all appointments and tasks).
 * 
 * ASSIGNMENT LOGIC:
 * - Appointments: Fetched for the entire team, includes setter/closer info for display
 * - Tasks: Fetched for entire team, enriched with assignee names from profiles
 * 
 * This is used for the "Team Schedule" view where admins/managers can see all activity.
 */
export function useTeamSchedule(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-schedule", teamId],
    queryFn: async () => {
      if (!teamId) return { appointments: [], tasks: [] };
      
      const now = new Date().toISOString();
      
      // Fetch all team appointments
      // No user filter - returns all appointments for the team
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, lead_name, lead_email, lead_phone, start_at_utc, status, closer_id, closer_name, setter_id, setter_name, event_type_name, pipeline_stage, meeting_link")
        .eq("team_id", teamId)
        .gte("start_at_utc", now)
        .not("status", "in", "(CLOSED,CANCELLED)")
        .order("start_at_utc", { ascending: true });
      
      if (appointmentsError) throw appointmentsError;
      
      // Fetch all team tasks with assignee info
      // No user filter on assigned_to - returns all pending tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("confirmation_tasks")
        .select(`
          id, task_type, status, due_at, assigned_to, assigned_role, appointment_id, follow_up_reason, pipeline_stage,
          appointment:appointments!inner(lead_name, lead_email, lead_phone, start_at_utc)
        `)
        .eq("team_id", teamId)
        .eq("status", "pending")
        .order("due_at", { ascending: true });
      
      if (tasksError) throw tasksError;
      
      // Fetch assignee names for tasks to display who owns each task
      const assigneeIds = [...new Set(tasks?.filter(t => t.assigned_to).map(t => t.assigned_to))];
      let assigneeMap: Record<string, string> = {};
      
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", assigneeIds);
        
        if (profiles) {
          assigneeMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      // Enrich tasks with assignee display names
      const tasksWithNames = tasks?.map(t => ({
        ...t,
        assignee_name: t.assigned_to ? assigneeMap[t.assigned_to] : "Unassigned"
      })) || [];
      
      return {
        appointments: appointments as ScheduleAppointment[],
        tasks: tasksWithNames as ScheduleTask[]
      };
    },
    enabled: !!teamId,
    refetchInterval: 60000,
  });
}
