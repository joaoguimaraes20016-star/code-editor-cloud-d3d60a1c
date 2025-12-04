import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Phone, User, AlertCircle, Loader2, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, isToday, startOfDay, endOfDay, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { HorizontalAppointmentCard } from './HorizontalAppointmentCard';
import { CloseDealDialog } from '../CloseDealDialog';
import { DepositCollectedDialog } from './DepositCollectedDialog';

interface TodaysDashboardProps {
  teamId: string;
  userRole: string;
  viewingAsCloserId?: string;
  viewingAsSetterId?: string;
}

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  start_at_utc: string;
  status: string;
  pipeline_stage: string | null;
  event_type_name: string | null;
  closer_id: string | null;
  closer_name: string | null;
  setter_id: string | null;
  setter_name: string | null;
  cc_collected: number | null;
  mrr_amount: number | null;
  setter_notes: string | null;
  reschedule_url: string | null;
}

interface ConfirmationTask {
  id: string;
  appointment_id: string;
  completed_confirmations: number;
  required_confirmations: number;
  confirmation_attempts: any[];
  due_at: string | null;
  is_overdue: boolean;
  confirmation_sequence: number;
  task_type?: string;
}

export function TodaysDashboard({ teamId, userRole, viewingAsCloserId, viewingAsSetterId }: TodaysDashboardProps) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [confirmationTasks, setConfirmationTasks] = useState<Map<string, ConfirmationTask>>(new Map());
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [viewingAsUserId, setViewingAsUserId] = useState<string | null>(null);
  const [closeDealAppointment, setCloseDealAppointment] = useState<Appointment | null>(null);
  const [depositAppointment, setDepositAppointment] = useState<Appointment | null>(null);
  const [commissionSettings, setCommissionSettings] = useState({ closer: 10, setter: 5 });
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'pending' | 'overdue'>('all');
  const [overdueAppointments, setOverdueAppointments] = useState<Appointment[]>([]);

  // Sanitize props in case they're malformed objects
  const sanitizedCloserId = typeof viewingAsCloserId === 'string' && viewingAsCloserId !== 'undefined' ? viewingAsCloserId : undefined;
  const sanitizedSetterId = typeof viewingAsSetterId === 'string' && viewingAsSetterId !== 'undefined' ? viewingAsSetterId : undefined;

  useEffect(() => {
    loadTeamMembers();
    loadTodaysAppointments();
    loadOverdueTasks();
    loadCommissionSettings();

    const channel = supabase
      .channel(`today-appointments-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadTodaysAppointments();
          loadOverdueTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user?.id, sanitizedCloserId, sanitizedSetterId, viewingAsUserId]);

  const loadTodaysAppointments = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      // Determine which user's data to show using SANITIZED props OR local state
      const targetUserId = sanitizedCloserId || sanitizedSetterId || viewingAsUserId || user?.id;
      const isViewingSpecificPerson = !!(sanitizedCloserId || sanitizedSetterId || viewingAsUserId);
      
      // Determine target role
      let targetRole = userRole;
      if (sanitizedCloserId || (viewingAsUserId && teamMembers.find(m => m.id === viewingAsUserId)?.role === 'closer')) {
        targetRole = 'closer';
      } else if (sanitizedSetterId || (viewingAsUserId && teamMembers.find(m => m.id === viewingAsUserId)?.role === 'setter')) {
        targetRole = 'setter';
      } else if (viewingAsUserId) {
        // Get the actual role of the person we're viewing
        const viewingMember = teamMembers.find(m => m.id === viewingAsUserId);
        if (viewingMember) {
          targetRole = viewingMember.role;
        }
      }

      console.log('[TodaysDashboard] Loading for:', {
        targetUserId,
        targetRole,
        isViewingSpecificPerson,
        sanitizedCloserId,
        sanitizedSetterId,
        viewingAsUserId,
        currentUserId: user?.id,
        userRole,
        teamMembers: teamMembers.map(m => ({ id: m.id, name: m.name, role: m.role }))
      });

      // UPDATED LOGIC: Load appointments where EITHER:
      // 1. The appointment is scheduled today, OR
      // 2. The appointment has a task due today
      
      // First, get all appointment IDs with tasks due today or overdue
      let tasksQuery = supabase
        .from('confirmation_tasks')
        .select('appointment_id, is_overdue, due_at')
        .eq('team_id', teamId)
        .eq('status', 'pending');

      // For setters, only get tasks assigned to them
      if (targetRole === 'setter') {
        tasksQuery = tasksQuery.eq('assigned_to', targetUserId);
      }
      
      const { data: allPendingTasks } = await tasksQuery;
      
      // Filter for tasks due today OR overdue
      const endOfTodayDate = endOfDay(new Date());
      const tasksDueTodayOrOverdue = (allPendingTasks || []).filter(task => {
        if (!task.appointment_id) return false;
        // Show if overdue
        if (task.is_overdue) return true;
        // Or if due_at is today or earlier
        if (!task.due_at) return true; // backwards compatibility
        try {
          const dueDate = parseISO(task.due_at);
          return dueDate <= endOfTodayDate;
        } catch {
          return false;
        }
      });

      const appointmentIdsWithTasksDueToday = new Set(
        tasksDueTodayOrOverdue.map(t => t.appointment_id)
      );

      console.log('[TodaysDashboard] Tasks due today or overdue:', {
        count: appointmentIdsWithTasksDueToday.size,
        ids: Array.from(appointmentIdsWithTasksDueToday)
      });

      // Load appointments scheduled today
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .gte('start_at_utc', startOfToday)
        .lte('start_at_utc', endOfToday)
        .order('start_at_utc', { ascending: true });

      // Apply role-based filters
      console.log('[TodaysDashboard] Applying filter:', {
        targetRole,
        isViewingSpecificPerson,
        willFilterBy: (targetRole === 'closer' || targetRole === 'offer_owner' || targetRole === 'admin') ? 'closer_id' : targetRole === 'setter' ? 'setter_id' : 'none',
        filterValue: targetUserId
      });
      
      if (targetRole === 'closer' || targetRole === 'offer_owner' || targetRole === 'admin') {
        // Closers, offer owners, and admins see appointments where they are the closer
        query = query.eq('closer_id', targetUserId);
      } else if (targetRole === 'setter') {
        // Setters see their own setter appointments
        query = query.eq('setter_id', targetUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let filteredData = data || [];
      
      // ALSO load appointments that have tasks due today (even if appointment is not today)
      if (appointmentIdsWithTasksDueToday.size > 0) {
        let taskApptsQuery = supabase
          .from('appointments')
          .select('*')
          .eq('team_id', teamId)
          .in('id', Array.from(appointmentIdsWithTasksDueToday));

        // Apply role-based filters (setters rely on task assignment, not appointment ownership)
        if (targetRole === 'closer' || targetRole === 'offer_owner' || targetRole === 'admin') {
          taskApptsQuery = taskApptsQuery.eq('closer_id', targetUserId);
        }
        // For setters, don't filter by setter_id - we already filtered tasks by assigned_to above

        const { data: taskApptsData } = await taskApptsQuery;
        
        // Merge with existing data, avoiding duplicates
        const existingIds = new Set(filteredData.map(a => a.id));
        const newAppointments = (taskApptsData || []).filter(a => !existingIds.has(a.id));
        filteredData = [...filteredData, ...newAppointments];
        
        console.log('[TodaysDashboard] Added appointments with tasks due today:', {
          newCount: newAppointments.length,
          totalCount: filteredData.length
        });
      }
      
      console.log('[TodaysDashboard] Appointments loaded:', {
        count: filteredData.length,
        appointments: filteredData.map(a => ({
          id: a.id,
          lead: a.lead_name,
          closer_id: a.closer_id,
          closer_name: a.closer_name,
          setter_id: a.setter_id,
          setter_name: a.setter_name
        }))
      });

      // Load confirmation tasks - ONLY for setters (not closers/admins)
      if (filteredData.length > 0 && targetRole === 'setter') {
        const appointmentIds = filteredData.map(apt => apt.id);
        
        let tasksQuery = supabase
          .from('confirmation_tasks')
          .select('*')
          .in('appointment_id', appointmentIds)
          .eq('status', 'pending')
          .eq('assigned_to', targetUserId);
        
        console.log('[TodaysDashboard] Loading setter tasks for:', targetUserId);
        
        const { data: tasks } = await tasksQuery;
        
        console.log('[TodaysDashboard] Tasks loaded (BEFORE 48h filter):', {
          count: tasks?.length || 0,
          assignedTo: tasks?.[0]?.assigned_to,
          expectedUser: targetUserId,
          isViewingSpecificPerson,
          tasks: tasks?.map(t => ({
            id: t.id,
            due_at: t.due_at,
            appointment_id: t.appointment_id
          }))
        });
        
        // Filter tasks: Show if due today OR overdue
        const now = new Date();
        const endOfTodayDate = endOfDay(now);
        const filteredTasks = (tasks || []).filter(task => {
          if (!task.due_at) return true; // Show tasks without due_at (backwards compatibility)
          
          try {
            const dueDate = parseISO(task.due_at);
            // Show if: task is overdue OR due today (up to end of today)
            const shouldShow = task.is_overdue || dueDate <= endOfTodayDate;
            
            console.log(`[TodaysDashboard Today Filter] Task ${task.id}:`, {
              due_at: task.due_at,
              is_overdue: task.is_overdue,
              due_today: dueDate <= endOfTodayDate,
              shouldShow
            });
            
            return shouldShow;
          } catch (error) {
            console.error('[TodaysDashboard Filter ERROR]:', error);
            return false; // Fail closed - don't show tasks that can't be parsed
          }
        });
        
        console.log('[TodaysDashboard] Tasks loaded (AFTER today filter):', {
          before: tasks?.length || 0,
          after: filteredTasks.length
        });
        
        if (filteredTasks.length > 0) {
          const tasksMap = new Map<string, ConfirmationTask>();
          filteredTasks.forEach(task => {
            tasksMap.set(task.appointment_id, {
              id: task.id,
              appointment_id: task.appointment_id,
              completed_confirmations: task.completed_confirmations || 0,
              required_confirmations: task.required_confirmations || 1,
              confirmation_attempts: (task.confirmation_attempts as unknown as any[]) || [],
              due_at: task.due_at,
              is_overdue: task.is_overdue || false,
              confirmation_sequence: task.confirmation_sequence || 1,
              task_type: task.task_type || 'call_confirmation'
            });
          });
          setConfirmationTasks(tasksMap);
          
          // For setters: Only show appointments with pending confirmation tasks assigned to them
          if (targetRole === 'setter') {
            const appointmentIdsWithTasks = new Set(filteredTasks.map(t => t.appointment_id));
            filteredData = filteredData.filter(apt => appointmentIdsWithTasks.has(apt.id));
          }
        }
      }
      
      setAppointments(filteredData);
    } catch (error) {
      console.error('Error loading today\'s appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId);

      if (error) throw error;

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        if (profiles) {
          setTeamMembers(profiles.map(p => {
            const member = members.find(m => m.user_id === p.id);
            return { 
              id: p.id, 
              name: p.full_name || 'Unknown',
              role: member?.role || 'member'
            };
          }));
        }
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadCommissionSettings = async () => {
    try {
      const { data: team, error } = await supabase
        .from('teams')
        .select('closer_commission_percentage, setter_commission_percentage')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      if (team) {
        setCommissionSettings({
          closer: team.closer_commission_percentage || 10,
          setter: team.setter_commission_percentage || 5,
        });
      }
    } catch (error) {
      console.error('Error loading commission settings:', error);
    }
  };

  const loadOverdueTasks = async () => {
    try {
      const today = startOfDay(new Date()).toISOString();
      const targetUserId = sanitizedCloserId || sanitizedSetterId || viewingAsUserId || user?.id;

      let targetRole = userRole;
      if (sanitizedCloserId || (viewingAsUserId && teamMembers.find(m => m.id === viewingAsUserId)?.role === 'closer')) {
        targetRole = 'closer';
      } else if (sanitizedSetterId || (viewingAsUserId && teamMembers.find(m => m.id === viewingAsUserId)?.role === 'setter')) {
        targetRole = 'setter';
      }

      let query = supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .lt('start_at_utc', today)
        .in('status', ['NEW', 'NO_SHOW', 'RESCHEDULED', 'SHOWED']);

      if (targetRole === 'closer' || targetRole === 'offer_owner' || targetRole === 'admin') {
        query = query.eq('closer_id', targetUserId);
      } else if (targetRole === 'setter') {
        query = query.eq('setter_id', targetUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setOverdueAppointments(data || []);
    } catch (error) {
      console.error('Error loading overdue tasks:', error);
    }
  };

  const handleCloseDeal = (appointment: Appointment) => {
    setCloseDealAppointment(appointment);
  };

  const handleDepositClick = (appointment: Appointment) => {
    setDepositAppointment(appointment);
  };

  const handleDepositConfirm = async (depositAmount: number, notes: string, followUpDate: Date) => {
    if (!depositAppointment) return;

    try {
      await supabase
        .from('appointments')
        .update({
          cc_collected: depositAmount,
          setter_notes: notes,
        })
        .eq('id', depositAppointment.id);

      // Create follow-up task if needed
      await supabase
        .from('confirmation_tasks')
        .insert({
          team_id: teamId,
          appointment_id: depositAppointment.id,
          task_type: 'follow_up',
          follow_up_date: followUpDate.toISOString().split('T')[0],
          due_at: followUpDate.toISOString(),
          status: 'pending',
        });

      toast.success(`$${depositAmount} deposit collected`);
      loadTodaysAppointments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Group appointments by time period and filter based on active filter
  const groupedAppointments = useMemo(() => {
    const morning: Appointment[] = [];
    const afternoon: Appointment[] = [];
    const evening: Appointment[] = [];
    const confirmed: Appointment[] = [];
    const pending: Appointment[] = [];
    const futureWithTasksDueToday: Appointment[] = [];

    // Determine which appointments to display based on active filter
    let displayAppointments = appointments;
    if (activeFilter === 'confirmed') {
      displayAppointments = appointments.filter(apt => apt.status === 'CONFIRMED');
    } else if (activeFilter === 'pending') {
      displayAppointments = appointments.filter(apt => apt.status !== 'CONFIRMED');
    } else if (activeFilter === 'overdue') {
      displayAppointments = overdueAppointments;
    }

    displayAppointments.forEach(apt => {
      try {
        const aptDate = parseISO(apt.start_at_utc);
        const hour = aptDate.getHours();
        const isAppointmentToday = isToday(aptDate);

        if (apt.status === 'CONFIRMED') {
          confirmed.push(apt);
        } else {
          pending.push(apt);
        }

        // Only group into time slots if appointment is actually TODAY
        if (isAppointmentToday) {
          if (hour < 12) {
            morning.push(apt);
          } else if (hour < 17) {
            afternoon.push(apt);
          } else {
            evening.push(apt);
          }
        } else {
          // Appointment is not today but has a task due today - show in separate section
          futureWithTasksDueToday.push(apt);
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    });

    return { morning, afternoon, evening, confirmed, pending, futureWithTasksDueToday };
  }, [appointments, activeFilter, overdueAppointments]);

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(apt => apt.status === 'CONFIRMED').length,
    pending: appointments.filter(apt => apt.status !== 'CONFIRMED').length,
    overdue: overdueAppointments.length,
    morning: groupedAppointments.morning.length,
    afternoon: groupedAppointments.afternoon.length,
    evening: groupedAppointments.evening.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Rep Selector - Only show in main Today view, not when viewing specific reps */}
      {!sanitizedCloserId && !sanitizedSetterId && (
        <Card className="p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hidden sm:block" />
            <div className="flex-1">
              <label className="text-[10px] sm:text-sm font-medium mb-1 sm:mb-2 block">View As</label>
              <Select 
                value={viewingAsUserId || user?.id || ''} 
                onValueChange={(value) => setViewingAsUserId(value === user?.id ? null : value)}
              >
                <SelectTrigger className="w-full sm:max-w-xs h-8 sm:h-10 text-[11px] sm:text-sm">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user?.id || ''} className="text-[11px] sm:text-sm">
                    {teamMembers.find(m => m.id === user?.id)?.name || 'Me'}
                  </SelectItem>
                  {teamMembers
                    .filter(m => m.id !== user?.id)
                    .map(member => (
                      <SelectItem key={member.id} value={member.id} className="text-[11px] sm:text-sm">
                        {member.name} ({member.role === 'offer_owner' ? 'Owner' : member.role.charAt(0).toUpperCase() + member.role.slice(1)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {viewingAsUserId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setViewingAsUserId(null)}
                className="h-7 sm:h-8 text-[10px] sm:text-sm px-2 sm:px-3"
              >
                Reset
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Header with date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
            <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-2xl font-bold">{format(new Date(), 'EEE, MMM d')}</h3>
            <p className="text-[10px] sm:text-sm text-muted-foreground hidden sm:block">
              {userRole === 'setter' ? 'Calls requiring confirmation' : 
               userRole === 'closer' ? 'Your booked calls for today' : 
               'Team schedule for today'}
            </p>
          </div>
        </div>
        <Button onClick={loadTodaysAppointments} variant="outline" size="sm" className="h-7 sm:h-9 text-[10px] sm:text-sm px-2 sm:px-3">
          <span className="hidden sm:inline">Refresh</span>
          <span className="sm:hidden">↻</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
        <Card 
          className={cn(
            "bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:shadow-lg transition-all duration-200",
            activeFilter === 'all' && "ring-2 ring-primary shadow-lg"
          )}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left">
                <p className="text-[9px] sm:text-sm text-muted-foreground">Total</p>
                <p className="text-lg sm:text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <Phone className="h-4 w-4 sm:h-8 sm:w-8 text-primary/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "bg-gradient-to-br from-green-500/10 to-green-500/5 cursor-pointer hover:shadow-lg transition-all duration-200",
            activeFilter === 'confirmed' && "ring-2 ring-green-500 shadow-lg"
          )}
          onClick={() => setActiveFilter('confirmed')}
        >
          <CardContent className="p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left">
                <p className="text-[9px] sm:text-sm text-muted-foreground">Confirmed</p>
                <p className="text-lg sm:text-3xl font-bold text-green-600">{stats.confirmed}</p>
              </div>
              <TrendingUp className="h-4 w-4 sm:h-8 sm:w-8 text-green-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "bg-gradient-to-br from-amber-500/10 to-amber-500/5 cursor-pointer hover:shadow-lg transition-all duration-200",
            activeFilter === 'pending' && "ring-2 ring-amber-500 shadow-lg"
          )}
          onClick={() => setActiveFilter('pending')}
        >
          <CardContent className="p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left">
                <p className="text-[9px] sm:text-sm text-muted-foreground">Pending</p>
                <p className="text-lg sm:text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <AlertCircle className="h-4 w-4 sm:h-8 sm:w-8 text-amber-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "bg-gradient-to-br from-red-500/10 to-red-500/5 cursor-pointer hover:shadow-lg transition-all duration-200",
            activeFilter === 'overdue' && "ring-2 ring-red-500 shadow-lg"
          )}
          onClick={() => setActiveFilter('overdue')}
        >
          <CardContent className="p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left">
                <p className="text-[9px] sm:text-sm text-muted-foreground">Overdue</p>
                <p className="text-lg sm:text-3xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertTriangle className="h-4 w-4 sm:h-8 sm:w-8 text-red-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Filter Indicator */}
      {activeFilter !== 'all' && (
        <div className="flex items-center justify-between bg-muted/50 p-2 sm:p-3 rounded-lg">
          <p className="text-[10px] sm:text-sm font-medium">
            <span className="font-bold capitalize">{activeFilter}</span>
          </p>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setActiveFilter('all')}
            className="h-6 sm:h-8 text-[10px] sm:text-sm px-2"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Appointments List */}
      {activeFilter === 'overdue' ? (
        overdueAppointments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No overdue tasks</h3>
              <p className="text-sm text-muted-foreground">
                Great! You don't have any overdue appointments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold">Overdue Appointments</h3>
              <Badge variant="destructive">{overdueAppointments.length}</Badge>
            </div>
            <div className="space-y-3">
              {overdueAppointments.map(apt => (
                <HorizontalAppointmentCard
                  key={apt.id}
                  appointment={apt}
                  confirmationTask={confirmationTasks.get(apt.id)}
                  teamId={teamId}
                  userRole={userRole}
                  showRescheduleButton={userRole === 'closer'}
                  showCloseDealButton={userRole === 'closer'}
                  onCloseDeal={() => handleCloseDeal(apt)}
                  onDepositClick={() => handleDepositClick(apt)}
                  onUpdate={() => {
                    loadTodaysAppointments();
                    loadOverdueTasks();
                  }}
                />
              ))}
            </div>
          </div>
        )
      ) : (groupedAppointments.morning.length + groupedAppointments.afternoon.length + groupedAppointments.evening.length) === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {userRole === 'setter' ? 'No calls need confirmation' : 
               userRole === 'closer' ? 'No calls scheduled for today' : 
               'No calls scheduled for today'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {userRole === 'setter' ? 'All appointments are confirmed! Check back later for new tasks.' : 
               'You\'re all caught up! New appointments will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Morning */}
          {groupedAppointments.morning.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Morning (8am - 12pm)</h3>
                <Badge variant="secondary">{groupedAppointments.morning.length}</Badge>
              </div>
              <div className="space-y-3">
                {groupedAppointments.morning.map(apt => (
                  <HorizontalAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    confirmationTask={confirmationTasks.get(apt.id)}
                    teamId={teamId}
                    userRole={userRole}
                    showRescheduleButton={userRole === 'closer'}
                    showCloseDealButton={userRole === 'closer'}
                    onCloseDeal={() => handleCloseDeal(apt)}
                    onDepositClick={() => handleDepositClick(apt)}
                    onUpdate={loadTodaysAppointments}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Afternoon */}
          {groupedAppointments.afternoon.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Afternoon (12pm - 5pm)</h3>
                <Badge variant="secondary">{groupedAppointments.afternoon.length}</Badge>
              </div>
              <div className="space-y-3">
                {groupedAppointments.afternoon.map(apt => (
                  <HorizontalAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    confirmationTask={confirmationTasks.get(apt.id)}
                    teamId={teamId}
                    userRole={userRole}
                    showRescheduleButton={userRole === 'closer'}
                    showCloseDealButton={userRole === 'closer'}
                    onCloseDeal={() => handleCloseDeal(apt)}
                    onDepositClick={() => handleDepositClick(apt)}
                    onUpdate={loadTodaysAppointments}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Evening */}
          {groupedAppointments.evening.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Evening (5pm+)</h3>
                <Badge variant="secondary">{groupedAppointments.evening.length}</Badge>
              </div>
              <div className="space-y-3">
                {groupedAppointments.evening.map(apt => (
                  <HorizontalAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    confirmationTask={confirmationTasks.get(apt.id)}
                    teamId={teamId}
                    userRole={userRole}
                    showRescheduleButton={userRole === 'closer'}
                    showCloseDealButton={userRole === 'closer'}
                    onCloseDeal={() => handleCloseDeal(apt)}
                    onDepositClick={() => handleDepositClick(apt)}
                    onUpdate={loadTodaysAppointments}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Appointments with Tasks Due Today */}
          {groupedAppointments.futureWithTasksDueToday.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-info" />
                <h3 className="text-lg font-semibold">Upcoming (Tasks Due Today)</h3>
                <Badge variant="info">{groupedAppointments.futureWithTasksDueToday.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                These appointments are scheduled for future dates but have confirmation tasks due today.
              </p>
              <div className="space-y-3">
                {groupedAppointments.futureWithTasksDueToday.map(apt => (
                  <HorizontalAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    confirmationTask={confirmationTasks.get(apt.id)}
                    teamId={teamId}
                    userRole={userRole}
                    showRescheduleButton={userRole === 'closer'}
                    showCloseDealButton={userRole === 'closer'}
                    onCloseDeal={() => handleCloseDeal(apt)}
                    onDepositClick={() => handleDepositClick(apt)}
                    onUpdate={loadTodaysAppointments}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Close Deal Dialog */}
      {closeDealAppointment && (
        <CloseDealDialog
          appointment={{
            id: closeDealAppointment.id,
            lead_name: closeDealAppointment.lead_name,
            lead_email: closeDealAppointment.lead_email,
            setter_id: closeDealAppointment.setter_id,
            setter_name: closeDealAppointment.setter_name,
          }}
          teamId={teamId}
          open={!!closeDealAppointment}
          onOpenChange={(open) => !open && setCloseDealAppointment(null)}
          onSuccess={() => {
            setCloseDealAppointment(null);
            loadTodaysAppointments();
          }}
          closerCommissionPct={commissionSettings.closer}
          setterCommissionPct={commissionSettings.setter}
        />
      )}

      {/* Deposit Dialog */}
      {depositAppointment && (
        <DepositCollectedDialog
          open={!!depositAppointment}
          onOpenChange={(open) => !open && setDepositAppointment(null)}
          onConfirm={handleDepositConfirm}
          dealName={depositAppointment.lead_name}
        />
      )}
    </div>
  );
}
