import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Target, Calendar } from 'lucide-react';
import { startOfMonth, startOfWeek, endOfMonth, endOfWeek, format } from 'date-fns';

interface CloserStatsCardProps {
  teamId: string;
  userId: string;
}

interface Stats {
  today: {
    deals: number;
    revenue: number;
    commission: number;
  };
  thisWeek: {
    deals: number;
    revenue: number;
    commission: number;
  };
  thisMonth: {
    deals: number;
    revenue: number;
    commission: number;
  };
}

export function CloserStatsCard({ teamId, userId }: CloserStatsCardProps) {
  const [stats, setStats] = useState<Stats>({
    today: { deals: 0, revenue: 0, commission: 0 },
    thisWeek: { deals: 0, revenue: 0, commission: 0 },
    thisMonth: { deals: 0, revenue: 0, commission: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [teamId, userId]);

  const loadStats = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const weekStart = startOfWeek(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();

      // Load closed appointments
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('cc_collected, mrr_amount, created_at')
        .eq('team_id', teamId)
        .eq('closer_id', userId)
        .in('status', ['CLOSED'])
        .gte('created_at', monthStart);

      if (error) throw error;

      // Get commission percentages
      const { data: teamSettings } = await supabase
        .from('teams')
        .select('closer_commission_percentage')
        .eq('id', teamId)
        .single();

      const commissionPct = (teamSettings?.closer_commission_percentage || 10) / 100;

      // Calculate stats
      const todayData = appointments?.filter(a => a.created_at >= todayStart) || [];
      const weekData = appointments?.filter(a => a.created_at >= weekStart) || [];
      const monthData = appointments || [];

      const calcStats = (data: typeof appointments) => ({
        deals: data?.length || 0,
        revenue: data?.reduce((sum, a) => sum + (a.cc_collected || 0), 0) || 0,
        commission: data?.reduce((sum, a) => sum + ((a.cc_collected || 0) * commissionPct), 0) || 0
      });

      setStats({
        today: calcStats(todayData),
        thisWeek: calcStats(weekData),
        thisMonth: calcStats(monthData)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading stats...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.today.deals} deals</div>
          <p className="text-xs text-muted-foreground">
            ${stats.today.revenue.toFixed(0)} revenue
          </p>
          <p className="text-xs font-medium text-primary mt-1">
            ${stats.today.commission.toFixed(0)} commission
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.thisWeek.deals} deals</div>
          <p className="text-xs text-muted-foreground">
            ${stats.thisWeek.revenue.toFixed(0)} revenue
          </p>
          <p className="text-xs font-medium text-primary mt-1">
            ${stats.thisWeek.commission.toFixed(0)} commission
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.thisMonth.deals} deals</div>
          <p className="text-xs text-muted-foreground">
            ${stats.thisMonth.revenue.toFixed(0)} revenue
          </p>
          <p className="text-xs font-medium text-primary mt-1">
            ${stats.thisMonth.commission.toFixed(0)} commission
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
