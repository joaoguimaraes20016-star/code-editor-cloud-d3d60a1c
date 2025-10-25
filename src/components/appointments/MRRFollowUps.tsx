import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle, XCircle, Pause, Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface MRRSchedule {
  id: string;
  client_name: string;
  client_email: string;
  mrr_amount: number;
  next_renewal_date: string;
  status: string;
  notes: string | null;
}

interface MRRTask {
  id: string;
  mrr_schedule_id: string;
  due_date: string;
  status: string;
  notes: string | null;
  schedule: MRRSchedule;
}

interface MRRFollowUpsProps {
  teamId: string;
}

export function MRRFollowUps({ teamId }: MRRFollowUpsProps) {
  const [tasks, setTasks] = useState<MRRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<MRRTask | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadTasks();

    const channel = supabase
      .channel('mrr-changes')
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
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('mrr_follow_up_tasks')
        .select(`
          *,
          schedule:mrr_schedules(*)
        `)
        .eq('team_id', teamId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading MRR tasks:', error);
      toast.error('Failed to load MRR follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string, notes?: string) => {
    try {
      const updateData: any = {
        status,
        completed_at: status === 'confirmed' ? new Date().toISOString() : null,
        completed_by: status === 'confirmed' ? (await supabase.auth.getUser()).data.user?.id : null
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('mrr_follow_up_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // Log activity
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id || '')
          .single();

        await supabase.from('activity_logs').insert({
          team_id: teamId,
          appointment_id: task.schedule.id,
          actor_id: user?.id,
          actor_name: profile?.full_name || 'Unknown',
          action_type: `MRR ${status === 'confirmed' ? 'Confirmed' : status === 'failed' ? 'Payment Failed' : status === 'paused' ? 'Paused' : 'Canceled'}`,
          note: notes || undefined
        });
      }

      toast.success('MRR follow-up updated');
      setSelectedTask(null);
      setNotes('');
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update follow-up');
    }
  };

  const tasksByStatus = {
    due: tasks.filter(t => t.status === 'due'),
    confirmed: tasks.filter(t => t.status === 'confirmed'),
    failed: tasks.filter(t => t.status === 'failed'),
    paused: tasks.filter(t => t.status === 'paused'),
    canceled: tasks.filter(t => t.status === 'canceled')
  };

  const StatusColumn = ({ title, status, icon: Icon, color, tasks }: any) => (
    <div className="flex-shrink-0" style={{ width: '280px' }}>
      <div className={`mb-4 p-3 bg-gradient-to-r ${color} rounded-lg border backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
          </div>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </div>

      <ScrollArea style={{ height: 'calc(100vh - 380px)' }}>
        <div className="space-y-3 pr-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No {title.toLowerCase()}</p>
            </div>
          ) : (
            tasks.map((task: MRRTask) => (
              <Card
                key={task.id}
                className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
                onClick={() => {
                  setSelectedTask(task);
                  setNotes(task.notes || '');
                }}
              >
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="font-semibold">{task.schedule.client_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{task.schedule.client_email}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm font-bold text-primary">
                      ${task.schedule.mrr_amount.toLocaleString()}/mo
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-card via-card/95 to-secondary/30 border border-primary/20 rounded-xl p-5">
          <h2 className="text-xl font-bold">MRR Follow-Ups</h2>
          <p className="text-sm text-muted-foreground mt-1">Monthly renewal tracking and payment confirmation</p>
        </div>

        <div className="bg-gradient-to-br from-muted/20 via-background to-muted/10 rounded-xl p-6 border border-primary/10">
          <div className="flex gap-4 overflow-x-auto pb-4">
            <StatusColumn
              title="Due"
              status="due"
              icon={Calendar}
              color="from-orange-500/20 to-orange-500/10 border-orange-500/30"
              tasks={tasksByStatus.due}
            />
            <StatusColumn
              title="Confirmed CC"
              status="confirmed"
              icon={CheckCircle}
              color="from-green-500/20 to-green-500/10 border-green-500/30"
              tasks={tasksByStatus.confirmed}
            />
            <StatusColumn
              title="Failed"
              status="failed"
              icon={XCircle}
              color="from-red-500/20 to-red-500/10 border-red-500/30"
              tasks={tasksByStatus.failed}
            />
            <StatusColumn
              title="Paused"
              status="paused"
              icon={Pause}
              color="from-yellow-500/20 to-yellow-500/10 border-yellow-500/30"
              tasks={tasksByStatus.paused}
            />
            <StatusColumn
              title="Canceled"
              status="canceled"
              icon={Ban}
              color="from-gray-500/20 to-gray-500/10 border-gray-500/30"
              tasks={tasksByStatus.canceled}
            />
          </div>
        </div>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MRR Follow-Up: {selectedTask?.schedule.client_name}</DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm"><strong>Email:</strong> {selectedTask.schedule.client_email}</p>
                <p className="text-sm"><strong>MRR Amount:</strong> ${selectedTask.schedule.mrr_amount.toLocaleString()}/month</p>
                <p className="text-sm"><strong>Due Date:</strong> {format(parseISO(selectedTask.due_date), 'MMMM dd, yyyy')}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this follow-up..."
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'confirmed', notes)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm CC
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'failed', notes)}
                  variant="outline"
                  className="border-red-500/50 hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Payment Failed
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'paused', notes)}
                  variant="outline"
                  className="border-yellow-500/50 hover:bg-yellow-500/10"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'canceled', notes)}
                  variant="outline"
                  className="border-gray-500/50 hover:bg-gray-500/10"
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
