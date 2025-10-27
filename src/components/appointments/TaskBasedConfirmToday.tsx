import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, UserPlus, CalendarCheck, CalendarX, Loader2, AlertCircle, Phone, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const { role: userRole } = useTeamRole(teamId);
  const {
    myTasks,
    loading,
    confirmTask,
    noShowTask,
    rescheduleTask,
    refreshTasks
  } = useTaskManagement(teamId, user?.id || '', userRole || '');

  const [selectedMember, setSelectedMember] = useState<string>('all');
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

  const filteredTasks = selectedMember === 'all' 
    ? myTasks 
    : myTasks.filter(task => task.appointment?.setter_id === selectedMember);

  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
  } | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<Date>();

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

  const getTaskTypeBadge = (taskType: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-5 w-5" />
        <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
      </div>

      {/* My Tasks */}
      <Card className="card-hover border-info/20 bg-info/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-info" />
              {userRole === 'admin' || userRole === 'offer_owner' ? 'All Team Tasks (Today)' : 'My Tasks (Today)'}
              <Badge variant="info" className="ml-2">
                {filteredTasks.length}
              </Badge>
            </CardTitle>
            {(userRole === 'admin' || userRole === 'offer_owner') && (
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
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned</p>
          ) : (
            filteredTasks.map((task) => {
              const apt = task.appointment;
              const taskColor = task.task_type === 'call_confirmation' ? 'border-blue-200 dark:border-blue-900' 
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
                          {apt.event_type_name && (
                            <Badge variant="outline" className="text-xs">
                              {apt.event_type_name}
                            </Badge>
                          )}
                          {getTaskTypeBadge(task.task_type)}
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
                        {task.task_type === 'follow_up' && task.follow_up_date && (
                          <p className="text-xs text-muted-foreground mt-2">
                            📅 Follow up by: {format(parseISO(task.follow_up_date), 'MMM d, yyyy')}
                          </p>
                        )}
                        {task.task_type === 'follow_up' && task.follow_up_reason && (
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatTime(apt.start_at_utc)}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {task.task_type === 'call_confirmation' && (
                        <>
                          <Button 
                            size="sm"
                            onClick={() => confirmTask(task.id, apt.id, apt.setter_id)}
                          >
                            <CalendarCheck className="h-4 w-4 mr-1" />
                            Confirm
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => rescheduleTask(task.id, apt.id)}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
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
                      )}
                      {task.task_type === 'follow_up' && (
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
                      )}
                      {task.task_type === 'reschedule' && (
                        <>
                          <Button 
                            size="sm"
                            onClick={() => confirmTask(task.id, apt.id, apt.setter_id)}
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
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>


      {/* Reschedule Dialog */}
      {rescheduleDialog && (
        <Dialog open={rescheduleDialog.open} onOpenChange={(open) => !open && setRescheduleDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reschedule Appointment</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Setting new appointment date/time for <span className="font-semibold">{rescheduleDialog.appointmentName}</span>
              </p>
              
              <div className="space-y-2">
                <Label>Select New Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {rescheduleDateTime ? format(rescheduleDateTime, "PPP 'at' p") : "Pick a date and time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={rescheduleDateTime}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = rescheduleDateTime ? new Date(date) : new Date(date.setHours(9, 0, 0, 0));
                          if (rescheduleDateTime) {
                            newDate.setHours(rescheduleDateTime.getHours(), rescheduleDateTime.getMinutes());
                          }
                          setRescheduleDateTime(newDate);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {rescheduleDateTime && (
                      <div className="p-3 border-t">
                        <Label className="text-xs">Time</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="time"
                            value={rescheduleDateTime ? format(rescheduleDateTime, "HH:mm") : ""}
                            onChange={(e) => {
                              if (rescheduleDateTime && e.target.value) {
                                const [hours, minutes] = e.target.value.split(':');
                                const newDate = new Date(rescheduleDateTime);
                                newDate.setHours(parseInt(hours), parseInt(minutes));
                                setRescheduleDateTime(newDate);
                              }
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleRescheduleConfirm} disabled={!rescheduleDateTime}>
                Confirm & Assign to Me
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
