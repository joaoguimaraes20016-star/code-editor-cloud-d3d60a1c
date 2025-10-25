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
  userRole: string;
  currentUserId: string;
}

export function MRRFollowUps({ teamId, userRole, currentUserId }: MRRFollowUpsProps) {
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
      // Load schedules first with proper filtering
      let schedulesQuery = supabase
        .from('mrr_schedules')
        .select('*')
        .eq('team_id', teamId);

      // Filter by assigned closer for closers (not admins/offer owners)
      if (userRole === 'closer' && currentUserId) {
        schedulesQuery = schedulesQuery.eq('assigned_to', currentUserId);
      }

      const { data: schedulesData, error: schedulesError } = await schedulesQuery;
      if (schedulesError) throw schedulesError;

      const scheduleIds = schedulesData?.map(s => s.id) || [];
      if (scheduleIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Load tasks only for filtered schedules
      const { data: tasksData, error: tasksError } = await supabase
        .from('mrr_follow_up_tasks')
        .select('*')
        .eq('team_id', teamId)
        .in('mrr_schedule_id', scheduleIds)
        .order('due_date', { ascending: true });

      if (tasksError) throw tasksError;

      // Combine data
      const schedulesMap = new Map(schedulesData?.map(s => [s.id, s]) || []);
      const combinedTasks = tasksData?.map(task => ({
        ...task,
        schedule: schedulesMap.get(task.mrr_schedule_id)!
      })).filter(task => task.schedule) || [];

      setTasks(combinedTasks);
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
    <div className="flex-shrink-0" style={{ width: '320px' }}>
      <div className={`mb-4 p-4 bg-gradient-to-br ${color} rounded-xl border shadow-md backdrop-blur-sm transition-all hover:shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background/50 rounded-lg backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
          </div>
          <Badge variant="secondary" className="text-sm font-bold px-3 py-1">{tasks.length}</Badge>
        </div>
      </div>

      <ScrollArea style={{ height: 'calc(100vh - 380px)' }}>
        <div className="space-y-3 pr-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 px-4 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-dashed border-border/50">
              <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground font-medium">No {title.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Tasks will appear here</p>
            </div>
          ) : (
            tasks.map((task: MRRTask) => (
              <Card
                key={task.id}
                className="group cursor-pointer hover:shadow-xl hover:scale-[1.03] hover:-translate-y-1 transition-all duration-300 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/80"
                onClick={() => {
                  setSelectedTask(task);
                  setNotes(task.notes || '');
                }}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base group-hover:text-primary transition-colors truncate">
                        {task.schedule.client_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {task.schedule.client_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">{format(parseISO(task.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
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
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border border-primary/30 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MRR Follow-Ups
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Monthly renewal tracking and payment confirmation</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-muted/20 via-background to-muted/10 rounded-2xl p-6 border border-primary/10 shadow-lg">
          <div className="flex gap-5 overflow-x-auto pb-4 px-1">
            <StatusColumn
              title="Due"
              status="due"
              icon={Calendar}
              color="from-orange-500/20 via-orange-500/15 to-orange-500/10 border-orange-500/40"
              tasks={tasksByStatus.due}
            />
            <StatusColumn
              title="Confirmed CC"
              status="confirmed"
              icon={CheckCircle}
              color="from-green-500/20 via-green-500/15 to-green-500/10 border-green-500/40"
              tasks={tasksByStatus.confirmed}
            />
            <StatusColumn
              title="Failed"
              status="failed"
              icon={XCircle}
              color="from-red-500/20 via-red-500/15 to-red-500/10 border-red-500/40"
              tasks={tasksByStatus.failed}
            />
            <StatusColumn
              title="Paused"
              status="paused"
              icon={Pause}
              color="from-yellow-500/20 via-yellow-500/15 to-yellow-500/10 border-yellow-500/40"
              tasks={tasksByStatus.paused}
            />
            <StatusColumn
              title="Canceled"
              status="canceled"
              icon={Ban}
              color="from-gray-500/20 via-gray-500/15 to-gray-500/10 border-gray-500/40"
              tasks={tasksByStatus.canceled}
            />
          </div>
        </div>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MRR Follow-Up
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl p-5 border border-border/50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-lg font-bold mb-1">{selectedTask.schedule.client_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedTask.schedule.client_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      ${selectedTask.schedule.mrr_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Due: {format(parseISO(selectedTask.due_date), 'MMMM dd, yyyy')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <span>Follow-Up Notes</span>
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record payment details, conversation notes, or next steps..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'confirmed', notes)}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all h-12"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Confirm Payment
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'failed', notes)}
                  variant="outline"
                  className="border-2 border-red-500/50 hover:bg-red-500/10 hover:border-red-500 transition-all h-12"
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Payment Failed
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'paused', notes)}
                  variant="outline"
                  className="border-2 border-yellow-500/50 hover:bg-yellow-500/10 hover:border-yellow-500 transition-all h-12"
                >
                  <Pause className="h-5 w-5 mr-2" />
                  Pause Subscription
                </Button>
                <Button
                  onClick={() => updateTaskStatus(selectedTask.id, 'canceled', notes)}
                  variant="outline"
                  className="border-2 border-gray-500/50 hover:bg-gray-500/10 hover:border-gray-500 transition-all h-12"
                >
                  <Ban className="h-5 w-5 mr-2" />
                  Cancel Subscription
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
