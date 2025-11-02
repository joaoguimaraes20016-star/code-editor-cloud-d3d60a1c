import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Calendar, AlertCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MRRFollowUps } from './MRRFollowUps';

interface Task {
  id: string;
  appointment_id: string;
  task_type: string;
  follow_up_date: string | null;
  follow_up_reason: string | null;
  status: string;
  created_at: string;
  appointment: {
    lead_name: string;
    lead_email: string;
    lead_phone: string | null;
    start_at_utc: string;
  };
}

interface CloserTasksViewProps {
  teamId: string;
  userId: string;
}

export function CloserTasksView({ teamId, userId }: CloserTasksViewProps) {
  const [followUpTasks, setFollowUpTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();

    const channel = supabase
      .channel(`closer-tasks-${userId}`)
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

  const loadTasks = async () => {
    try {
      // Load follow-up tasks assigned to this closer
      const { data: tasks, error } = await supabase
        .from('confirmation_tasks')
        .select(`
          id,
          appointment_id,
          task_type,
          follow_up_date,
          follow_up_reason,
          status,
          created_at,
          appointment:appointments!inner (
            lead_name,
            lead_email,
            lead_phone,
            start_at_utc,
            closer_id
          )
        `)
        .eq('team_id', teamId)
        .eq('task_type', 'follow_up')
        .eq('status', 'pending')
        .eq('appointment.closer_id', userId)
        .order('follow_up_date', { ascending: true });

      if (error) throw error;
      setFollowUpTasks(tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('confirmation_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Task completed');
      loadTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  const overdueTasks = followUpTasks.filter(t => 
    t.follow_up_date && new Date(t.follow_up_date) < new Date()
  );

  const todayTasks = followUpTasks.filter(t => {
    if (!t.follow_up_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.follow_up_date === today;
  });

  const upcomingTasks = followUpTasks.filter(t => 
    t.follow_up_date && new Date(t.follow_up_date) > new Date() &&
    t.follow_up_date !== new Date().toISOString().split('T')[0]
  );

  if (loading) {
    return <div className="p-6">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="follow-ups" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="follow-ups">
            Follow-Ups
            {followUpTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{followUpTasks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mrr">
            MRR Due
          </TabsTrigger>
        </TabsList>

        <TabsContent value="follow-ups" className="space-y-4">
          {overdueTasks.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Overdue ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overdueTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={completeTask} isOverdue />
                ))}
              </CardContent>
            </Card>
          )}

          {todayTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Due Today ({todayTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={completeTask} />
                ))}
              </CardContent>
            </Card>
          )}

          {upcomingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming ({upcomingTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={completeTask} />
                ))}
              </CardContent>
            </Card>
          )}

          {followUpTasks.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No follow-up tasks at this time
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mrr">
          <MRRFollowUps teamId={teamId} userRole="closer" currentUserId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskCard({ task, onComplete, isOverdue = false }: { 
  task: Task; 
  onComplete: (id: string) => void;
  isOverdue?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${isOverdue ? 'bg-destructive/10 border-destructive' : 'bg-card'}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{task.appointment.lead_name}</h4>
            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
            {!isOverdue && <Badge variant="success">Follow Up</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{task.appointment.lead_email}</p>
          {task.follow_up_reason && (
            <p className="text-sm mt-2">
              <span className="font-medium">Reason:</span> {task.follow_up_reason}
            </p>
          )}
          {task.follow_up_date && (
            <p className="text-sm text-muted-foreground">
              Due: {format(new Date(task.follow_up_date), 'PPP')}
            </p>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // TODO: Implement reschedule functionality
              toast.success('Reschedule dialog coming soon');
            }}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={() => onComplete(task.id)}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Complete
          </Button>
        </div>
      </div>
    </div>
  );
}
