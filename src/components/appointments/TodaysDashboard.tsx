import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Phone, User, AlertCircle, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, isToday, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { HorizontalAppointmentCard } from './HorizontalAppointmentCard';

interface TodaysDashboardProps {
  teamId: string;
  userRole: string;
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
}

export function TodaysDashboard({ teamId, userRole }: TodaysDashboardProps) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [confirmationTasks, setConfirmationTasks] = useState<Map<string, ConfirmationTask>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodaysAppointments();

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
  }, [teamId, user?.id, userRole]);

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
      if (userRole === 'setter') {
        // Setters see unassigned or their assigned appointments
        query = query.or(`setter_id.is.null,setter_id.eq.${user?.id}`);
      } else if (userRole === 'closer') {
        // Closers see their assigned appointments
        query = query.eq('closer_id', user?.id);
      }
      // Admins see all appointments (no filter)

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);

      // Load confirmation tasks for today's appointments
      if (data && data.length > 0) {
        const appointmentIds = data.map(apt => apt.id);
        const { data: tasks } = await supabase
          .from('confirmation_tasks')
          .select('*')
          .in('appointment_id', appointmentIds)
          .eq('status', 'pending');
        
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
              confirmation_sequence: task.confirmation_sequence || 1
            });
          });
          setConfirmationTasks(tasksMap);
        }
      }
    } catch (error) {
      console.error('Error loading today\'s appointments:', error);
    } finally {
      setLoading(false);
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
      {/* Header with date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">{format(new Date(), 'EEEE, MMMM d')}</h3>
            <p className="text-sm text-muted-foreground">Your schedule for today</p>
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
            <h3 className="text-lg font-semibold mb-2">No calls scheduled for today</h3>
            <p className="text-sm text-muted-foreground">
              You're all caught up! New appointments will appear here.
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
                    onUpdate={loadTodaysAppointments}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
