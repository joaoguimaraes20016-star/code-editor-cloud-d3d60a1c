import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, UserPlus, CalendarCheck, CalendarX, Loader2, AlertCircle, Phone, RefreshCw, CalendarClock } from 'lucide-react';
import { format, parseISO, differenceInMinutes, isToday, isTomorrow, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RescheduleWithLinkDialog } from './RescheduleWithLinkDialog';

interface TaskBasedConfirmTodayProps {
  teamId: string;
}

interface TeamMember {
  user_id: string;
  profiles: {
    full_name: string | null;
  } | null;
}

export function TaskBasedConfirmToday({ teamId }: TaskBasedConfirmTodayProps) {
  const { user } = useAuth();
  const { role: userRole, loading: roleLoading } = useTeamRole(teamId);
  const {
    myTasks,
    loading,
    confirmTask,
    noShowTask,
    rescheduleTask,
    markAwaitingReschedule,
    confirmMRRPayment,
    refreshTasks
  } = useTaskManagement(teamId, user?.id || '', userRole || '');

  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'overdue'>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'offer_owner') {
      loadTeamMembers();
    }
  }, [teamId, userRole]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, profiles(full_name)')
        .eq('team_id', teamId)
        .in('role', ['setter', 'closer', 'admin', 'offer_owner']);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  // Filter tasks by selected member and assignment
  let filteredTasks = myTasks;
  
  // For setters/closers, ONLY show tasks assigned to them
  if (userRole === 'setter' || userRole === 'closer') {
    filteredTasks = myTasks.filter(task => task.assigned_to === user?.id);
  } else if (userRole === 'admin' || userRole === 'offer_owner') {
    // Admins can filter by team member
    filteredTasks = selectedMember === 'all' 
      ? myTasks 
      : myTasks.filter(task => task.assigned_to === selectedMember);
  }

  // If in overdue mode, only show overdue tasks
  if (viewMode === 'overdue') {
    const todayStart = startOfDay(new Date());
    filteredTasks = filteredTasks.filter(task => {
      if (!task.appointment?.start_at_utc) return false;
      try {
        const appointmentDate = parseISO(task.appointment.start_at_utc);
        return appointmentDate < todayStart;
      } catch {
        return false;
      }
    });
  }

  // Group tasks by date (using due_at for confirmation tasks, appointment date for others)
  const groupedTasks = useMemo(() => {
    const overdue: typeof filteredTasks = [];
    const today: typeof filteredTasks = [];
    const tomorrow: typeof filteredTasks = [];
    const upcoming: typeof filteredTasks = [];

    const todayStart = startOfDay(new Date());

    filteredTasks.forEach(task => {
      try {
        // Use due_at if available (for call_confirmation tasks), otherwise fall back to appointment date
        if (task.due_at) {
          const dueDate = parseISO(task.due_at);
          const dueDay = startOfDay(dueDate);

          if (task.is_overdue || dueDay < todayStart) {
            overdue.push(task);
          } else if (isToday(dueDate)) {
            today.push(task);
          } else if (isTomorrow(dueDate)) {
            tomorrow.push(task);
          } else {
            upcoming.push(task);
          }
        } else {
          // Backwards compatibility: use appointment date if no due_at
          if (!task.appointment?.start_at_utc) return;
          
          const appointmentDate = parseISO(task.appointment.start_at_utc);
          const appointmentDay = startOfDay(appointmentDate);

          if (task.is_overdue || appointmentDay < todayStart) {
            overdue.push(task);
          } else if (isToday(appointmentDate)) {
            today.push(task);
          } else if (isTomorrow(appointmentDate)) {
            tomorrow.push(task);
          } else {
            upcoming.push(task);
          }
        }
      } catch (error) {
        console.error('Error parsing date:', error);
        upcoming.push(task); // Default to upcoming if date parse fails
      }
    });

    return { overdue, today, tomorrow, upcoming };
  }, [filteredTasks]);

  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
  } | null>(null);
  const [rescheduleWithLinkDialog, setRescheduleWithLinkDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
    rescheduleUrl: string;
  } | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<Date>();
  const [detailView, setDetailView] = useState<{
    open: boolean;
    task: any;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    setterId: string | null;
    appointmentName: string;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState('');

  const handleRescheduleFollowUp = (taskId: string, appointmentId: string, appointmentName: string) => {
    setRescheduleDialog({ open: true, taskId, appointmentId, appointmentName });
    setRescheduleDateTime(undefined);
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleDialog || !rescheduleDateTime || !user) return;

    try {
      // Update appointment with new date and assign to current user
      const { error: aptError } = await supabase
        .from('appointments')
        .update({
          start_at_utc: rescheduleDateTime.toISOString(),
          status: 'CONFIRMED',
          pipeline_stage: 'booked',
          setter_id: user.id
        })
        .eq('id', rescheduleDialog.appointmentId);

      if (aptError) throw aptError;

      // Complete the task
      const { error: taskError } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', rescheduleDialog.taskId);

      if (taskError) throw taskError;

      toast.success('Appointment rescheduled and assigned to you');
      setRescheduleDialog(null);
      setRescheduleDateTime(undefined);
      refreshTasks();
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to reschedule');
    }
  };

  const formatTime = (utcDate: string) => {
    try {
      return format(parseISO(utcDate), 'h:mm a');
    } catch {
      return utcDate;
    }
  };

  const isReturningSoon = (autoReturnAt: string | null) => {
    if (!autoReturnAt) return false;
    const minutes = differenceInMinutes(new Date(autoReturnAt), new Date());
    return minutes <= 30 && minutes > 0;
  };

  const getTaskTypeBadge = (taskType: string, isMRRTask?: boolean, sequence?: number) => {
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
        const ordinal = sequence === 1 ? '1st' : sequence === 2 ? '2nd' : sequence === 3 ? '3rd' : `${sequence}th`;
        return (
          <Badge className="text-xs bg-blue-500 hover:bg-blue-600 text-white border-0">
            <Phone className="h-3 w-3 mr-1" />
            {ordinal} Confirmation
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

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTaskCard = (task: any) => {
    const apt = task.appointment;
    const isMRRTask = task.mrr_schedule_id != null;
    const taskColor = isMRRTask ? 'border-emerald-200 dark:border-emerald-900'
      : task.task_type === 'call_confirmation' ? 'border-blue-200 dark:border-blue-900' 
      : task.task_type === 'follow_up' ? 'border-purple-200 dark:border-purple-900'
      : task.task_type === 'reschedule' ? 'border-amber-200 dark:border-amber-900'
      : '';
    return (
      <Card key={task.id} className={cn("bg-card card-hover", taskColor)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-semibold">{apt.lead_name}</p>
              <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
               <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  console.log(`[${apt.lead_name}] Task data:`, {
                    task_type: task.task_type,
                    due_at: task.due_at,
                    confirmation_sequence: task.confirmation_sequence,
                    status: task.status
                  });
                  return null;
                })()}
                {task.task_type === 'call_confirmation' && task.due_at && (
                  <Badge className="text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white border-0">
                    <Clock className="h-3 w-3 mr-1" />
                    Confirm by: {format(parseISO(task.due_at), 'MMM d, h:mm a')}
                  </Badge>
                )}
                {apt.event_type_name && (
                  <Badge variant="outline" className="text-xs">
                    {apt.event_type_name}
                  </Badge>
                )}
                {getTaskTypeBadge(task.task_type, isMRRTask, task.confirmation_sequence || 1)}
                {isMRRTask && (
                  <Badge className="text-xs bg-emerald-600 text-white border-0">
                    {task.mrr_confirmed_months}/{task.mrr_total_months} months
                  </Badge>
                )}
                {apt.setter_id === user?.id ? (
                  <Badge variant="default" className="text-xs bg-blue-600">
                    Assigned to You
                  </Badge>
                ) : (userRole === 'admin' || userRole === 'offer_owner') && apt.setter_name ? (
                  <Badge variant="secondary" className="text-xs">
                    Assigned to {apt.setter_name}
                  </Badge>
                ) : null}
                {isReturningSoon(task.auto_return_at) && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Due Soon
                  </Badge>
                )}
              </div>
              {task.task_type === 'follow_up' && task.follow_up_date && !isMRRTask && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 Follow up by: {format(parseISO(task.follow_up_date), 'MMM d, yyyy')}
                </p>
              )}
              {isMRRTask && (
                <p className="text-xs font-medium text-emerald-600 mt-2">
                  💰 MRR Payment Due: ${task.mrr_amount}/month
                </p>
              )}
              {task.task_type === 'follow_up' && task.follow_up_reason && !isMRRTask && (
                <p className="text-xs text-muted-foreground border-l-2 pl-2 mt-1">
                  {task.follow_up_reason}
                </p>
              )}
              {task.task_type === 'reschedule' && task.reschedule_date && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 Reschedule date: {format(parseISO(task.reschedule_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                <span className="text-xs">Appt:</span>
              </div>
              <div className="font-medium">
                {format(parseISO(apt.start_at_utc), 'MMM d')} at {formatTime(apt.start_at_utc)}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setDetailView({ open: true, task })}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              View Details
            </Button>
            {isMRRTask ? (
              <>
                <Button 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => confirmMRRPayment(task.id, apt.id, task.mrr_amount)}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Confirm Payment
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => noShowTask(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Payment Failed
                </Button>
              </>
            ) : task.task_type === 'call_confirmation' ? (
              <>
                <Button 
                  size="sm"
                  onClick={() => setConfirmDialog({ 
                    open: true, 
                    taskId: task.id, 
                    appointmentId: apt.id,
                    setterId: apt.setter_id,
                    appointmentName: apt.lead_name
                  })}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (apt.reschedule_url) {
                      setRescheduleWithLinkDialog({
                        open: true,
                        taskId: task.id,
                        appointmentId: apt.id,
                        appointmentName: apt.lead_name,
                        rescheduleUrl: apt.reschedule_url
                      });
                    } else {
                      toast.error("No reschedule link available. Please check Calendly settings.");
                    }
                  }}
                >
                  <CalendarClock className="h-4 w-4 mr-1" />
                  Reschedule
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => noShowTask(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  No-Show
                </Button>
              </>
            ) : task.task_type === 'follow_up' ? (
              <>
                <Button 
                  size="sm"
                  onClick={() => handleRescheduleFollowUp(task.id, apt.id, apt.lead_name)}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Reconnected
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => noShowTask(task.id, apt.id)}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Still No Response
                </Button>
              </>
            ) : task.task_type === 'reschedule' ? (
              <>
                <Button 
                  size="sm"
                  onClick={() => setConfirmDialog({ 
                    open: true, 
                    taskId: task.id, 
                    appointmentId: apt.id,
                    setterId: apt.setter_id,
                    appointmentName: apt.lead_name
                  })}
                >
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  Rescheduled
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => noShowTask(task.id, apt.id)}
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

      {(userRole === 'admin' || userRole === 'offer_owner') && (
        <div className="flex justify-end gap-2">
          <Select value={viewMode} onValueChange={(value: 'all' | 'overdue') => setViewMode(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="overdue">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Overdue Only
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {viewMode === 'all' && (
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {viewMode === 'overdue' 
                ? 'No overdue tasks - great work!' 
                : 'No tasks assigned'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'overdue' && (
            <Card className="mb-4 border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-100">
                      {filteredTasks.length} Overdue Task{filteredTasks.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      These tasks require immediate attention
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overdue Tasks */}
          {groupedTasks.overdue.length > 0 && (
            <Card className="card-hover border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  {viewMode === 'overdue' ? 'All Overdue Tasks' : 'Overdue'}
                  <Badge variant="secondary" className="ml-2 bg-red-600 text-white">
                    {groupedTasks.overdue.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedTasks.overdue.map((task) => {
                  const apt = task.appointment;
                  const appointmentDate = parseISO(apt.start_at_utc);
                  return (
                    <div key={task.id}>
                      <div className="text-xs font-medium text-red-600 mb-2">
                        Was scheduled: {format(appointmentDate, 'EEEE, MMMM d, yyyy')}
                      </div>
                      {renderTaskCard(task)}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Today's Tasks */}
          {groupedTasks.today.length > 0 && (
            <Card className="card-hover border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-green-600" />
                  Today
                  <Badge variant="secondary" className="ml-2 bg-green-600 text-white">
                    {groupedTasks.today.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedTasks.today.map(renderTaskCard)}
              </CardContent>
            </Card>
          )}

          {/* Tomorrow's Tasks */}
          {groupedTasks.tomorrow.length > 0 && (
            <Card className="card-hover border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Tomorrow
                  <Badge variant="secondary" className="ml-2 bg-blue-600 text-white">
                    {groupedTasks.tomorrow.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedTasks.tomorrow.map((task) => {
                  const apt = task.appointment;
                  const appointmentDate = parseISO(apt.start_at_utc);
                  return (
                    <div key={task.id}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {format(appointmentDate, 'EEEE, MMMM d')}
                      </div>
                      {renderTaskCard(task)}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Tasks */}
          {groupedTasks.upcoming.length > 0 && (
            <Card className="card-hover border-info/20 bg-info/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-info" />
                  Upcoming
                  <Badge variant="info" className="ml-2">
                    {groupedTasks.upcoming.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedTasks.upcoming.map((task) => {
                  const apt = task.appointment;
                  const appointmentDate = parseISO(apt.start_at_utc);
                  return (
                    <div key={task.id}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {format(appointmentDate, 'EEEE, MMMM d')}
                      </div>
                      {renderTaskCard(task)}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}


      {/* Lead Detail Dialog */}
      {detailView && (
        <Dialog open={detailView.open} onOpenChange={(open) => !open && setDetailView(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Name</Label>
                    <p className="font-medium">{detailView.task.appointment.lead_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium">{detailView.task.appointment.lead_email}</p>
                  </div>
                  {detailView.task.appointment.lead_phone && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">{detailView.task.appointment.lead_phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Appointment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Scheduled Time</Label>
                    <p className="font-medium">{format(parseISO(detailView.task.appointment.start_at_utc), 'PPP p')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Event Type</Label>
                    <p className="font-medium">{detailView.task.appointment.event_type_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Status</Label>
                    <Badge variant="outline">{detailView.task.appointment.status}</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Pipeline Stage</Label>
                    <Badge variant="secondary">{detailView.task.appointment.pipeline_stage}</Badge>
                  </div>
                </div>
              </div>

              {/* Team Assignment */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Team Assignment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Setter</Label>
                    <p className="font-medium">{detailView.task.appointment.setter_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Closer</Label>
                    <p className="font-medium">{detailView.task.appointment.closer_name || 'Unassigned'}</p>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              {(detailView.task.appointment.revenue > 0 || detailView.task.appointment.product_name) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Financial Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {detailView.task.appointment.product_name && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Product</Label>
                        <p className="font-medium">{detailView.task.appointment.product_name}</p>
                      </div>
                    )}
                    {detailView.task.appointment.revenue > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Revenue</Label>
                        <p className="font-medium">${detailView.task.appointment.revenue}</p>
                      </div>
                    )}
                    {detailView.task.appointment.cc_collected > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-xs">CC Collected</Label>
                        <p className="font-medium">${detailView.task.appointment.cc_collected}</p>
                      </div>
                    )}
                    {detailView.task.appointment.mrr_amount > 0 && (
                      <>
                        <div>
                          <Label className="text-muted-foreground text-xs">MRR Amount</Label>
                          <p className="font-medium">${detailView.task.appointment.mrr_amount}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">MRR Months</Label>
                          <p className="font-medium">{detailView.task.appointment.mrr_months}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Notes & Follow-up */}
              {(detailView.task.appointment.setter_notes || detailView.task.appointment.retarget_date) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Notes & Follow-up</h3>
                  {detailView.task.appointment.setter_notes && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Setter Notes</Label>
                      <p className="mt-1 p-3 bg-muted rounded-md">{detailView.task.appointment.setter_notes}</p>
                    </div>
                  )}
                  {detailView.task.appointment.retarget_date && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Retarget Date</Label>
                      <p className="font-medium">{format(parseISO(detailView.task.appointment.retarget_date), 'PPP')}</p>
                      {detailView.task.appointment.retarget_reason && (
                        <p className="text-sm text-muted-foreground mt-1">{detailView.task.appointment.retarget_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Task Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Task Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Task Type</Label>
                    <div className="mt-1">{getTaskTypeBadge(detailView.task.task_type, detailView.task.mrr_schedule_id != null)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Created</Label>
                    <p className="font-medium">{format(parseISO(detailView.task.created_at), 'PPP')}</p>
                  </div>
                  {detailView.task.mrr_schedule_id && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">MRR Progress</Label>
                      <p className="font-medium text-emerald-600">
                        {detailView.task.mrr_confirmed_months}/{detailView.task.mrr_total_months} months confirmed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${detailView.task.mrr_amount}/month
                      </p>
                    </div>
                  )}
                  {detailView.task.follow_up_date && !detailView.task.mrr_schedule_id && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Follow-up Date</Label>
                      <p className="font-medium">{format(parseISO(detailView.task.follow_up_date), 'PPP')}</p>
                    </div>
                  )}
                  {detailView.task.follow_up_reason && !detailView.task.mrr_schedule_id && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Follow-up Reason</Label>
                      <p className="mt-1 p-3 bg-muted rounded-md">{detailView.task.follow_up_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailView(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reschedule Dialog */}
      {rescheduleDialog && (
        <Dialog open={rescheduleDialog.open} onOpenChange={(open) => !open && setRescheduleDialog(null)}>
...
        </Dialog>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <Dialog open={confirmDialog.open} onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            setConfirmNote('');
          }
        }}>
...
        </Dialog>
      )}

      {/* Reschedule With Link Dialog */}
      {rescheduleWithLinkDialog && (
        <RescheduleWithLinkDialog
          open={rescheduleWithLinkDialog.open}
          onOpenChange={(open) => {
            if (!open) setRescheduleWithLinkDialog(null);
          }}
          rescheduleUrl={rescheduleWithLinkDialog.rescheduleUrl}
          appointmentName={rescheduleWithLinkDialog.appointmentName}
          appointmentId={rescheduleWithLinkDialog.appointmentId}
          onConfirm={async (reason, notes) => {
            await markAwaitingReschedule(
              rescheduleWithLinkDialog.taskId,
              rescheduleWithLinkDialog.appointmentId,
              reason,
              notes
            );
          }}
        />
      )}
    </div>
  );
}
