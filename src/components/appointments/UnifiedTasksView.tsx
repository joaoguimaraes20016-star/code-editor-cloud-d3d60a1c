import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, RefreshCw, Clock, UserPlus, CalendarCheck, CalendarX, Loader2, CalendarClock, AlertCircle } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, startOfDay, differenceInMinutes } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RescheduleWithLinkDialog } from './RescheduleWithLinkDialog';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
}

export function UnifiedTasksView({ teamId }: UnifiedTasksViewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
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

      // Load confirmation tasks with appointment dates
      if (filterStatus === 'pending' || filterStatus === 'all') {
        const { data: confirmTasks } = await supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(start_at_utc, lead_name)')
          .eq('team_id', teamId)
          .eq('status', 'pending');

        // Fetch profile names separately
        const assignedUserIds = [...new Set(confirmTasks?.filter(t => t.assigned_to).map(t => t.assigned_to))];
        const profilesMap = new Map<string, string>();
        
        if (assignedUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignedUserIds);
          
          profiles?.forEach(p => profilesMap.set(p.id, p.full_name || 'Unknown'));
        }

        confirmTasks?.forEach(task => {
          const taskType = task.task_type as 'call_confirmation' | 'reschedule' | 'follow_up';
          const appointment = task.appointment as any;
          
          unifiedTasks.push({
            id: task.id,
            type: taskType === 'call_confirmation' ? 'call_confirmation' : taskType === 'reschedule' ? 'reschedule' : 'follow_up',
            taskType: task.task_type,
            title: task.task_type === 'call_confirmation' ? 'Call Confirmation' : 
                   task.task_type === 'reschedule' ? 'Reschedule' : 'Follow-Up',
            dueDate: task.due_at ? new Date(task.due_at) : now,
            appointmentDate: appointment?.start_at_utc ? new Date(appointment.start_at_utc) : undefined,
            status: 'pending',
            assignedTo: task.assigned_to,
            assignedToName: task.assigned_to ? profilesMap.get(task.assigned_to) || null : null,
            leadName: appointment?.lead_name || 'Loading...',
            details: task.follow_up_reason || '',
            appointmentId: task.appointment_id,
            followUpReason: task.follow_up_reason,
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

      setTasks(unifiedTasks);
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeBadge = (taskType: string, isMRRTask?: boolean) => {
    if (isMRRTask) {
      return (
        <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <RefreshCw className="h-3 w-3 mr-1" />
          MRR Payment
        </Badge>
      );
    }
    
    switch (taskType) {
      case 'call_confirmation':
        return (
          <Badge className="text-xs bg-blue-500 hover:bg-blue-600 text-white border-0">
            <Phone className="h-3 w-3 mr-1" />
            Call Confirmation
          </Badge>
        );
      case 'follow_up':
        return (
          <Badge className="text-xs bg-purple-500 hover:bg-purple-600 text-white border-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            Follow-Up
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

  const formatTime = (utcDate: string) => {
    try {
      return format(parseISO(utcDate), 'h:mm a');
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
    try {
      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      const { error: aptError } = await supabase
        .from('appointments')
        .update({ status: 'NO_SHOW' })
        .eq('id', appointmentId);

      if (aptError) throw aptError;

      toast.success('Marked as no-show');
      loadData();
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Failed to mark as no-show');
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

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterType !== "all" && task.type !== filterType) return false;
    if (filterAssignee !== "all") {
      if (filterAssignee === "unassigned" && task.assignedTo !== null) return false;
      if (filterAssignee !== "unassigned" && task.assignedTo !== filterAssignee) return false;
    }
    return true;
  });

  // Group tasks by date
  const overdueTasks: UnifiedTask[] = [];
  const dueTodayTasks: UnifiedTask[] = [];
  const tomorrowTasks: UnifiedTask[] = [];
  const upcomingTasks: UnifiedTask[] = [];

  filteredTasks.forEach(task => {
    if (!task.appointmentDate) {
      upcomingTasks.push(task);
      return;
    }
    
    try {
      // Use APPOINTMENT date for grouping, not confirmation due date
      const appointmentTime = new Date(task.appointmentDate);
      const now = new Date();
      
      // Calculate overdue deadline: appointment time + grace period (threshold)
      const overdueThresholdMs = (teamOverdueThreshold || 30) * 60 * 1000;
      const appointmentDeadline = new Date(appointmentTime.getTime() + overdueThresholdMs);
      
      // Task is only overdue if the APPOINTMENT time has passed + grace period
      if (now > appointmentDeadline) {
        overdueTasks.push(task);
      } else if (isToday(appointmentTime)) {
        dueTodayTasks.push(task);
      } else if (isTomorrow(appointmentTime)) {
        tomorrowTasks.push(task);
      } else {
        upcomingTasks.push(task);
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      upcomingTasks.push(task);
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
    const baseTaskColor = isMRRTask ? 'border-emerald-200 dark:border-emerald-900'
      : task.type === 'call_confirmation' ? 'border-blue-200 dark:border-blue-900' 
      : task.type === 'follow_up' ? 'border-purple-200 dark:border-purple-900'
      : task.type === 'reschedule' ? 'border-amber-200 dark:border-amber-900'
      : '';

    const taskColor = isUpcoming 
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
                {getTaskTypeBadge(task.type, isMRRTask)}
                {task.assignedToName && (
                  <Badge variant="secondary" className="text-xs">
                    Assigned to {task.assignedToName}
                  </Badge>
                )}
              </div>
              {task.details && (
                <p className="text-xs text-muted-foreground border-l-2 pl-2 mt-1">
                  {task.details}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className={isUpcoming ? "text-orange-600 dark:text-orange-400 font-medium" : ""}>
                  Due {format(task.dueDate, 'MMM d, h:mm a')}
                </span>
              </div>
              {task.appointmentDate && (
                <span className="text-xs text-muted-foreground">
                  Appt: {format(task.appointmentDate, 'MMM d, h:mm a')}
                </span>
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="all">All</SelectItem>
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

          {upcomingTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming ({upcomingTasks.length})
              </h3>
              <div className="border-l-4 border-orange-500 pl-4 space-y-3">
                {upcomingTasks.map((task) => renderTaskCard(task, true))}
              </div>
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
                notes: notes || reason
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
                  {getTaskTypeBadge(detailView.task.type, !!detailView.task.scheduleId)}
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
    </div>
  );
}
