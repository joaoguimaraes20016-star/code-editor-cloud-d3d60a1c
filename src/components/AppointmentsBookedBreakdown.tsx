import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserCheck, Calendar, CalendarDays, CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfWeek, startOfDay, endOfDay } from "date-fns";

interface AppointmentStats {
  thisMonth: number;
  thisWeek: number;
  today: number;
  total: number;
}

interface TeamMemberStats {
  name: string;
  id: string;
  stats: AppointmentStats;
}

interface AppointmentsBookedBreakdownProps {
  teamId: string;
}

export function AppointmentsBookedBreakdown({ teamId }: AppointmentsBookedBreakdownProps) {
  const [setterStats, setSetterStats] = useState<TeamMemberStats[]>([]);
  const [closerStats, setCloserStats] = useState<TeamMemberStats[]>([]);
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
      const setterMap = new Map<string, { name: string; stats: AppointmentStats }>();
      
      appointments?.forEach(apt => {
        if (apt.setter_id && apt.setter_name) {
          if (!setterMap.has(apt.setter_id)) {
            setterMap.set(apt.setter_id, {
              name: apt.setter_name,
              stats: { thisMonth: 0, thisWeek: 0, today: 0, total: 0 }
            });
          }
          
          const stats = setterMap.get(apt.setter_id)!.stats;
          const aptDate = new Date(apt.start_at_utc);
          
          stats.total += 1;
          if (aptDate >= monthStart) stats.thisMonth += 1;
          if (aptDate >= weekStart) stats.thisWeek += 1;
          if (aptDate >= todayStart && aptDate <= todayEnd) stats.today += 1;
        }
      });

      // Process closer stats
      const closerMap = new Map<string, { name: string; stats: AppointmentStats }>();
      
      appointments?.forEach(apt => {
        if (apt.closer_id && apt.closer_name) {
          if (!closerMap.has(apt.closer_id)) {
            closerMap.set(apt.closer_id, {
              name: apt.closer_name,
              stats: { thisMonth: 0, thisWeek: 0, today: 0, total: 0 }
            });
          }
          
          const stats = closerMap.get(apt.closer_id)!.stats;
          const aptDate = new Date(apt.start_at_utc);
          
          stats.total += 1;
          if (aptDate >= monthStart) stats.thisMonth += 1;
          if (aptDate >= weekStart) stats.thisWeek += 1;
          if (aptDate >= todayStart && aptDate <= todayEnd) stats.today += 1;
        }
      });

      // Convert to arrays and sort by this month's count
      const settersArray = Array.from(setterMap.entries())
        .map(([id, data]) => ({ id, name: data.name, stats: data.stats }))
        .sort((a, b) => b.stats.thisMonth - a.stats.thisMonth);

      const closersArray = Array.from(closerMap.entries())
        .map(([id, data]) => ({ id, name: data.name, stats: data.stats }))
        .sort((a, b) => b.stats.thisMonth - a.stats.thisMonth);

      setSetterStats(settersArray);
      setCloserStats(closersArray);
    } catch (error) {
      console.error('Error loading appointment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStatsCard = (member: TeamMemberStats, icon: typeof User) => {
    const Icon = icon;
    
    return (
      <div 
        key={member.id} 
        className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{member.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-xl font-bold text-foreground">{member.stats.thisMonth}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-xl font-bold text-foreground">{member.stats.thisWeek}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-xl font-bold text-foreground">{member.stats.today}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">All Time</p>
              <p className="text-xl font-bold text-foreground">{member.stats.total}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatsList = (
    data: TeamMemberStats[],
    icon: typeof User,
    emptyMessage: string
  ) => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading stats...</p>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {data.map(member => renderStatsCard(member, icon))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments Booked</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="setters" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setters">Setters</TabsTrigger>
            <TabsTrigger value="closers">Closers</TabsTrigger>
          </TabsList>
          <TabsContent value="setters" className="mt-4">
            {renderStatsList(
              setterStats,
              User,
              "No setter appointments booked yet"
            )}
          </TabsContent>
          <TabsContent value="closers" className="mt-4">
            {renderStatsList(
              closerStats,
              UserCheck,
              "No closer appointments booked yet"
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
