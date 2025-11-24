import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserCheck, Calendar, CalendarDays, CalendarClock, PhoneCall, CheckCircle2, TrendingUp, DollarSign, Activity, ListTodo, Clock, AlertCircle, FileText, AlertTriangle, ChevronDown, UserCog } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfWeek, startOfDay, endOfDay, format, subHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AssignDialog } from "./appointments/AssignDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DetailedStats {
  thisMonth: number;
  thisWeek: number;
  today: number;
  total: number;
}

interface SetterStats {
  booked: DetailedStats;
  confirmed: DetailedStats;
  showed: DetailedStats;
  confirmedShowed: DetailedStats;
  confirmedClosed: DetailedStats;
  confirmRate: {
    thisMonth: number;
    thisWeek: number;
    today: number;
    total: number;
  };
  showRate: {
    thisMonth: number;
    thisWeek: number;
    today: number;
    total: number;
  };
  confirmedShowRate: {
    thisMonth: number;
    thisWeek: number;
    today: number;
    total: number;
  };
  confirmedCloseRate: {
    thisMonth: number;
    thisWeek: number;
    today: number;
    total: number;
  };
}

interface CloserStats {
  taken: DetailedStats;
  closed: DetailedStats;
  closeRate: {
    thisMonth: number;
    thisWeek: number;
    today: number;
    total: number;
  };
}

interface ActivityLog {
  id: string;
  action_type: string;
  note: string;
  created_at: string;
}

interface Task {
  id: string;
  task_type: string;
  status: string;
  appointment_id: string;
  created_at: string;
  follow_up_date?: string;
  reschedule_date?: string;
  appointments?: {
    lead_name: string;
    start_at_utc: string;
  };
}

interface StaleLeadInfo {
  id: string;
  lead_name: string;
  start_at_utc: string;
  status: string;
  hoursSinceActivity: number;
}

interface AccountabilityMetrics {
  overdueTasks: Task[];
  dueTodayTasks: Task[];
  staleLeads: StaleLeadInfo[];
  missingNotes: { id: string; lead_name: string; start_at_utc: string }[];
}

interface TeamMemberSetterStats {
  name: string;
  id: string;
  stats: SetterStats;
  activityToday: ActivityLog[];
  dueTasks: Task[];
  accountability: AccountabilityMetrics;
}

interface TeamMemberCloserStats {
  name: string;
  id: string;
  stats: CloserStats;
  activityToday: ActivityLog[];
  dueTasks: Task[];
  accountability: AccountabilityMetrics;
}

interface AppointmentsBookedBreakdownProps {
  teamId: string;
}

export function AppointmentsBookedBreakdown({ teamId }: AppointmentsBookedBreakdownProps) {
  const [setterStats, setSetterStats] = useState<TeamMemberSetterStats[]>([]);
  const [closerStats, setCloserStats] = useState<TeamMemberCloserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [memberTimeFilters, setMemberTimeFilters] = useState<Record<string, 'today' | 'week' | 'month' | 'total'>>({});
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  useEffect(() => {
    loadAppointmentStats();
    loadActivityAndTasks();
  }, [teamId]);

  const loadActivityAndTasks = async () => {
    try {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const fortyEightHoursAgo = subHours(new Date(), 48);

      // Load today's activities
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('team_id', teamId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: false });

      // Load ALL activities for stale lead detection
      const { data: allActivities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('team_id', teamId);

      // Load pending tasks
      const { data: tasks } = await supabase
        .from('confirmation_tasks')
        .select(`
          *,
          appointments!inner(lead_name, start_at_utc)
        `)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .not('assigned_to', 'is', null)
        .order('created_at', { ascending: false });

      // Load all appointments for accountability metrics
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .in('status', ['NEW', 'CONFIRMED', 'SHOWED']);

      // Group data by user
      const activitiesByUser = new Map<string, ActivityLog[]>();
      const tasksByUser = new Map<string, Task[]>();
      const appointmentsByUser = new Map<string, any[]>();

      activities?.forEach(activity => {
        if (activity.actor_id) {
          if (!activitiesByUser.has(activity.actor_id)) {
            activitiesByUser.set(activity.actor_id, []);
          }
          activitiesByUser.get(activity.actor_id)!.push(activity);
        }
      });

      tasks?.forEach(task => {
        if (task.assigned_to) {
          if (!tasksByUser.has(task.assigned_to)) {
            tasksByUser.set(task.assigned_to, []);
          }
          tasksByUser.get(task.assigned_to)!.push(task);
        }
      });

      appointments?.forEach(apt => {
        const userId = apt.setter_id || apt.closer_id;
        if (userId) {
          if (!appointmentsByUser.has(userId)) {
            appointmentsByUser.set(userId, []);
          }
          appointmentsByUser.get(userId)!.push(apt);
        }
      });

      // Calculate accountability metrics for each user
      const calculateAccountability = (userId: string): AccountabilityMetrics => {
        const userTasks = tasksByUser.get(userId) || [];
        const userAppointments = appointmentsByUser.get(userId) || [];

        // Overdue tasks
        const overdueTasks = userTasks.filter(task => {
          if (task.follow_up_date && new Date(task.follow_up_date) < todayStart) return true;
          if (task.reschedule_date && new Date(task.reschedule_date) < todayStart) return true;
          return false;
        });

        // Due today tasks
        const dueTodayTasks = userTasks.filter(task => {
          if (task.follow_up_date && new Date(task.follow_up_date).toDateString() === todayStart.toDateString()) return true;
          if (task.reschedule_date && new Date(task.reschedule_date).toDateString() === todayStart.toDateString()) return true;
          return false;
        });

        // Stale leads (no activity in 48 hours)
        const staleLeads: StaleLeadInfo[] = userAppointments
          .filter(apt => {
            const hasRecentActivity = allActivities?.some(act => 
              act.appointment_id === apt.id && 
              new Date(act.created_at) >= fortyEightHoursAgo
            );
            return !hasRecentActivity;
          })
          .map(apt => {
            const lastActivity = allActivities
              ?.filter(act => act.appointment_id === apt.id)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            
            const hoursSinceActivity = lastActivity 
              ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60))
              : 999;

            return {
              id: apt.id,
              lead_name: apt.lead_name,
              start_at_utc: apt.start_at_utc,
              status: apt.status,
              hoursSinceActivity
            };
          });

        // Missing notes
        const missingNotes = userAppointments
          .filter(apt => !apt.setter_notes || apt.setter_notes.trim() === '')
          .map(apt => ({
            id: apt.id,
            lead_name: apt.lead_name,
            start_at_utc: apt.start_at_utc
          }));

        return {
          overdueTasks,
          dueTodayTasks,
          staleLeads,
          missingNotes
        };
      };

      // Update setter stats
      setSetterStats(prev => prev.map(setter => ({
        ...setter,
        activityToday: activitiesByUser.get(setter.id) || [],
        dueTasks: tasksByUser.get(setter.id) || [],
        accountability: calculateAccountability(setter.id)
      })));

      // Update closer stats
      setCloserStats(prev => prev.map(closer => ({
        ...closer,
        activityToday: activitiesByUser.get(closer.id) || [],
        dueTasks: tasksByUser.get(closer.id) || [],
        accountability: calculateAccountability(closer.id)
      })));
    } catch (error) {
      console.error('Error loading activity and tasks:', error);
    }
  };

  const loadAppointmentStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Fetch all appointments for this team
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;

      // Fetch all completed confirmation tasks to track confirmed appointments
      const { data: confirmedTasks, error: tasksError } = await supabase
        .from('confirmation_tasks')
        .select('appointment_id, completed_at')
        .eq('team_id', teamId)
        .eq('status', 'confirmed');

      if (tasksError) throw tasksError;

      const confirmedAppointmentIds = new Set(confirmedTasks?.map(t => t.appointment_id) || []);

      // Process setter stats
      const setterMap = new Map<string, { 
        name: string; 
        booked: number[]; 
        confirmed: number[]; 
        showed: number[];
        confirmedShowed: number[];
        confirmedClosed: number[];
      }>();
      
      appointments?.forEach(apt => {
        if (apt.setter_id && apt.setter_name) {
          if (!setterMap.has(apt.setter_id)) {
            setterMap.set(apt.setter_id, {
              name: apt.setter_name,
              booked: [0, 0, 0, 0], // [total, month, week, today]
              confirmed: [0, 0, 0, 0],
              showed: [0, 0, 0, 0],
              confirmedShowed: [0, 0, 0, 0],
              confirmedClosed: [0, 0, 0, 0]
            });
          }
          
          const data = setterMap.get(apt.setter_id)!;
          const aptDate = new Date(apt.start_at_utc);
          const createdDate = new Date(apt.created_at);
          const isConfirmed = confirmedAppointmentIds.has(apt.id);
          const showed = apt.status !== 'NO_SHOW' && apt.status !== 'CANCELLED';
          const closed = apt.status === 'CLOSED';
          
          // Only count as "booked" if the setter actually booked it (not just assigned for confirmation)
          // We check created_at date instead of start_at_utc to track when they actually booked it
          const wasActuallyBooked = !apt.assignment_source || apt.assignment_source === 'calendly' || apt.assignment_source === 'booking_link';
          
          if (wasActuallyBooked) {
            data.booked[0] += 1; // total
            
            if (createdDate >= monthStart) {
              data.booked[1] += 1;
            }
            if (createdDate >= weekStart) {
              data.booked[2] += 1;
            }
            if (createdDate >= todayStart && createdDate <= todayEnd) {
              data.booked[3] += 1;
            }
          }
          
          // Track confirmed/showed/closed based on appointment date
          if (isConfirmed) {
            data.confirmed[0] += 1;
            if (showed) data.confirmedShowed[0] += 1;
            if (closed) data.confirmedClosed[0] += 1;
          }
          if (showed) data.showed[0] += 1;
          
          if (aptDate >= monthStart) {
            if (isConfirmed) {
              data.confirmed[1] += 1;
              if (showed) data.confirmedShowed[1] += 1;
              if (closed) data.confirmedClosed[1] += 1;
            }
            if (showed) data.showed[1] += 1;
          }
          if (aptDate >= weekStart) {
            if (isConfirmed) {
              data.confirmed[2] += 1;
              if (showed) data.confirmedShowed[2] += 1;
              if (closed) data.confirmedClosed[2] += 1;
            }
            if (showed) data.showed[2] += 1;
          }
          if (aptDate >= todayStart && aptDate <= todayEnd) {
            if (isConfirmed) {
              data.confirmed[3] += 1;
              if (showed) data.confirmedShowed[3] += 1;
              if (closed) data.confirmedClosed[3] += 1;
            }
            if (showed) data.showed[3] += 1;
          }
        }
      });

      // Process closer stats
      const closerMap = new Map<string, { name: string; taken: number[]; closed: number[] }>();
      
      appointments?.forEach(apt => {
        if (apt.closer_id && apt.closer_name) {
          if (!closerMap.has(apt.closer_id)) {
            closerMap.set(apt.closer_id, {
              name: apt.closer_name,
              taken: [0, 0, 0, 0], // [total, month, week, today]
              closed: [0, 0, 0, 0]
            });
          }
          
          const data = closerMap.get(apt.closer_id)!;
          const aptDate = new Date(apt.start_at_utc);
          const showed = apt.status !== 'NO_SHOW' && apt.status !== 'CANCELLED';
          const closed = apt.status === 'CLOSED';
          
          if (showed) {
            data.taken[0] += 1; // total
            if (closed) data.closed[0] += 1;
            
            if (aptDate >= monthStart) {
              data.taken[1] += 1;
              if (closed) data.closed[1] += 1;
            }
            if (aptDate >= weekStart) {
              data.taken[2] += 1;
              if (closed) data.closed[2] += 1;
            }
            if (aptDate >= todayStart && aptDate <= todayEnd) {
              data.taken[3] += 1;
              if (closed) data.closed[3] += 1;
            }
          }
        }
      });

      // Convert setters to arrays with calculated rates
      const settersArray = Array.from(setterMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        activityToday: [],
        dueTasks: [],
        accountability: {
          overdueTasks: [],
          dueTodayTasks: [],
          staleLeads: [],
          missingNotes: []
        },
        stats: {
          booked: {
            total: data.booked[0],
            thisMonth: data.booked[1],
            thisWeek: data.booked[2],
            today: data.booked[3]
          },
          confirmed: {
            total: data.confirmed[0],
            thisMonth: data.confirmed[1],
            thisWeek: data.confirmed[2],
            today: data.confirmed[3]
          },
          showed: {
            total: data.showed[0],
            thisMonth: data.showed[1],
            thisWeek: data.showed[2],
            today: data.showed[3]
          },
          confirmedShowed: {
            total: data.confirmedShowed[0],
            thisMonth: data.confirmedShowed[1],
            thisWeek: data.confirmedShowed[2],
            today: data.confirmedShowed[3]
          },
          confirmedClosed: {
            total: data.confirmedClosed[0],
            thisMonth: data.confirmedClosed[1],
            thisWeek: data.confirmedClosed[2],
            today: data.confirmedClosed[3]
          },
          confirmRate: {
            total: data.booked[0] > 0 ? (data.confirmed[0] / data.booked[0]) * 100 : 0,
            thisMonth: data.booked[1] > 0 ? (data.confirmed[1] / data.booked[1]) * 100 : 0,
            thisWeek: data.booked[2] > 0 ? (data.confirmed[2] / data.booked[2]) * 100 : 0,
            today: data.booked[3] > 0 ? (data.confirmed[3] / data.booked[3]) * 100 : 0
          },
          showRate: {
            total: data.confirmed[0] > 0 ? (data.showed[0] / data.confirmed[0]) * 100 : 0,
            thisMonth: data.confirmed[1] > 0 ? (data.showed[1] / data.confirmed[1]) * 100 : 0,
            thisWeek: data.confirmed[2] > 0 ? (data.showed[2] / data.confirmed[2]) * 100 : 0,
            today: data.confirmed[3] > 0 ? (data.showed[3] / data.confirmed[3]) * 100 : 0
          },
          confirmedShowRate: {
            total: data.confirmed[0] > 0 ? (data.confirmedShowed[0] / data.confirmed[0]) * 100 : 0,
            thisMonth: data.confirmed[1] > 0 ? (data.confirmedShowed[1] / data.confirmed[1]) * 100 : 0,
            thisWeek: data.confirmed[2] > 0 ? (data.confirmedShowed[2] / data.confirmed[2]) * 100 : 0,
            today: data.confirmed[3] > 0 ? (data.confirmedShowed[3] / data.confirmed[3]) * 100 : 0
          },
          confirmedCloseRate: {
            total: data.confirmed[0] > 0 ? (data.confirmedClosed[0] / data.confirmed[0]) * 100 : 0,
            thisMonth: data.confirmed[1] > 0 ? (data.confirmedClosed[1] / data.confirmed[1]) * 100 : 0,
            thisWeek: data.confirmed[2] > 0 ? (data.confirmedClosed[2] / data.confirmed[2]) * 100 : 0,
            today: data.confirmed[3] > 0 ? (data.confirmedClosed[3] / data.confirmed[3]) * 100 : 0
          }
        }
      })).sort((a, b) => b.stats.booked.thisMonth - a.stats.booked.thisMonth);

      // Convert closers to arrays with calculated rates
      const closersArray = Array.from(closerMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        activityToday: [],
        dueTasks: [],
        accountability: {
          overdueTasks: [],
          dueTodayTasks: [],
          staleLeads: [],
          missingNotes: []
        },
        stats: {
          taken: {
            total: data.taken[0],
            thisMonth: data.taken[1],
            thisWeek: data.taken[2],
            today: data.taken[3]
          },
          closed: {
            total: data.closed[0],
            thisMonth: data.closed[1],
            thisWeek: data.closed[2],
            today: data.closed[3]
          },
          closeRate: {
            total: data.taken[0] > 0 ? (data.closed[0] / data.taken[0]) * 100 : 0,
            thisMonth: data.taken[1] > 0 ? (data.closed[1] / data.taken[1]) * 100 : 0,
            thisWeek: data.taken[2] > 0 ? (data.closed[2] / data.taken[2]) * 100 : 0,
            today: data.taken[3] > 0 ? (data.closed[3] / data.taken[3]) * 100 : 0
          }
        }
      })).sort((a, b) => b.stats.closed.thisMonth - a.stats.closed.thisMonth);

      setSetterStats(settersArray);
      setCloserStats(closersArray);
    } catch (error) {
      console.error('Error loading appointment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
        if (!memberTimeFilters[memberId]) {
          setMemberTimeFilters(prev => ({ ...prev, [memberId]: 'today' }));
        }
      }
      return next;
    });
  };

  const getStatsForPeriod = (member: TeamMemberSetterStats, period: 'today' | 'week' | 'month' | 'total') => {
    switch (period) {
      case 'today': 
        return { 
          booked: member.stats.booked.today, 
          showed: member.stats.showed.today,
          confirmed: member.stats.confirmed.today,
          confirmedShowed: member.stats.confirmedShowed.today,
          confirmedClosed: member.stats.confirmedClosed.today,
          confirmRate: member.stats.confirmRate.today,
          showRate: member.stats.showRate.today,
          confirmedShowRate: member.stats.confirmedShowRate.today,
          confirmedCloseRate: member.stats.confirmedCloseRate.today
        };
      case 'week': 
        return { 
          booked: member.stats.booked.thisWeek, 
          showed: member.stats.showed.thisWeek,
          confirmed: member.stats.confirmed.thisWeek,
          confirmedShowed: member.stats.confirmedShowed.thisWeek,
          confirmedClosed: member.stats.confirmedClosed.thisWeek,
          confirmRate: member.stats.confirmRate.thisWeek,
          showRate: member.stats.showRate.thisWeek,
          confirmedShowRate: member.stats.confirmedShowRate.thisWeek,
          confirmedCloseRate: member.stats.confirmedCloseRate.thisWeek
        };
      case 'month': 
        return { 
          booked: member.stats.booked.thisMonth, 
          showed: member.stats.showed.thisMonth,
          confirmed: member.stats.confirmed.thisMonth,
          confirmedShowed: member.stats.confirmedShowed.thisMonth,
          confirmedClosed: member.stats.confirmedClosed.thisMonth,
          confirmRate: member.stats.confirmRate.thisMonth,
          showRate: member.stats.showRate.thisMonth,
          confirmedShowRate: member.stats.confirmedShowRate.thisMonth,
          confirmedCloseRate: member.stats.confirmedCloseRate.thisMonth
        };
      case 'total': 
        return { 
          booked: member.stats.booked.total, 
          showed: member.stats.showed.total,
          confirmed: member.stats.confirmed.total,
          confirmedShowed: member.stats.confirmedShowed.total,
          confirmedClosed: member.stats.confirmedClosed.total,
          confirmRate: member.stats.confirmRate.total,
          showRate: member.stats.showRate.total,
          confirmedShowRate: member.stats.confirmedShowRate.total,
          confirmedCloseRate: member.stats.confirmedCloseRate.total
        };
    }
  };

  const getCloserStatsForPeriod = (member: TeamMemberCloserStats, period: 'today' | 'week' | 'month' | 'total') => {
    switch (period) {
      case 'today': 
        return { 
          taken: member.stats.taken.today, 
          closed: member.stats.closed.today,
          closeRate: member.stats.closeRate.today
        };
      case 'week': 
        return { 
          taken: member.stats.taken.thisWeek, 
          closed: member.stats.closed.thisWeek,
          closeRate: member.stats.closeRate.thisWeek
        };
      case 'month': 
        return { 
          taken: member.stats.taken.thisMonth, 
          closed: member.stats.closed.thisMonth,
          closeRate: member.stats.closeRate.thisMonth
        };
      case 'total': 
        return { 
          taken: member.stats.taken.total, 
          closed: member.stats.closed.total,
          closeRate: member.stats.closeRate.total
        };
    }
  };

  const getTotalIssues = (accountability: AccountabilityMetrics) => {
    return accountability.overdueTasks.length +
           accountability.dueTodayTasks.length +
           accountability.staleLeads.length +
           accountability.missingNotes.length;
  };

  const handleReassign = (appointment: any) => {
    setSelectedAppointment(appointment);
    setReassignDialogOpen(true);
  };

  const renderSetterCard = (member: TeamMemberSetterStats) => {
    const isExpanded = expandedMembers.has(member.id);
    const timeFilter = memberTimeFilters[member.id] || 'today';
    const stats = getStatsForPeriod(member, timeFilter);
    const totalIssues = getTotalIssues(member.accountability);
    const showRate = stats.booked > 0 ? (stats.showed / stats.booked) * 100 : 0;

    return (
      <Card key={member.id}>
        {/* Header - Always Visible */}
        <div 
          onClick={() => toggleMember(member.id)}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {member.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{member.name}</h3>
              <p className="text-sm text-muted-foreground">Setter</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {member.accountability.overdueTasks.length > 0 && (
              <Badge variant="destructive">
                {member.accountability.overdueTasks.length} overdue
              </Badge>
            )}
            {member.accountability.dueTodayTasks.length > 0 && (
              <Badge variant="warning">
                {member.accountability.dueTodayTasks.length} due
              </Badge>
            )}
            {totalIssues === 0 && (
              <Badge variant="success">✅ All clear</Badge>
            )}
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 pt-0 space-y-6">
            {/* Time Period Toggle */}
            <Tabs 
              value={timeFilter} 
              onValueChange={(value) => setMemberTimeFilters(prev => ({ 
                ...prev, 
                [member.id]: value as 'today' | 'week' | 'month' | 'total' 
              }))}
            >
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="total">All Time</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Booked</span>
                  </div>
                  <div className="text-3xl font-bold text-primary">{stats.booked}</div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Showed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.showed}</div>
                    {stats.booked > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
                        {showRate.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Confirmed Calls Performance */}
            {stats.confirmed > 0 && (
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <CardContent className="p-4 relative">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Confirmed Calls Performance</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Confirmed</div>
                      <div className="text-2xl font-bold text-primary">{stats.confirmed}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Showed</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.confirmedShowed}</div>
                      <Badge className="mt-1 text-xs bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
                        {stats.confirmedShowRate.toFixed(0)}%
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Closed</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.confirmedClosed}</div>
                      <Badge className="mt-1 text-xs bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
                        {stats.confirmedCloseRate.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accountability Section */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Accountability
              </h4>

              {/* Overdue Tasks */}
              {member.accountability.overdueTasks.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span className="font-semibold text-destructive">Overdue Tasks</span>
                    </div>
                    <Badge variant="destructive">{member.accountability.overdueTasks.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.overdueTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-xs">{task.task_type.replace('_', ' ')}</Badge>
                              <div className="flex items-center gap-1 text-xs text-destructive">
                                <Clock className="h-3 w-3" />
                                {task.follow_up_date && format(new Date(task.follow_up_date), 'MMM d')}
                                {task.reschedule_date && format(new Date(task.reschedule_date), 'MMM d')}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(task.appointments);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{task.appointments?.lead_name || 'Unknown Lead'}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Due Today */}
              {member.accountability.dueTodayTasks.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">Due Today</span>
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">{member.accountability.dueTodayTasks.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.dueTodayTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{task.task_type.replace('_', ' ')}</Badge>
                              <span className="text-xs text-muted-foreground">Today</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(task.appointments);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{task.appointments?.lead_name || 'Unknown Lead'}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Stale Leads */}
              {member.accountability.staleLeads.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <span className="font-semibold text-orange-600 dark:text-orange-400">Stale Leads (48h+)</span>
                    </div>
                    <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">{member.accountability.staleLeads.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.staleLeads.map(lead => (
                        <div key={lead.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                              <span className="text-xs text-orange-600 dark:text-orange-400">
                                {lead.hoursSinceActivity < 72 ? `${lead.hoursSinceActivity}h ago` : `${Math.floor(lead.hoursSinceActivity / 24)}d ago`}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(lead);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{lead.lead_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Appt: {format(new Date(lead.start_at_utc), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Missing Notes */}
              {member.accountability.missingNotes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-muted/50 border hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">Missing Notes</span>
                    </div>
                    <Badge variant="outline">{member.accountability.missingNotes.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.missingNotes.map(apt => (
                        <div key={apt.id} className="p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{apt.lead_name}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(apt);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Appt: {format(new Date(apt.start_at_utc), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* All Clear */}
              {totalIssues === 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="font-medium text-green-600 dark:text-green-400">All caught up! 🎉</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderCloserCard = (member: TeamMemberCloserStats) => {
    const isExpanded = expandedMembers.has(member.id);
    const timeFilter = memberTimeFilters[member.id] || 'today';
    const stats = getCloserStatsForPeriod(member, timeFilter);
    const totalIssues = getTotalIssues(member.accountability);

    return (
      <Card key={member.id}>
        {/* Header - Always Visible */}
        <div 
          onClick={() => toggleMember(member.id)}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {member.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{member.name}</h3>
              <p className="text-sm text-muted-foreground">Closer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {member.accountability.overdueTasks.length > 0 && (
              <Badge variant="destructive">
                {member.accountability.overdueTasks.length} overdue
              </Badge>
            )}
            {member.accountability.dueTodayTasks.length > 0 && (
              <Badge variant="warning">
                {member.accountability.dueTodayTasks.length} due
              </Badge>
            )}
            {totalIssues === 0 && (
              <Badge variant="success">✅ All clear</Badge>
            )}
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 pt-0 space-y-6">
            {/* Time Period Toggle */}
            <Tabs 
              value={timeFilter} 
              onValueChange={(value) => setMemberTimeFilters(prev => ({ 
                ...prev, 
                [member.id]: value as 'today' | 'week' | 'month' | 'total' 
              }))}
            >
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="total">All Time</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <PhoneCall className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Calls Taken</span>
                  </div>
                  <div className="text-3xl font-bold text-primary">{stats.taken}</div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Closed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.closed}</div>
                    {stats.taken > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
                        {stats.closeRate.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Accountability Section */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Accountability
              </h4>

              {/* Overdue Tasks */}
              {member.accountability.overdueTasks.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span className="font-semibold text-destructive">Overdue Tasks</span>
                    </div>
                    <Badge variant="destructive">{member.accountability.overdueTasks.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.overdueTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-xs">{task.task_type.replace('_', ' ')}</Badge>
                              <div className="flex items-center gap-1 text-xs text-destructive">
                                <Clock className="h-3 w-3" />
                                {task.follow_up_date && format(new Date(task.follow_up_date), 'MMM d')}
                                {task.reschedule_date && format(new Date(task.reschedule_date), 'MMM d')}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(task.appointments);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{task.appointments?.lead_name || 'Unknown Lead'}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Due Today */}
              {member.accountability.dueTodayTasks.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">Due Today</span>
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">{member.accountability.dueTodayTasks.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.dueTodayTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{task.task_type.replace('_', ' ')}</Badge>
                              <span className="text-xs text-muted-foreground">Today</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(task.appointments);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{task.appointments?.lead_name || 'Unknown Lead'}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Stale Leads */}
              {member.accountability.staleLeads.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <span className="font-semibold text-orange-600 dark:text-orange-400">Stale Leads (48h+)</span>
                    </div>
                    <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">{member.accountability.staleLeads.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.staleLeads.map(lead => (
                        <div key={lead.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                              <span className="text-xs text-orange-600 dark:text-orange-400">
                                {lead.hoursSinceActivity < 72 ? `${lead.hoursSinceActivity}h ago` : `${Math.floor(lead.hoursSinceActivity / 24)}d ago`}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(lead);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium">{lead.lead_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Appt: {format(new Date(lead.start_at_utc), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Missing Notes */}
              {member.accountability.missingNotes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-muted/50 border hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">Missing Notes</span>
                    </div>
                    <Badge variant="outline">{member.accountability.missingNotes.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {member.accountability.missingNotes.map(apt => (
                        <div key={apt.id} className="p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{apt.lead_name}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassign(apt);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Appt: {format(new Date(apt.start_at_utc), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* All Clear */}
              {totalIssues === 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="font-medium text-green-600 dark:text-green-400">All caught up! 🎉</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading detailed stats...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="closers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="closers">Closers</TabsTrigger>
            <TabsTrigger value="setters">Setters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="closers" className="mt-4">
            {closerStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No closer data available yet
              </p>
            ) : (
              <div className="space-y-4">
                {closerStats.map(member => renderCloserCard(member))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="setters" className="mt-4">
            {setterStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No setter data available yet
              </p>
            ) : (
              <div className="space-y-4">
                {setterStats.map(member => renderSetterCard(member))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {selectedAppointment && (
        <AssignDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          appointment={selectedAppointment}
          teamId={teamId}
          onSuccess={() => {
            loadAppointmentStats();
            loadActivityAndTasks();
            toast.success('Appointment reassigned successfully');
          }}
        />
      )}
    </Card>
  );
}
