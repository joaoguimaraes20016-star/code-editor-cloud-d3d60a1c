import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, RefreshCw, Clock, UserPlus, CalendarCheck, CalendarX, Loader2, CalendarClock, AlertCircle, CheckCircle2, Star, RotateCcw, AlertTriangle, Eye } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, startOfDay, differenceInMinutes } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RescheduleWithLinkDialog } from './RescheduleWithLinkDialog';
import { FollowUpDialog } from './FollowUpDialog';
import { toast } from "sonner";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";
import { useAuth } from '@/hooks/useAuth';

interface UnifiedTasksViewProps {
  teamId: string;
}

interface UnifiedTask {
  id: string;
  type: 'call_confirmation' | 'reschedule' | 'follow_up' | 'mrr_payment';
  title: string;
  dueDate: Date;
  appointmentDate?: Date;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  leadName: string;
  details: string;
  appointmentId?: string;
  scheduleId?: string;
  taskType?: string;
  followUpReason?: string;
  mrrAmount?: number;
  follow_up_sequence?: number;
  total_follow_ups?: number;
  pipeline_stage?: string;
  is_overdue?: boolean;
  noAnswerCount?: number;
  // Rebooking context
  rebooking_type?: 'returning_client' | 'win_back' | 'rebooking' | 'reschedule' | null;
  original_booking_date?: string | null;
  previous_status?: string | null;
  original_appointment_id?: string | null;
  rescheduled_to_appointment_id?: string | null;
  setter_notes?: string | null;
}

export function UnifiedTasksView({ teamId }: UnifiedTasksViewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [filterTimeRange, setFilterTimeRange] = useState<string>("all");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [teamOverdueThreshold, setTeamOverdueThreshold] = useState<number>(30);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    setterId: string | null;
    appointmentName: string;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [rescheduleWithLinkDialog, setRescheduleWithLinkDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
    rescheduleUrl: string;
  } | null>(null);
  const [detailView, setDetailView] = useState<{
    open: boolean;
    task: any;
  } | null>(null);
  const [followUpDialog, setFollowUpDialog] = useState<{
    open: boolean;
    appointmentId: string;
    taskId: string;
    dealName: string;
  } | null>(null);
  const [originalAppointmentModal, setOriginalAppointmentModal] = useState<{
    open: boolean;
    appointment: any;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`unified-tasks-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mrr_follow_up_tasks', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, filterStatus]);

  const loadData = async () => {
    await Promise.all([loadTasks(), loadTeamMembers(), loadAppointments()]);
  };

  const loadTeamMembers = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(full_name)')
      .eq('team_id', teamId)
      .eq('is_active', true);

    setTeamMembers(data || []);
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("team_id", teamId)
      .order("start_at_utc", { ascending: false })
      .limit(200);
    
    if (data) setAppointments(data);
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const unifiedTasks: UnifiedTask[] = [];

      // Load team's overdue threshold
      const { data: teamData } = await supabase
        .from('teams')
        .select('overdue_threshold_minutes')
        .eq('id', teamId)
        .single();
      
      if (teamData?.overdue_threshold_minutes) {
        setTeamOverdueThreshold(teamData.overdue_threshold_minutes);
      }

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

      // Fetch tasks based on status filter
      const statusFilter = filterStatus === 'all' 
        ? ['pending', 'in_progress', 'completed'] 
        : [filterStatus];

      // Load confirmation tasks with appointment dates
      if (filterStatus === 'pending' || filterStatus === 'all' || filterStatus === 'completed') {
        const { data: confirmTasks } = await supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(start_at_utc, lead_name, lead_email, lead_phone, rescheduled_to_appointment_id, pipeline_stage, rebooking_type, original_booking_date, previous_status, original_appointment_id, setter_notes)')
          .eq('team_id', teamId)
          .in('status', statusFilter);
        
        // Helper to count no-answer attempts
        const countNoAnswerAttempts = (attempts: any[]): number => {
          if (!Array.isArray(attempts)) return 0;
          return attempts.filter(a => a?.type === 'no_answer').length;
        };

        // Auto-complete tasks where client already rescheduled
        if (confirmTasks) {
          for (const task of confirmTasks) {
            const appointment = task.appointment as any;
            if (appointment?.rescheduled_to_appointment_id && 
                (task.task_type === 'follow_up' || task.task_type === 'reschedule') &&
                task.status === 'pending') {
              
              await supabase
                .from('confirmation_tasks')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', task.id);
              
              task.status = 'completed';
            }
          }
        }

        // Fetch profile names separately
        const assignedUserIds = [...new Set((confirmTasks || []).filter(t => t.assigned_to).map(t => t.assigned_to!))];
        const profilesMap = new Map<string, string>();
        
        if (assignedUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignedUserIds);
          
          (profiles || []).forEach(p => profilesMap.set(p.id, p.full_name || 'Unknown'));
        }

        (confirmTasks || []).forEach(task => {
          const taskType = task.task_type as 'call_confirmation' | 'reschedule' | 'follow_up';
          const appointment = task.appointment as any;
          const attempts = task.confirmation_attempts as any[];
          
          unifiedTasks.push({
            id: task.id,
            type: taskType === 'call_confirmation' ? 'call_confirmation' : taskType === 'reschedule' ? 'reschedule' : 'follow_up',
            taskType: task.task_type,
            title: task.task_type === 'call_confirmation' ? 'Call Confirmation' : 
                   task.task_type === 'reschedule' ? 'Reschedule' : 'Follow-Up',
            dueDate: task.due_at ? new Date(task.due_at) : now,
            appointmentDate: appointment?.start_at_utc ? new Date(appointment.start_at_utc) : undefined,
            status: task.status || 'pending',
            assignedTo: task.assigned_to,
            assignedToName: task.assigned_to ? profilesMap.get(task.assigned_to) || null : null,
            leadName: appointment?.lead_name || 'Loading...',
            details: task.follow_up_reason || '',
            appointmentId: task.appointment_id,
            followUpReason: task.follow_up_reason,
            follow_up_sequence: task.follow_up_sequence || 1,
            total_follow_ups: task.pipeline_stage ? totalsByStage[task.pipeline_stage] : undefined,
            pipeline_stage: task.pipeline_stage,
            is_overdue: task.is_overdue,
            noAnswerCount: countNoAnswerAttempts(attempts),
            // Rebooking context from appointment
            rebooking_type: appointment?.rebooking_type as UnifiedTask['rebooking_type'],
            original_booking_date: appointment?.original_booking_date,
            previous_status: appointment?.previous_status,
            original_appointment_id: appointment?.original_appointment_id,
            rescheduled_to_appointment_id: appointment?.rescheduled_to_appointment_id,
            setter_notes: appointment?.setter_notes,
          });
        });
      }

      // Load MRR payment tasks
      if (filterStatus === 'pending' || filterStatus === 'all') {
        const { data: mrrTasks } = await supabase
          .from('mrr_follow_up_tasks')
          .select('*, schedule:mrr_schedules(*)')
          .eq('team_id', teamId)
          .eq('status', 'due');

        mrrTasks?.forEach(task => {
          const dueDate = new Date(task.due_date);
          
          unifiedTasks.push({
            id: task.id,
            type: 'mrr_payment',
            title: 'MRR Payment',
            dueDate,
            status: 'pending',
            assignedTo: null,
            assignedToName: null,
            leadName: (task.schedule as any)?.client_name || 'Unknown',
            details: `$${(task.schedule as any)?.mrr_amount || 0}/month`,
            scheduleId: task.mrr_schedule_id,
            mrrAmount: (task.schedule as any)?.mrr_amount || 0,
          });
        });
      }

      // Deduplicate tasks by lead email/phone
      const tasksByLead = new Map<string, UnifiedTask>();
      
      unifiedTasks.forEach(task => {
        const appointment = appointments.find(apt => apt.id === task.appointmentId);
        if (!appointment && !task.scheduleId) {
          tasksByLead.set(task.id, task);
          return;
        }
        
        const leadKey = appointment 
          ? (appointment.lead_email || appointment.lead_phone || '').toLowerCase().trim()
          : task.id;
          
        if (!leadKey || leadKey === '') {
          tasksByLead.set(task.id, task);
          return;
        }
        
        const existingTask = tasksByLead.get(leadKey);
        
        if (!existingTask) {
          tasksByLead.set(leadKey, task);
        } else {
          // Keep the task with earliest due date (most urgent)
          if (task.dueDate < existingTask.dueDate) {
            tasksByLead.set(leadKey, task);
          }
        }
      });
      
      const deduplicatedTasks = Array.from(tasksByLead.values());
      setTasks(deduplicatedTasks);
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeBadge = (task: UnifiedTask, isMRRTask?: boolean) => {
    if (isMRRTask) {
      return (
        <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <RefreshCw className="h-3 w-3 mr-1" />
          MRR Payment
        </Badge>
      );
    }
    
    switch (task.type) {
      case 'call_confirmation':
        return (
          <Badge className="text-xs bg-blue-500 hover:bg-blue-600 text-white border-0">
            <Phone className="h-3 w-3 mr-1" />
            Call Confirmation
          </Badge>
        );
      case 'follow_up':
        const current = task.follow_up_sequence || 1;
        const total = task.total_follow_ups || 1;
        const isOverdue = task.is_overdue;
        
        const label = isOverdue 
          ? `⚠️ Overdue ${current}/${total}`
          : `Follow-Up ${current}/${total}`;
        
        return (
          <Badge className={cn(
            "text-xs border-0",
            isOverdue 
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
              : "bg-purple-500 hover:bg-purple-600 text-white"
          )}>
            <RefreshCw className="h-3 w-3 mr-1" />
            {label}
          </Badge>
        );
      case 'reschedule':
        return (
          <Badge className="text-xs bg-amber-500 hover:bg-amber-600 text-white border-0">
            <Calendar className="h-3 w-3 mr-1" />
            Reschedule
          </Badge>
        );
      default:
        return null;
    }
  };

  const viewOriginalAppointment = async (originalAppointmentId: string) => {
    setOriginalAppointmentModal({ open: true, appointment: null, loading: true });
    
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', originalAppointmentId)
      .single();
    
    setOriginalAppointmentModal({ open: true, appointment, loading: false });
  };

  const viewNewAppointment = async (newAppointmentId: string) => {
    setOriginalAppointmentModal({ open: true, appointment: null, loading: true });
    
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', newAppointmentId)
      .single();
    
    setOriginalAppointmentModal({ open: true, appointment, loading: false });
  };

  const formatTime = (utcDate: string) => {
    try {
      const dateObj = parseISO(utcDate);
      const formattedTime = format(dateObj, 'h:mm a');
      const timezone = new Intl.DateTimeFormat('en-US', { 
        timeZoneName: 'short' 
      }).formatToParts(dateObj).find(part => part.type === 'timeZoneName')?.value || '';
      return `${formattedTime} ${timezone}`.trim();
    } catch {
      return utcDate;
    }
  };

  const handleConfirmTask = async () => {
    if (!confirmDialog) return;

    try {
      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_confirmations: 1
        })
        .eq('id', confirmDialog.taskId);

      if (error) throw error;

      const { error: aptError } = await supabase
        .from('appointments')
        .update({ status: 'CONFIRMED' })
        .eq('id', confirmDialog.appointmentId);

      if (aptError) throw aptError;

      toast.success('Task confirmed successfully');
      setConfirmDialog(null);
      setConfirmNote('');
      loadData();
    } catch (error) {
      console.error('Error confirming task:', error);
      toast.error('Failed to confirm task');
    }
  };

  const handleNoShow = async (taskId: string, appointmentId: string) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;

    setFollowUpDialog({
      open: true,
      appointmentId,
      taskId,
      dealName: apt.lead_name
    });
  };

  const handleFollowUpConfirm = async (followUpDate: Date, reason: string) => {
    if (!followUpDialog) return;

    try {
      // Update appointment
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'CANCELLED',
          pipeline_stage: 'no_show',
          retarget_date: format(followUpDate, "yyyy-MM-dd"),
          retarget_reason: reason
        })
        .eq('id', followUpDialog.appointmentId);

      if (error) throw error;

      // Cleanup old confirmation tasks
      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: followUpDialog.appointmentId,
        p_reason: 'No-show with follow-up scheduled'
      });

      // Create new follow-up task
      await supabase.rpc("create_task_with_assignment", {
        p_team_id: teamId,
        p_appointment_id: followUpDialog.appointmentId,
        p_task_type: "follow_up",
        p_follow_up_date: format(followUpDate, "yyyy-MM-dd"),
        p_follow_up_reason: reason,
        p_reschedule_date: null
      });

      toast.success("Follow-up scheduled successfully");
      setFollowUpDialog(null);
      loadData();
    } catch (error: any) {
      console.error("Error scheduling follow-up:", error);
      toast.error(error.message || "Failed to schedule follow-up");
    }
  };

  const handleConfirmMRRPayment = async (taskId: string, mrrAmount: number) => {
    try {
      const { error: taskError } = await supabase
        .from('mrr_follow_up_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      toast.success('MRR payment confirmed');
      loadData();
    } catch (error) {
      console.error('Error confirming MRR payment:', error);
      toast.error('Failed to confirm MRR payment');
    }
  };

  const handleNoAnswerRetry = async (taskId: string, appointmentId: string) => {
    try {
      // Get team's retry minutes setting
      const { data: teamSettings } = await supabase
        .from('teams')
        .select('no_answer_retry_minutes')
        .eq('id', teamId)
        .single();
      
      const retryMinutes = teamSettings?.no_answer_retry_minutes ?? 30;

      // Get appointment time to check for overlap
      const apt = appointments.find(a => a.id === appointmentId);
      const appointmentTime = apt?.start_at_utc ? new Date(apt.start_at_utc) : null;
      
      // Get current task data
      const { data: task, error: fetchError } = await supabase
        .from('confirmation_tasks')
        .select('confirmation_attempts')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      // Record the no-answer attempt
      const newAttempt = {
        timestamp: new Date().toISOString(),
        confirmed_by: user?.id,
        notes: 'No Answer',
        type: 'no_answer'
      };

      const attempts = [...(Array.isArray(task?.confirmation_attempts) ? task.confirmation_attempts : []), newAttempt];
      const newDueAt = new Date(Date.now() + retryMinutes * 60 * 1000);

      // Check if retry would overlap with appointment time
      if (appointmentTime && newDueAt >= appointmentTime) {
        // Just log the attempt without rescheduling
        const { error } = await supabase
          .from('confirmation_tasks')
          .update({
            confirmation_attempts: attempts,
          })
          .eq('id', taskId);

        if (error) throw error;

        // Log activity
        await supabase.from('activity_logs').insert({
          team_id: teamId,
          appointment_id: appointmentId,
          actor_id: user?.id,
          actor_name: 'Team Member',
          action_type: 'No Answer',
          note: 'No answer - retry skipped (too close to appointment)'
        });

        toast.warning('No answer recorded - retry skipped', {
          description: 'Appointment is too soon to schedule another attempt'
        });

        loadData();
        return;
      }

      // Update task with new due_at
      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          confirmation_attempts: attempts,
          due_at: newDueAt.toISOString(),
          is_overdue: false
        })
        .eq('id', taskId);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        team_id: teamId,
        appointment_id: appointmentId,
        actor_id: user?.id,
        actor_name: 'Team Member',
        action_type: 'No Answer',
        note: `No answer - retry scheduled for ${format(newDueAt, 'h:mm a')}`
      });

      toast.success(`No answer - Call back at ${format(newDueAt, 'h:mm a')}`, {
        description: 'Task will reappear when due'
      });

      loadData();
    } catch (error) {
      console.error('Error handling no answer:', error);
      toast.error('Failed to record no answer');
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterType !== "all" && task.type !== filterType) return false;
    if (filterAssignee !== "all") {
      if (filterAssignee === "unassigned" && task.assignedTo !== null) return false;
      if (filterAssignee !== "unassigned" && task.assignedTo !== filterAssignee) return false;
    }
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    
    // Apply time range filter
    if (filterTimeRange !== "all" && task.appointmentDate) {
      const taskDate = new Date(task.appointmentDate);
      const now = new Date();
      const daysDiff = Math.ceil((taskDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (filterTimeRange === "today" && !isToday(taskDate)) return false;
      if (filterTimeRange === "week" && (daysDiff < 0 || daysDiff > 7)) return false;
      if (filterTimeRange === "overdue" && daysDiff >= 0) return false;
    }
    
    return true;
  });

  // Group tasks by date - separate completed from active tasks
  const completedTasks = filteredTasks.filter(task => task.status === 'completed');
  const activeTasks = filteredTasks.filter(task => task.status !== 'completed');
  
  const overdueTasks: UnifiedTask[] = [];
  const dueTodayTasks: UnifiedTask[] = [];
  const tomorrowTasks: UnifiedTask[] = [];
  const thisWeekTasks: UnifiedTask[] = [];
  const futureTasks: UnifiedTask[] = [];

  activeTasks.forEach(task => {
    try {
      // ALWAYS use due date for categorization to show when task is actually due
      const categorizationDate = task.dueDate;
      
      const now = new Date();
      const startOfNextWeek = startOfDay(new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)));
      
      // Check if task is overdue based on task type
      let isOverdue = false;
      
      if (task.type === 'call_confirmation' && task.appointmentDate) {
        // For confirmations, overdue = appointment time + grace period has passed
        const appointmentTime = new Date(task.appointmentDate);
        const overdueThresholdMs = (teamOverdueThreshold || 30) * 60 * 1000;
        const appointmentDeadline = new Date(appointmentTime.getTime() + overdueThresholdMs);
        isOverdue = now > appointmentDeadline;
      } else {
        // For follow-ups, reschedules, MRR - overdue = due date has passed
        isOverdue = categorizationDate < now;
      }
      
      if (isOverdue) {
        overdueTasks.push(task);
      } else if (isToday(categorizationDate)) {
        dueTodayTasks.push(task);
      } else if (isTomorrow(categorizationDate)) {
        tomorrowTasks.push(task);
      } else if (categorizationDate < startOfNextWeek) {
        thisWeekTasks.push(task);
      } else {
        futureTasks.push(task);
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      futureTasks.push(task);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTaskCard = (task: UnifiedTask, isUpcoming: boolean = false) => {
    const apt = appointments.find(a => a.id === task.appointmentId);
    const isMRRTask = task.scheduleId != null;
    
    // Check if task is overdue based on task type
    const now = new Date();
    let isOverdue = false;
    
    if (task.type === 'call_confirmation' && task.appointmentDate) {
      const appointmentTime = new Date(task.appointmentDate);
      const overdueThresholdMs = (teamOverdueThreshold || 30) * 60 * 1000;
      const appointmentDeadline = new Date(appointmentTime.getTime() + overdueThresholdMs);
      isOverdue = now > appointmentDeadline;
    } else {
      // For follow-ups, reschedules, MRR - check due date
      isOverdue = task.dueDate < now;
    }
    
    // Check if this is a follow-up from an overdue confirmation
    const isFollowUpFromOverdue = 
      (task.type === 'follow_up' || task.type === 'reschedule') && 
      task.appointmentDate && 
      new Date(task.appointmentDate) < now;
    
    const baseTaskColor = isMRRTask ? 'border-emerald-200 dark:border-emerald-900'
      : task.type === 'call_confirmation' ? 'border-blue-200 dark:border-blue-900' 
      : task.type === 'follow_up' ? 'border-purple-200 dark:border-purple-900'
      : task.type === 'reschedule' ? 'border-amber-200 dark:border-amber-900'
      : '';

    const taskColor = isOverdue
      ? 'border-red-600 bg-gradient-to-r from-red-500/10 to-transparent'
      : isUpcoming 
        ? `${baseTaskColor} border-l-4 border-l-orange-500` 
        : baseTaskColor;

    // For MRR tasks, use the lead name from the task itself
    const displayName = isMRRTask ? task.leadName : (apt?.lead_name || task.leadName);
    const displayEmail = apt?.lead_email || '';

    return (
      <Card key={task.id} className={cn("bg-card card-hover", taskColor)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-semibold">{displayName}</p>
              {displayEmail && <p className="text-sm text-muted-foreground">{displayEmail}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {apt?.event_type_name && (
                  <Badge variant="outline" className="text-xs">
                    {apt.event_type_name}
                  </Badge>
                )}
                {getTaskTypeBadge(task, isMRRTask)}
                {apt?.rescheduled_to_appointment_id && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Client Rescheduled
                  </Badge>
                )}
                {isFollowUpFromOverdue && (
                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    From Overdue Confirmation
                  </Badge>
                )}
                {task.assignedToName && (
                  <Badge variant="secondary" className="text-xs">
                    Assigned to {task.assignedToName}
                  </Badge>
                )}
                {task.noAnswerCount && task.noAnswerCount > 0 && (
                  <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-400">
                    <Phone className="h-3 w-3 mr-1" />
                    {task.noAnswerCount} attempt{task.noAnswerCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {/* Rebooking type badges - bright colors that pop */}
                {task.rebooking_type === 'returning_client' && (
                  <Badge className="text-xs bg-emerald-500 text-white border-0 font-bold shadow-sm shadow-emerald-500/30">
                    <Star className="h-3 w-3 mr-1" />
                    🎉 Returning Client
                  </Badge>
                )}
                {task.rebooking_type === 'win_back' && (
                  <Badge className="text-xs bg-blue-500 text-white border-0 font-bold shadow-sm shadow-blue-500/30">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    🔄 Win-Back
                  </Badge>
                )}
                {task.rebooking_type === 'rebooking' && (
                  <Badge className="text-xs bg-cyan-500 text-white border-0 font-bold shadow-sm shadow-cyan-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    ⚠️ Rebooked
                  </Badge>
                )}
                {task.rebooking_type === 'reschedule' && (
                  <Badge className="text-xs bg-cyan-500 text-white border-0 font-bold shadow-sm shadow-cyan-500/30">
                    <CalendarClock className="h-3 w-3 mr-1" />
                    📅 Rescheduled
                  </Badge>
                )}
                {/* Badge for ORIGINAL appointments that lead rescheduled from */}
                {task.rescheduled_to_appointment_id && !task.rebooking_type && (
                  <Badge className="text-xs bg-orange-500 text-white border-0 font-bold shadow-sm shadow-orange-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    📅 Lead Rescheduled
                  </Badge>
                )}
              </div>
              {/* Rebooking warning message - BRIGHT and prominent with View Original link */}
              {task.rebooking_type && (
                <div className={cn(
                  "text-sm p-3 rounded-lg border-l-4 mt-2 font-semibold shadow-sm",
                  task.rebooking_type === 'returning_client' && "bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
                  task.rebooking_type === 'win_back' && "bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
                  (task.rebooking_type === 'rebooking' || task.rebooking_type === 'reschedule') && "bg-cyan-100 border-cyan-500 text-cyan-900 dark:bg-cyan-900/40 dark:text-cyan-100",
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {task.rebooking_type === 'returning_client' && (
                        <>🎉 <strong>RETURNING CLIENT</strong> — Previously closed{task.original_booking_date ? ` on ${format(new Date(task.original_booking_date), 'MMM d')}` : ''}. Find out why they're booking again!</>
                      )}
                      {task.rebooking_type === 'win_back' && (
                        <>🔄 <strong>WIN-BACK</strong> — Was {task.previous_status?.replace('_', ' ')}. They're giving you another chance!</>
                      )}
                      {task.rebooking_type === 'rebooking' && (
                        <>⚠️ <strong>REBOOKED</strong> — Previously scheduled{task.original_booking_date ? ` for ${format(new Date(task.original_booking_date), 'MMM d')}` : ''}. Confirm if intentional!</>
                      )}
                      {task.rebooking_type === 'reschedule' && (
                        <>📅 <strong>RESCHEDULED</strong> — Previously scheduled{task.original_booking_date ? ` for ${format(new Date(task.original_booking_date), 'MMM d')}` : ''}. Confirm if intentional!</>
                      )}
                    </span>
                    {task.original_appointment_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 bg-white/50 hover:bg-white border-current shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewOriginalAppointment(task.original_appointment_id!);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Original
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {/* Warning for ORIGINAL appointments that have been rescheduled */}
              {task.rescheduled_to_appointment_id && !task.rebooking_type && (
                <div className="text-sm p-3 rounded-lg border-l-4 mt-2 font-semibold shadow-sm bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      📅 <strong>LEAD RESCHEDULED</strong> — This lead booked a new appointment. See the new booking details!
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 bg-white/50 hover:bg-white border-current shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewNewAppointment(task.rescheduled_to_appointment_id!);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View New Booking
                    </Button>
                  </div>
                </div>
              )}
              {/* Show follow_up_reason warning (from webhook override) */}
              {task.followUpReason && task.followUpReason.includes('REBOOKED') && !task.rebooking_type && (
                <div className="text-sm p-3 rounded-lg border-l-4 mt-2 font-semibold shadow-sm bg-cyan-100 border-cyan-500 text-cyan-900 dark:bg-cyan-900/40 dark:text-cyan-100">
                  {task.followUpReason}
                </div>
              )}
              {task.details && !task.rebooking_type && !task.followUpReason?.includes('REBOOKED') && (
                <p className="text-xs text-muted-foreground border-l-2 pl-2 mt-1">
                  {task.details}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                {getTaskTypeBadge(task, isMRRTask)}
                <Clock className="h-5 w-5" />
                <span className={isUpcoming ? "text-lg font-bold text-orange-600 dark:text-orange-400" : "text-lg font-bold"}>
                  Due {formatDateTimeWithTimezone(task.dueDate, 'MMM d, h:mm a')}
                </span>
              </div>
              {task.appointmentDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span className="text-base font-bold">
                    Appt: {formatDateTimeWithTimezone(task.appointmentDate, 'MMM d, h:mm a')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setDetailView({ open: true, task: { ...task, appointment: apt } })}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              View Details
            </Button>
            {isMRRTask ? (
              <>
                <Button 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleConfirmMRRPayment(task.id, task.mrrAmount || 0)}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Confirm Payment
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => toast.info('Mark as payment failed')}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Payment Failed
                </Button>
              </>
            ) : task.type === 'call_confirmation' ? (
              <>
                <Button 
                  size="sm"
                  onClick={() => setConfirmDialog({ 
                    open: true, 
                    taskId: task.id, 
                    appointmentId: apt?.id || '',
                    setterId: apt?.setter_id || null,
                    appointmentName: displayName
                  })}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => apt && handleNoAnswerRetry(task.id, apt.id)}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  No Answer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (apt?.reschedule_url) {
                      setRescheduleWithLinkDialog({
                        open: true,
                        taskId: task.id,
                        appointmentId: apt.id,
                        appointmentName: displayName,
                        rescheduleUrl: apt.reschedule_url
                      });
                    } else {
                      toast.error("No reschedule link available");
                    }
                  }}
                >
                  <CalendarClock className="h-4 w-4 mr-1" />
                  Reschedule
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => apt && handleNoShow(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  No-Show
                </Button>
              </>
            ) : task.type === 'follow_up' ? (
              <>
                {(apt?.pipeline_stage === 'no_show' || apt?.pipeline_stage === 'canceled') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (apt?.reschedule_url) {
                        setRescheduleWithLinkDialog({
                          open: true,
                          taskId: task.id,
                          appointmentId: apt.id,
                          appointmentName: displayName,
                          rescheduleUrl: apt.reschedule_url
                        });
                      } else {
                        toast.error("No reschedule link available");
                      }
                    }}
                  >
                    <CalendarClock className="h-4 w-4 mr-1" />
                    Reschedule
                  </Button>
                )}
                <Button 
                  size="sm"
                  onClick={() => setConfirmDialog({ 
                    open: true, 
                    taskId: task.id, 
                    appointmentId: apt?.id || '',
                    setterId: apt?.setter_id || null,
                    appointmentName: displayName
                  })}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Reconnected
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => apt && handleNoShow(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Still No Response
                </Button>
              </>
            ) : task.type === 'reschedule' ? (
              <>
                {(apt?.pipeline_stage === 'no_show' || apt?.pipeline_stage === 'canceled') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (apt?.reschedule_url) {
                        setRescheduleWithLinkDialog({
                          open: true,
                          taskId: task.id,
                          appointmentId: apt.id,
                          appointmentName: displayName,
                          rescheduleUrl: apt.reschedule_url
                        });
                      } else {
                        toast.error("No reschedule link available");
                      }
                    }}
                  >
                    <CalendarClock className="h-4 w-4 mr-1" />
                    Reschedule
                  </Button>
                )}
                <Button 
                  size="sm"
                  onClick={() => setConfirmDialog({ 
                    open: true, 
                    taskId: task.id, 
                    appointmentId: apt?.id || '',
                    setterId: apt?.setter_id || null,
                    appointmentName: displayName
                  })}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Rescheduled
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => apt && handleNoShow(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Still No Response
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-5 w-5" />
        <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call_confirmation">Call Confirmation</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="mrr_payment">MRR Payment</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {(member.profiles as any)?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="awaiting_reschedule">Awaiting Reschedule</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTimeRange} onValueChange={setFilterTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No tasks found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {overdueTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Overdue ({overdueTasks.length})
              </h3>
              {overdueTasks.map((task) => renderTaskCard(task))}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Due Today ({dueTodayTasks.length})
            </h3>
            {dueTodayTasks.length > 0 ? (
              dueTodayTasks.map((task) => renderTaskCard(task))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">None due today</p>
                </CardContent>
              </Card>
            )}
          </div>

          {tomorrowTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Tomorrow ({tomorrowTasks.length})
              </h3>
              <div className="border-l-4 border-orange-500 pl-4 space-y-3">
                {tomorrowTasks.map((task) => renderTaskCard(task, true))}
              </div>
            </div>
          )}

          {thisWeekTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                This Week ({thisWeekTasks.length})
              </h3>
              {thisWeekTasks.map((task) => renderTaskCard(task, true))}
            </div>
          )}

          {futureTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Future ({futureTasks.length})
              </h3>
              <div className="border-l-4 border-orange-500 pl-4 space-y-3">
                {futureTasks.map((task) => renderTaskCard(task, true))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Completed ({completedTasks.length})
              </h3>
              {completedTasks.map((task) => renderTaskCard(task))}
            </div>
          )}
        </>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Task Completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this task as confirmed for {confirmDialog?.appointmentName}?
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm-note">Add a note (optional)</Label>
              <Input
                id="confirm-note"
                placeholder="Add any additional notes..."
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTask}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule with Link Dialog */}
      {rescheduleWithLinkDialog && (
        <RescheduleWithLinkDialog
          open={rescheduleWithLinkDialog.open}
          onOpenChange={(open) => !open && setRescheduleWithLinkDialog(null)}
          appointmentId={rescheduleWithLinkDialog.appointmentId}
          appointmentName={rescheduleWithLinkDialog.appointmentName}
          rescheduleUrl={rescheduleWithLinkDialog.rescheduleUrl}
          onConfirm={async (reason: string, notes?: string) => {
            const { error } = await supabase
              .from('confirmation_tasks')
              .update({ 
                status: 'awaiting_reschedule',
                reschedule_reason: reason,
                reschedule_notes: notes || null
              })
              .eq('id', rescheduleWithLinkDialog.taskId);
            
            if (error) throw error;
            
            setRescheduleWithLinkDialog(null);
            loadData();
          }}
        />
      )}

      {/* Detail View Dialog */}
      <Dialog open={detailView?.open || false} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {detailView?.task && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Lead Name</Label>
                  <p className="font-medium">{detailView.task.leadName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{detailView.task.appointment?.lead_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{detailView.task.appointment?.lead_phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Event Type</Label>
                  <p className="font-medium">{detailView.task.appointment?.event_type_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge>{detailView.task.appointment?.status || detailView.task.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Task Type</Label>
                  {getTaskTypeBadge(detailView.task, !!detailView.task.scheduleId)}
                </div>
              </div>
              {detailView.task.details && (
                <div>
                  <Label className="text-muted-foreground">Details</Label>
                  <p className="mt-1">{detailView.task.details}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailView(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-Up Dialog */}
      {followUpDialog && (
        <FollowUpDialog
          open={followUpDialog.open}
          onOpenChange={(open) => !open && setFollowUpDialog(null)}
          onConfirm={handleFollowUpConfirm}
          dealName={followUpDialog.dealName}
          stage="no_show"
          teamId={teamId}
        />
      )}

      {/* Original/New Appointment Modal */}
      <Dialog 
        open={originalAppointmentModal?.open || false} 
        onOpenChange={(open) => !open && setOriginalAppointmentModal(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </DialogTitle>
          </DialogHeader>
          {originalAppointmentModal?.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : originalAppointmentModal?.appointment ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Lead Name</Label>
                  <p className="font-semibold">{originalAppointmentModal.appointment.lead_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium text-sm">{originalAppointmentModal.appointment.lead_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="font-medium text-sm">{originalAppointmentModal.appointment.lead_phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant="outline">{originalAppointmentModal.appointment.status}</Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">Scheduled For</Label>
                  <p className="font-semibold text-primary">
                    {originalAppointmentModal.appointment.start_at_utc 
                      ? formatDateTimeWithTimezone(new Date(originalAppointmentModal.appointment.start_at_utc), 'EEEE, MMM d, yyyy h:mm a')
                      : 'N/A'}
                  </p>
                </div>
                {originalAppointmentModal.appointment.event_type_name && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Event Type</Label>
                    <p className="font-medium text-sm">{originalAppointmentModal.appointment.event_type_name}</p>
                  </div>
                )}
                {originalAppointmentModal.appointment.setter_name && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Setter</Label>
                    <p className="font-medium text-sm">{originalAppointmentModal.appointment.setter_name}</p>
                  </div>
                )}
                {originalAppointmentModal.appointment.closer_name && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Closer</Label>
                    <p className="font-medium text-sm">{originalAppointmentModal.appointment.closer_name}</p>
                  </div>
                )}
              </div>
              {originalAppointmentModal.appointment.setter_notes && (
                <div className="border-t pt-3">
                  <Label className="text-muted-foreground text-xs">Setter Notes</Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">{originalAppointmentModal.appointment.setter_notes}</p>
                </div>
              )}
              {originalAppointmentModal.appointment.pipeline_stage && (
                <div>
                  <Label className="text-muted-foreground text-xs">Pipeline Stage</Label>
                  <Badge className="mt-1">{originalAppointmentModal.appointment.pipeline_stage}</Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Appointment not found</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOriginalAppointmentModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
