import { useAuth } from '@/hooks/useAuth';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, UserPlus, CalendarCheck, CalendarX, Loader2, AlertCircle, Phone, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';

interface TaskBasedConfirmTodayProps {
  teamId: string;
}

export function TaskBasedConfirmToday({ teamId }: TaskBasedConfirmTodayProps) {
  const { user } = useAuth();
  const {
    myTasks,
    queueTasks,
    loading,
    claimTask,
    confirmTask,
    noShowTask,
    rescheduleTask
  } = useTaskManagement(teamId, user?.id || '');

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
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Phone className="h-3 w-3 mr-1" />
            Call Confirmation
          </Badge>
        );
      case 'follow_up':
        return (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            <RefreshCw className="h-3 w-3 mr-1" />
            Follow-Up
          </Badge>
        );
      case 'reschedule':
        return (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
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
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-600" />
            My Tasks (Today)
            <Badge variant="secondary" className="ml-auto">
              {myTasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned to you</p>
          ) : (
            myTasks.map((task) => {
              const apt = task.appointment;
              return (
                <Card key={task.id} className="bg-background">
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
                          <Badge variant="default" className="text-xs bg-blue-600">
                            Assigned to You
                          </Badge>
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
                            onClick={() => confirmTask(task.id, apt.id, apt.setter_id)}
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

      {/* Team Queue */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-600" />
            Team Queue (Unassigned)
            <Badge variant="secondary" className="ml-auto">
              {queueTasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queueTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unassigned tasks</p>
          ) : (
            queueTasks.map((task) => {
              const apt = task.appointment;
              return (
                <Card key={task.id} className="bg-background">
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
                      <Button 
                        size="sm" 
                        onClick={() => claimTask(task.id, apt.id)}
                        className="flex-1"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Claim Task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
