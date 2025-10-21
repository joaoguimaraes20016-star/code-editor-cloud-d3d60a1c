import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';

interface DashboardStats {
  total: number;
  complete: number;
  inProgress: number;
  notStarted: number;
  needsUpdate: number;
}

interface ClientAssetsDashboardProps {
  teamId: string;
}

export function ClientAssetsDashboard({ teamId }: ClientAssetsDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    complete: 0,
    inProgress: 0,
    notStarted: 0,
    needsUpdate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('client-assets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_assets',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadStats = async () => {
    setLoading(true);
    console.log('Loading stats for team:', teamId);
    const { data, error } = await supabase
      .from('client_assets')
      .select('status')
      .eq('team_id', teamId);

    console.log('Stats query result:', { data, error, dataLength: data?.length });

    if (error) {
      console.error('Error loading stats:', error);
      setLoading(false);
      return;
    }

    const newStats = {
      total: data.length,
      complete: data.filter((a) => a.status === 'complete').length,
      inProgress: data.filter((a) => a.status === 'in_progress').length,
      notStarted: data.filter((a) => a.status === 'not_started').length,
      needsUpdate: data.filter((a) => a.status === 'needs_update').length,
    };

    setStats(newStats);
    setLoading(false);
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    icon: any;
    color: string;
  }) => (
    <Card className="bg-card/50 backdrop-blur-sm border-2 border-border hover:border-primary/50 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{loading ? '...' : value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Clients"
        value={stats.total}
        icon={Users}
        color="text-primary"
      />
      <StatCard
        title="Complete"
        value={stats.complete}
        icon={CheckCircle}
        color="text-green-500"
      />
      <StatCard
        title="In Progress"
        value={stats.inProgress}
        icon={Clock}
        color="text-yellow-500"
      />
      <StatCard
        title="Needs Update"
        value={stats.needsUpdate}
        icon={AlertCircle}
        color="text-red-500"
      />
    </div>
  );
}
