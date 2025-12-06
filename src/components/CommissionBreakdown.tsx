import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sale } from "./SalesTable";
import { User, UserCheck, Calendar, DollarSign, Trophy, Medal, PhoneCall } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";

interface CommissionBreakdownProps {
  sales: Sale[];
  teamId?: string;
}

interface MRRCommission {
  team_member_name: string;
  role: string;
  commission_amount: number;
  month_date: string;
}

interface SetterBooking {
  setter_name: string;
  booking_code: string | null;
  count: number;
}

export function CommissionBreakdown({ sales, teamId }: CommissionBreakdownProps) {
  const [upcomingMRR, setUpcomingMRR] = useState<MRRCommission[]>([]);
  const [loadingMRR, setLoadingMRR] = useState(false);
  const [setterBookings, setSetterBookings] = useState<SetterBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingPeriod, setBookingPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Load setter bookings based on period
  useEffect(() => {
    if (!teamId) return;
    
    const loadSetterBookings = async () => {
      setLoadingBookings(true);
      try {
        const now = new Date();
        let startDate: Date;
        
        switch (bookingPeriod) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'week':
            startDate = startOfWeek(now, { weekStartsOn: 1 });
            break;
          case 'month':
            startDate = startOfMonth(now);
            break;
        }
        
        const { data, error } = await supabase
          .from('appointments')
          .select('setter_name, booking_code, created_at')
          .eq('team_id', teamId)
          .gte('created_at', startDate.toISOString())
          .not('booking_code', 'is', null);

        if (error) throw error;

        // Group by booking_code (setter's personalized link)
        const bookingsByCode = (data || []).reduce((acc, apt) => {
          const code = apt.booking_code;
          if (!code) return acc;
          
          if (!acc[code]) {
            acc[code] = {
              setter_name: apt.setter_name || code,
              booking_code: code,
              count: 0,
            };
          }
          acc[code].count += 1;
          return acc;
        }, {} as Record<string, SetterBooking>);

        const sorted = Object.values(bookingsByCode).sort((a, b) => b.count - a.count);
        setSetterBookings(sorted);
      } catch (error) {
        console.error('Error loading setter bookings:', error);
      } finally {
        setLoadingBookings(false);
      }
    };

    loadSetterBookings();
  }, [teamId, bookingPeriod]);

  // Load upcoming MRR commissions
  useEffect(() => {
    if (!teamId) return;
    
    const loadUpcomingMRR = async () => {
      setLoadingMRR(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('mrr_commissions')
          .select('team_member_name, role, commission_amount, month_date')
          .eq('team_id', teamId)
          .gte('month_date', today)
          .order('month_date', { ascending: true });

        if (error) throw error;
        setUpcomingMRR(data || []);
      } catch (error) {
        console.error('Error loading MRR commissions:', error);
      } finally {
        setLoadingMRR(false);
      }
    };

    loadUpcomingMRR();
  }, [teamId]);

  // Calculate closer CC commission totals (from cash collected only)
  const closerCommissions = sales
    .filter(s => s.status === 'closed' && s.commission > 0)
    .reduce((acc, sale) => {
      if (!acc[sale.salesRep]) {
        acc[sale.salesRep] = {
          totalCommission: 0,
          totalRevenue: 0,
          salesCount: 0,
        };
      }
      acc[sale.salesRep].totalCommission += sale.commission;
      acc[sale.salesRep].totalRevenue += sale.revenue;
      acc[sale.salesRep].salesCount += 1;
      return acc;
    }, {} as Record<string, { totalCommission: number; totalRevenue: number; salesCount: number }>);

  // Calculate setter CC commission totals (from cash collected only)
  const setterCommissions = sales
    .filter(s => s.status === 'closed' && s.setterCommission > 0 && s.setter && s.setter.trim() !== '')
    .reduce((acc, sale) => {
      if (!acc[sale.setter]) {
        acc[sale.setter] = {
          totalCommission: 0,
          totalRevenue: 0,
          salesCount: 0,
        };
      }
      acc[sale.setter].totalCommission += sale.setterCommission;
      acc[sale.setter].totalRevenue += sale.revenue;
      acc[sale.setter].salesCount += 1;
      return acc;
    }, {} as Record<string, { totalCommission: number; totalRevenue: number; salesCount: number }>);

  // Calculate upcoming MRR commissions by person
  const upcomingMRRByPerson = upcomingMRR.reduce((acc, mrr) => {
    const key = `${mrr.team_member_name}-${mrr.role}`;
    if (!acc[key]) {
      acc[key] = {
        name: mrr.team_member_name,
        role: mrr.role,
        totalUpcoming: 0,
        monthsCount: 0,
      };
    }
    acc[key].totalUpcoming += mrr.commission_amount;
    acc[key].monthsCount += 1;
    return acc;
  }, {} as Record<string, { name: string; role: string; totalUpcoming: number; monthsCount: number }>);

  const sortedClosers = Object.entries(closerCommissions).sort(
    ([, a], [, b]) => b.totalCommission - a.totalCommission
  );

  const sortedSetters = Object.entries(setterCommissions).sort(
    ([, a], [, b]) => b.totalCommission - a.totalCommission
  );

  const sortedUpcomingMRR = Object.values(upcomingMRRByPerson).sort(
    (a, b) => b.totalUpcoming - a.totalUpcoming
  );

  const totalUpcomingMRR = sortedUpcomingMRR.reduce((sum, p) => sum + p.totalUpcoming, 0);

  const getRankStyles = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-500/30",
          icon: <Trophy className="h-5 w-5 text-yellow-500" />,
          badge: "bg-yellow-500 text-yellow-950",
        };
      case 2:
        return {
          bg: "bg-gradient-to-r from-slate-400/20 to-slate-300/10 border-slate-400/30",
          icon: <Medal className="h-5 w-5 text-slate-400" />,
          badge: "bg-slate-400 text-slate-950",
        };
      case 3:
        return {
          bg: "bg-gradient-to-r from-amber-700/20 to-orange-600/10 border-amber-700/30",
          icon: <Medal className="h-5 w-5 text-amber-700" />,
          badge: "bg-amber-700 text-amber-50",
        };
      default:
        return {
          bg: "bg-secondary/50 border-transparent",
          icon: null,
          badge: "bg-muted text-muted-foreground",
        };
    }
  };

  const renderLeaderboard = (
    data: [string, { totalCommission: number; totalRevenue: number; salesCount: number }][],
    emptyMessage: string
  ) => {
    if (data.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {data.map(([name, stats], index) => {
          const rank = index + 1;
          const styles = getRankStyles(rank);
          
          return (
            <div 
              key={name} 
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01]",
                styles.bg
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                  styles.badge
                )}>
                  {rank <= 3 ? styles.icon : rank}
                </div>
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.salesCount} {stats.salesCount === 1 ? 'deal' : 'deals'} • ${stats.totalRevenue.toLocaleString()} CC
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-lg font-bold",
                  rank === 1 ? "text-yellow-500" : "text-accent"
                )}>
                  ${stats.totalCommission.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderUpcomingMRR = () => {
    if (loadingMRR) {
      return <p className="text-muted-foreground text-center py-8">Loading...</p>;
    }

    if (sortedUpcomingMRR.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          No upcoming MRR commissions
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Total Upcoming</span>
            </div>
            <span className="text-lg font-bold text-primary">
              ${totalUpcomingMRR.toLocaleString()}
            </span>
          </div>
        </div>
        
        {sortedUpcomingMRR.map((person, index) => {
          const rank = index + 1;
          const styles = getRankStyles(rank);
          
          return (
            <div 
              key={`${person.name}-${person.role}`} 
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01]",
                styles.bg
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                  styles.badge
                )}>
                  {rank <= 3 ? styles.icon : rank}
                </div>
                <div>
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {person.role} • {person.monthsCount} {person.monthsCount === 1 ? 'month' : 'months'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-lg font-bold",
                  rank === 1 ? "text-yellow-500" : "text-primary"
                )}>
                  ${person.totalUpcoming.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBookingsLeaderboard = () => {
    if (loadingBookings) {
      return <p className="text-muted-foreground text-center py-8">Loading...</p>;
    }

    const periodLabel = bookingPeriod === 'today' ? 'Today' : bookingPeriod === 'week' ? 'This Week' : 'This Month';
    const totalBookings = setterBookings.reduce((sum, s) => sum + s.count, 0);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total {periodLabel}</span>
              </div>
              <span className="text-lg font-bold text-primary">{totalBookings}</span>
            </div>
          </div>
          <Select value={bookingPeriod} onValueChange={(v) => setBookingPeriod(v as 'today' | 'week' | 'month')}>
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {setterBookings.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No bookings {periodLabel.toLowerCase()}
          </p>
        ) : (
          setterBookings.map((setter, index) => {
            const rank = index + 1;
            const styles = getRankStyles(rank);
            
            return (
              <div 
                key={setter.booking_code} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01]",
                  styles.bg
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                    styles.badge
                  )}>
                    {rank <= 3 ? styles.icon : rank}
                  </div>
                  <div>
                    <p className="font-semibold">{setter.setter_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-bold",
                    rank === 1 ? "text-yellow-500" : "text-primary"
                  )}>
                    {setter.count}
                  </p>
                  <p className="text-xs text-muted-foreground">calls</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="closers" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="closers" className="text-xs">Closers</TabsTrigger>
            <TabsTrigger value="setters" className="text-xs">Setters</TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
            <TabsTrigger value="mrr" className="text-xs">MRR</TabsTrigger>
          </TabsList>
          <TabsContent value="closers" className="mt-3">
            {renderLeaderboard(
              sortedClosers,
              "No closed deals yet"
            )}
          </TabsContent>
          <TabsContent value="setters" className="mt-3">
            {renderLeaderboard(
              sortedSetters,
              "No setter commissions yet"
            )}
          </TabsContent>
          <TabsContent value="bookings" className="mt-3">
            {renderBookingsLeaderboard()}
          </TabsContent>
          <TabsContent value="mrr" className="mt-3">
            {renderUpcomingMRR()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}