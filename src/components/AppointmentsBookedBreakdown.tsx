import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserCheck, Calendar, CalendarDays, CalendarClock, PhoneCall, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfWeek, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

interface TeamMemberSetterStats {
  name: string;
  id: string;
  stats: SetterStats;
}

interface TeamMemberCloserStats {
  name: string;
  id: string;
  stats: CloserStats;
}

interface AppointmentsBookedBreakdownProps {
  teamId: string;
}

export function AppointmentsBookedBreakdown({ teamId }: AppointmentsBookedBreakdownProps) {
  const [setterStats, setSetterStats] = useState<TeamMemberSetterStats[]>([]);
  const [closerStats, setCloserStats] = useState<TeamMemberCloserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointmentStats();
  }, [teamId]);

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
          const isConfirmed = confirmedAppointmentIds.has(apt.id);
          const showed = apt.status !== 'NO_SHOW' && apt.status !== 'CANCELLED';
          const closed = apt.status === 'CLOSED';
          
          data.booked[0] += 1; // total
          if (isConfirmed) {
            data.confirmed[0] += 1;
            if (showed) data.confirmedShowed[0] += 1;
            if (closed) data.confirmedClosed[0] += 1;
          }
          if (showed) data.showed[0] += 1;
          
          if (aptDate >= monthStart) {
            data.booked[1] += 1;
            if (isConfirmed) {
              data.confirmed[1] += 1;
              if (showed) data.confirmedShowed[1] += 1;
              if (closed) data.confirmedClosed[1] += 1;
            }
            if (showed) data.showed[1] += 1;
          }
          if (aptDate >= weekStart) {
            data.booked[2] += 1;
            if (isConfirmed) {
              data.confirmed[2] += 1;
              if (showed) data.confirmedShowed[2] += 1;
              if (closed) data.confirmedClosed[2] += 1;
            }
            if (showed) data.showed[2] += 1;
          }
          if (aptDate >= todayStart && aptDate <= todayEnd) {
            data.booked[3] += 1;
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

  const renderSetterCard = (member: TeamMemberSetterStats) => {
    const renderTimeBlock = (label: string, stats: { 
      booked: number; 
      confirmed: number; 
      showed: number; 
      confirmedShowed: number;
      confirmedClosed: number;
      confirmRate: number; 
      showRate: number;
      confirmedShowRate: number;
      confirmedCloseRate: number;
    }) => (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{label}</h4>
        
        {/* Booking Funnel */}
        <div className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg">
          <Calendar className="h-4 w-4" />
          <span className="font-semibold">{stats.booked}</span>
          <span className="text-muted-foreground text-xs">Booked</span>
          <span className="text-muted-foreground">→</span>
          <PhoneCall className="h-4 w-4" />
          <span className="font-semibold">{stats.confirmed}</span>
          <Badge variant="secondary" className="text-xs">
            {stats.confirmRate.toFixed(0)}%
          </Badge>
          <span className="text-muted-foreground">→</span>
          <UserCheck className="h-4 w-4" />
          <span className="font-semibold">{stats.showed}</span>
          <Badge variant="secondary" className="text-xs">
            {stats.showRate.toFixed(0)}%
          </Badge>
        </div>

        {/* Confirmed Calls Performance */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-primary">⭐ Confirmed Calls Performance</span>
            <span className="text-xs text-muted-foreground">(Commission Eligible)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">📞 Confirmed</div>
              <div className="text-lg font-bold">{stats.confirmed}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">✅ Showed Up</div>
              <div className="text-lg font-bold">{stats.confirmedShowed}</div>
              <Badge variant="outline" className="text-xs mt-1">
                {stats.confirmedShowRate.toFixed(0)}%
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">💰 Closed</div>
              <div className="text-lg font-bold">{stats.confirmedClosed}</div>
              <Badge variant="outline" className="text-xs mt-1">
                {stats.confirmedCloseRate.toFixed(0)}%
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <Card key={member.id} className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {member.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-lg">{member.name}</h3>
            <p className="text-sm text-muted-foreground">Setter</p>
          </div>
        </div>

        <div className="space-y-6">
          {renderTimeBlock("All Time", {
            booked: member.stats.booked.total,
            confirmed: member.stats.confirmed.total,
            showed: member.stats.showed.total,
            confirmedShowed: member.stats.confirmedShowed.total,
            confirmedClosed: member.stats.confirmedClosed.total,
            confirmRate: member.stats.confirmRate.total,
            showRate: member.stats.showRate.total,
            confirmedShowRate: member.stats.confirmedShowRate.total,
            confirmedCloseRate: member.stats.confirmedCloseRate.total
          })}
          {renderTimeBlock("This Month", {
            booked: member.stats.booked.thisMonth,
            confirmed: member.stats.confirmed.thisMonth,
            showed: member.stats.showed.thisMonth,
            confirmedShowed: member.stats.confirmedShowed.thisMonth,
            confirmedClosed: member.stats.confirmedClosed.thisMonth,
            confirmRate: member.stats.confirmRate.thisMonth,
            showRate: member.stats.showRate.thisMonth,
            confirmedShowRate: member.stats.confirmedShowRate.thisMonth,
            confirmedCloseRate: member.stats.confirmedCloseRate.thisMonth
          })}
          {renderTimeBlock("This Week", {
            booked: member.stats.booked.thisWeek,
            confirmed: member.stats.confirmed.thisWeek,
            showed: member.stats.showed.thisWeek,
            confirmedShowed: member.stats.confirmedShowed.thisWeek,
            confirmedClosed: member.stats.confirmedClosed.thisWeek,
            confirmRate: member.stats.confirmRate.thisWeek,
            showRate: member.stats.showRate.thisWeek,
            confirmedShowRate: member.stats.confirmedShowRate.thisWeek,
            confirmedCloseRate: member.stats.confirmedCloseRate.thisWeek
          })}
          {renderTimeBlock("Today", {
            booked: member.stats.booked.today,
            confirmed: member.stats.confirmed.today,
            showed: member.stats.showed.today,
            confirmedShowed: member.stats.confirmedShowed.today,
            confirmedClosed: member.stats.confirmedClosed.today,
            confirmRate: member.stats.confirmRate.today,
            showRate: member.stats.showRate.today,
            confirmedShowRate: member.stats.confirmedShowRate.today,
            confirmedCloseRate: member.stats.confirmedCloseRate.today
          })}
        </div>
      </Card>
    );
  };

  const renderCloserCard = (member: TeamMemberCloserStats) => {
    const renderTimeBlock = (label: string, stats: { taken: number; closed: number; closeRate: number }) => (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{label}</h4>
        <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <PhoneCall className="h-4 w-4" />
            <div>
              <div className="text-xs text-muted-foreground">Calls Taken</div>
              <div className="text-xl font-bold">{stats.taken}</div>
            </div>
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="flex items-center gap-2 flex-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Closed</div>
              <div className="text-xl font-bold">{stats.closed}</div>
            </div>
            <Badge variant="secondary" className="ml-2">
              {stats.closeRate.toFixed(0)}%
            </Badge>
          </div>
        </div>
      </div>
    );

    return (
      <Card key={member.id} className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {member.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-lg">{member.name}</h3>
            <p className="text-sm text-muted-foreground">Closer</p>
          </div>
        </div>

        <div className="space-y-6">
          {renderTimeBlock("All Time", {
            taken: member.stats.taken.total,
            closed: member.stats.closed.total,
            closeRate: member.stats.closeRate.total
          })}
          {renderTimeBlock("This Month", {
            taken: member.stats.taken.thisMonth,
            closed: member.stats.closed.thisMonth,
            closeRate: member.stats.closeRate.thisMonth
          })}
          {renderTimeBlock("This Week", {
            taken: member.stats.taken.thisWeek,
            closed: member.stats.closed.thisWeek,
            closeRate: member.stats.closeRate.thisWeek
          })}
          {renderTimeBlock("Today", {
            taken: member.stats.taken.today,
            closed: member.stats.closed.today,
            closeRate: member.stats.closeRate.today
          })}
        </div>
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
    </Card>
  );
}
