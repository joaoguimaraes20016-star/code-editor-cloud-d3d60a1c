import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Calendar, RefreshCw, DollarSign, AlertCircle, Clock, CheckCircle2, Plus } from "lucide-react";
import { format } from "date-fns";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { useAuth } from "@/hooks/useAuth";
import { useTeamRole } from "@/hooks/useTeamRole";

interface UnifiedTasksViewProps {
  teamId: string;
}

interface UnifiedTask {
  id: string;
  type: 'call_confirmation' | 'reschedule' | 'follow_up' | 'mrr_payment';
  title: string;
  dueDate: Date;
  status: 'overdue' | 'due_today' | 'upcoming';
  assignedTo: string | null;
  assignedToName: string | null;
  leadName: string;
  details: string;
  appointmentId?: string;
  scheduleId?: string;
}

export function UnifiedTasksView({ teamId }: UnifiedTasksViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { role } = useTeamRole(teamId);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    loadTasks();
    loadTeamMembers();
    loadAppointments();

    const channel = supabase
      .channel(`unified-tasks-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks', filter: `team_id=eq.${teamId}` }, loadTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mrr_follow_up_tasks', filter: `team_id=eq.${teamId}` }, loadTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `team_id=eq.${teamId}` }, loadTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, filterStatus]);

  const loadTeamMembers = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(full_name)')
      .eq('team_id', teamId)
      .eq('is_active', true);

    setTeamMembers(data?.map(m => ({ id: m.user_id, name: (m.profiles as any)?.full_name || 'Unknown' })) || []);
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("id, lead_name, lead_email, start_at_utc, closer_id")
      .eq("team_id", teamId)
      .order("start_at_utc", { ascending: false })
      .limit(100);
    
    if (data) setAppointments(data);
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const unifiedTasks: UnifiedTask[] = [];

      // Load confirmation tasks
      if (filterStatus === 'pending' || filterStatus === 'all') {
        const { data: confirmTasks } = await supabase
          .from('confirmation_tasks')
          .select('*, appointment:appointments(lead_name, start_at_utc), assigned_profile:profiles!confirmation_tasks_assigned_to_fkey(full_name)')
          .eq('team_id', teamId)
          .eq('status', 'pending');

        confirmTasks?.forEach(task => {
          const aptTime = new Date(task.appointment?.start_at_utc || now);
          const status = aptTime < now ? 'overdue' : aptTime < new Date(today.getTime() + 24 * 60 * 60 * 1000) ? 'due_today' : 'upcoming';
          
          const taskType = task.task_type as 'call_confirmation' | 'reschedule' | 'follow_up';
          
          unifiedTasks.push({
            id: task.id,
            type: taskType,
            title: task.task_type === 'call_confirmation' ? 'Pending Confirmation' : 
                   task.task_type === 'reschedule' ? 'Reschedule Appointment' : 'Follow-Up',
            dueDate: aptTime,
            status,
            assignedTo: task.assigned_to,
            assignedToName: (task.assigned_profile as any)?.full_name || null,
            leadName: task.appointment?.lead_name || 'Unknown',
            details: task.task_type === 'follow_up' && task.follow_up_reason ? task.follow_up_reason : '',
            appointmentId: task.appointment_id,
          });
        });
      }

      // Load MRR payment tasks
      if (filterStatus === 'pending' || filterStatus === 'all') {
        const { data: mrrTasks } = await supabase
          .from('mrr_follow_up_tasks')
          .select('*, schedule:mrr_schedules(*, appointment:appointments(lead_name))')
          .eq('team_id', teamId)
          .eq('status', 'due');

        mrrTasks?.forEach(task => {
          const dueDate = new Date(task.due_date);
          const status = dueDate < today ? 'overdue' : dueDate.toDateString() === today.toDateString() ? 'due_today' : 'upcoming';
          
          unifiedTasks.push({
            id: task.id,
            type: 'mrr_payment',
            title: 'MRR Payment Due',
            dueDate,
            status,
            assignedTo: null,
            assignedToName: null,
            leadName: (task.schedule as any)?.appointment?.lead_name || 'Unknown',
            details: `$${(task.schedule as any)?.mrr_amount || 0}/month`,
            scheduleId: task.mrr_schedule_id,
          });
        });
      }

      setTasks(unifiedTasks);
    } finally {
      setLoading(false);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'call_confirmation': return <Phone className="h-4 w-4" />;
      case 'reschedule': return <Calendar className="h-4 w-4" />;
      case 'follow_up': return <RefreshCw className="h-4 w-4" />;
      case 'mrr_payment': return <DollarSign className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTaskBadgeVariant = (type: string): "default" | "secondary" | "success" => {
    switch (type) {
      case 'call_confirmation': return 'success';
      case 'reschedule': return 'success';
      case 'follow_up': return 'success';
      case 'mrr_payment': return 'default';
      default: return 'secondary';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterType !== 'all' && task.type !== filterType) return false;
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') {
        if (task.assignedTo !== null) return false;
      } else {
        if (task.assignedTo !== filterAssignee) return false;
      }
    }
    return true;
  });

  const overdueTasks = filteredTasks.filter(t => t.status === 'overdue');
  const dueTodayTasks = filteredTasks.filter(t => t.status === 'due_today');
  const upcomingTasks = filteredTasks.filter(t => t.status === 'upcoming');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const TaskCard = ({ task }: { task: UnifiedTask }) => (
    <Card className={task.status === 'overdue' ? 'border-destructive' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={getTaskBadgeVariant(task.type)} className="flex items-center gap-1">
                {getTaskIcon(task.type)}
                {task.title}
              </Badge>
              {task.assignedToName && (
                <Badge variant="outline" className="text-xs">
                  {task.assignedToName}
                </Badge>
              )}
            </div>
            <div>
              <p className="font-medium">{task.leadName}</p>
              <p className="text-sm text-muted-foreground">
                Due: {format(task.dueDate, 'MMM d, yyyy h:mm a')}
              </p>
              {task.details && (
                <p className="text-sm text-muted-foreground mt-1">{task.details}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {task.type === 'reschedule' && (
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-1" />
                Reschedule
              </Button>
            )}
            <Button variant="success" size="sm">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Complete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Filter Tasks</CardTitle>
          <Button onClick={() => setShowCreateTask(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create Task
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Task Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call_confirmation">Pending Confirmation</SelectItem>
                  <SelectItem value="reschedule">Reschedule</SelectItem>
                  <SelectItem value="follow_up">Follow-Up</SelectItem>
                  <SelectItem value="mrr_payment">MRR Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Assigned To</label>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Overdue ({overdueTasks.length})</h3>
          </div>
          {overdueTasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      {/* Due Today */}
      {dueTodayTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-success" />
            <h3 className="text-lg font-semibold text-success">Due Today ({dueTodayTasks.length})</h3>
          </div>
          {dueTodayTasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      {/* Upcoming */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h3 className="text-lg font-semibold">Upcoming (Next 7 Days) ({upcomingTasks.length})</h3>
          </div>
          {upcomingTasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
            <p className="text-lg font-medium">No tasks found</p>
            <p className="text-sm text-muted-foreground mt-2">
              All caught up! There are no tasks matching your filters.
            </p>
          </CardContent>
        </Card>
      )}

      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        teamId={teamId}
        appointments={appointments}
        onTaskCreated={() => {
          loadTasks();
          loadAppointments();
        }}
        userRole={role || 'admin'}
        currentUserId={user?.id}
      />
    </div>
  );
}
