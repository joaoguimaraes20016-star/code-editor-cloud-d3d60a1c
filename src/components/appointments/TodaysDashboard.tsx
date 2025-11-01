import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Phone, User, AlertCircle, Loader2, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, isToday, startOfDay, endOfDay } from 'date-fns';
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

  useEffect(() => {
    loadTeamMembers();
    loadTodaysAppointments();
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user?.id, userRole, viewingAsUserId, viewingAsCloserId, viewingAsSetterId]);

  const loadTodaysAppointments = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      let query = supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .gte('start_at_utc', startOfToday)
        .lte('start_at_utc', endOfToday)
        .order('start_at_utc', { ascending: true });

      // Filter by role
      const effectiveUserId = viewingAsCloserId || viewingAsSetterId || viewingAsUserId || user?.id;
      
      console.log('[TodaysDashboard] Loading appointments:', {
        userRole,
        effectiveUserId,
        viewingAsCloserId,
        viewingAsSetterId,
        currentUserId: user?.id
      });
      
      if (userRole === 'setter') {
        // Setters see appointments they need to confirm (no filter on setter_id yet, will filter by tasks)
      } else if (userRole === 'closer') {
        // Closers see their assigned appointments
        query = query.eq('closer_id', effectiveUserId);
      }
      // Admins see all appointments (no filter)

      const { data, error } = await query;

      if (error) throw error;
      
      let filteredData = data || [];

      // Load confirmation tasks for today's appointments (only for setters/admins)
      if (filteredData.length > 0 && (userRole === 'setter' || userRole === 'admin')) {
        const appointmentIds = filteredData.map(apt => apt.id);
        
        // Build the tasks query
        let tasksQuery = supabase
          .from('confirmation_tasks')
          .select('*')
          .in('appointment_id', appointmentIds)
          .eq('status', 'pending');
        
        // For setters: filter by assigned_to to only show their tasks
        if (userRole === 'setter') {
          console.log('[TodaysDashboard] Filtering tasks for setter:', effectiveUserId);
          tasksQuery = tasksQuery.eq('assigned_to', effectiveUserId);
        }
        
        const { data: tasks } = await tasksQuery;
        
        console.log('[TodaysDashboard] Loaded tasks:', {
          totalTasks: tasks?.length || 0,
          tasks: tasks?.map(t => ({ id: t.id, appointment_id: t.appointment_id, assigned_to: t.assigned_to }))
        });
        
        if (tasks) {
          const tasksMap = new Map<string, ConfirmationTask>();
          tasks.forEach(task => {
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
          
          // For setters: Only show appointments with pending confirmation tasks
          if (userRole === 'setter') {
            const appointmentIdsWithTasks = new Set(tasks.map(t => t.appointment_id));
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
          status: 'pending',
        });

      toast.success(`$${depositAmount} deposit collected`);
      loadTodaysAppointments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Group appointments by time period
  const groupedAppointments = useMemo(() => {
    const morning: Appointment[] = [];
    const afternoon: Appointment[] = [];
    const evening: Appointment[] = [];
    const confirmed: Appointment[] = [];
    const pending: Appointment[] = [];

    appointments.forEach(apt => {
      try {
        const aptDate = parseISO(apt.start_at_utc);
        const hour = aptDate.getHours();

        if (apt.status === 'CONFIRMED') {
          confirmed.push(apt);
        } else {
          pending.push(apt);
        }

        if (hour < 12) {
          morning.push(apt);
        } else if (hour < 17) {
          afternoon.push(apt);
        } else {
          evening.push(apt);
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    });

    return { morning, afternoon, evening, confirmed, pending };
  }, [appointments]);

  const stats = {
    total: appointments.length,
    confirmed: groupedAppointments.confirmed.length,
    pending: groupedAppointments.pending.length,
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
    <div className="space-y-6">
      {/* Rep Selector (for testing/admin) - Hidden when viewing specific reps */}
      {!viewingAsCloserId && !viewingAsSetterId && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">View As Team Member</label>
              <Select 
                value={viewingAsUserId || user?.id || ''} 
                onValueChange={(value) => setViewingAsUserId(value === user?.id ? null : value)}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user?.id || ''}>
                    👤 {teamMembers.find(m => m.id === user?.id)?.name || 'Me (Current User)'}
                  </SelectItem>
                  {teamMembers
                    .filter(m => m.id !== user?.id)
                    .map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
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
              >
                Reset to My View
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Header with date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">{format(new Date(), 'EEEE, MMMM d')}</h3>
            <p className="text-sm text-muted-foreground">
              {userRole === 'setter' ? 'Calls requiring confirmation' : 
               userRole === 'closer' ? 'Your booked calls for today' : 
               'Team schedule for today'}
            </p>
          </div>
        </div>
        <Button onClick={loadTodaysAppointments} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <Phone className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-3xl font-bold text-green-600">{stats.confirmed}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Time Breakdown</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Morning:</span>
                  <span className="font-semibold">{stats.morning}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Afternoon:</span>
                  <span className="font-semibold">{stats.afternoon}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Evening:</span>
                  <span className="font-semibold">{stats.evening}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
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
