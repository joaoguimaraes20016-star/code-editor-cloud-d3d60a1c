import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserCheck, Calendar, CalendarDays, CalendarClock, PhoneCall, CheckCircle2, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfWeek, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface DetailedStats {
  thisMonth: number;
  thisWeek: number;
  today: number;
  total: number;
}

interface SetterStats {
  booked: DetailedStats;
  showed: DetailedStats;
  showRate: {
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

      // Process setter stats
      const setterMap = new Map<string, { name: string; booked: number[]; showed: number[] }>();
      
      appointments?.forEach(apt => {
        if (apt.setter_id && apt.setter_name) {
          if (!setterMap.has(apt.setter_id)) {
            setterMap.set(apt.setter_id, {
              name: apt.setter_name,
              booked: [0, 0, 0, 0], // [total, month, week, today]
              showed: [0, 0, 0, 0]
            });
          }
          
          const data = setterMap.get(apt.setter_id)!;
          const aptDate = new Date(apt.start_at_utc);
          const showed = apt.status !== 'NO_SHOW' && apt.status !== 'CANCELLED';
          
          data.booked[0] += 1; // total
          if (showed) data.showed[0] += 1;
          
          if (aptDate >= monthStart) {
            data.booked[1] += 1;
            if (showed) data.showed[1] += 1;
          }
          if (aptDate >= weekStart) {
            data.booked[2] += 1;
            if (showed) data.showed[2] += 1;
          }
          if (aptDate >= todayStart && aptDate <= todayEnd) {
            data.booked[3] += 1;
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
          showed: {
            total: data.showed[0],
            thisMonth: data.showed[1],
            thisWeek: data.showed[2],
            today: data.showed[3]
          },
          showRate: {
            total: data.booked[0] > 0 ? (data.showed[0] / data.booked[0]) * 100 : 0,
            thisMonth: data.booked[1] > 0 ? (data.showed[1] / data.booked[1]) * 100 : 0,
            thisWeek: data.booked[2] > 0 ? (data.showed[2] / data.booked[2]) * 100 : 0,
            today: data.booked[3] > 0 ? (data.showed[3] / data.booked[3]) * 100 : 0
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
    return (
      <div 
        key={member.id} 
        className="p-5 rounded-lg bg-card border hover:border-primary/50 transition-all space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{member.name}</p>
              <p className="text-xs text-muted-foreground">Setter</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />
              {member.stats.showRate.thisMonth.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Show Rate</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">All Time</p>
            <p className="text-2xl font-bold mb-1">{member.stats.booked.total}</p>
            <p className="text-xs text-muted-foreground mb-1">Booked</p>
            <p className="text-sm text-success font-semibold">{member.stats.showed.total} confirmed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.showRate.total.toFixed(1)}% show rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-primary/5 border-2 border-primary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">This Month</p>
            <p className="text-2xl font-bold text-primary mb-1">{member.stats.booked.thisMonth}</p>
            <p className="text-xs text-muted-foreground mb-1">Booked</p>
            <p className="text-sm text-success font-semibold">{member.stats.showed.thisMonth} confirmed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.showRate.thisMonth.toFixed(1)}% show rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">This Week</p>
            <p className="text-2xl font-bold mb-1">{member.stats.booked.thisWeek}</p>
            <p className="text-xs text-muted-foreground mb-1">Booked</p>
            <p className="text-sm text-success font-semibold">{member.stats.showed.thisWeek} confirmed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.showRate.thisWeek.toFixed(1)}% show rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Today</p>
            <p className="text-2xl font-bold mb-1">{member.stats.booked.today}</p>
            <p className="text-xs text-muted-foreground mb-1">Booked</p>
            <p className="text-sm text-success font-semibold">{member.stats.showed.today} confirmed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.booked.today > 0 ? member.stats.showRate.today.toFixed(1) : '0'}% show rate
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCloserCard = (member: TeamMemberCloserStats) => {
    return (
      <div 
        key={member.id} 
        className="p-5 rounded-lg bg-card border hover:border-primary/50 transition-all space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{member.name}</p>
              <p className="text-xs text-muted-foreground">Closer</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {member.stats.closeRate.thisMonth.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Close Rate</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">All Time</p>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">{member.stats.taken.total}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Calls Taken</p>
            <p className="text-sm text-success font-semibold">{member.stats.closed.total} closed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.closeRate.total.toFixed(1)}% close rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-primary/5 border-2 border-primary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">This Month</p>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <PhoneCall className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold text-primary">{member.stats.taken.thisMonth}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Calls Taken</p>
            <p className="text-sm text-success font-semibold">{member.stats.closed.thisMonth} closed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.closeRate.thisMonth.toFixed(1)}% close rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">This Week</p>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">{member.stats.taken.thisWeek}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Calls Taken</p>
            <p className="text-sm text-success font-semibold">{member.stats.closed.thisWeek} closed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.closeRate.thisWeek.toFixed(1)}% close rate
            </p>
          </div>
          
          <div className="text-center p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Today</p>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">{member.stats.taken.today}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Calls Taken</p>
            <p className="text-sm text-success font-semibold">{member.stats.closed.today} closed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {member.stats.taken.today > 0 ? member.stats.closeRate.today.toFixed(1) : '0'}% close rate
            </p>
          </div>
        </div>
      </div>
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
