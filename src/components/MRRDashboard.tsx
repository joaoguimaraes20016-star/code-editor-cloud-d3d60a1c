import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { format, addMonths, startOfMonth } from 'date-fns';
import { TrendingUp, DollarSign } from 'lucide-react';
import { Input } from './ui/input';

interface MRRCommission {
  id: string;
  team_member_name: string;
  role: string;
  prospect_name: string;
  prospect_email: string;
  month_date: string;
  mrr_amount: number;
  commission_amount: number;
  commission_percentage: number;
}

interface MRRDashboardProps {
  teamId: string;
}

export const MRRDashboard = ({ teamId }: MRRDashboardProps) => {
  const [nextMonthCommissions, setNextMonthCommissions] = useState<MRRCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSchedulesCount, setActiveSchedulesCount] = useState(0);
  const [totalMRR, setTotalMRR] = useState(0);
  const [taskStats, setTaskStats] = useState({ due: 0, confirmed: 0, canceled: 0, paused: 0 });

  useEffect(() => {
    loadNextMonthMRR();
    loadMRRStats();
    loadTaskStats();
  }, [teamId]);

  const loadMRRStats = async () => {
    try {
      const { data, error } = await supabase
        .from('mrr_schedules')
        .select('mrr_amount')
        .eq('team_id', teamId)
        .eq('status', 'active');

      if (error) throw error;
      
      setActiveSchedulesCount(data?.length || 0);
      setTotalMRR(data?.reduce((sum, s) => sum + s.mrr_amount, 0) || 0);
    } catch (error) {
      console.error('Error loading MRR stats:', error);
    }
  };

  const loadTaskStats = async () => {
    try {
      const { data, error } = await supabase
        .from('mrr_follow_up_tasks')
        .select('status')
        .eq('team_id', teamId);

      if (error) throw error;

      const stats = {
        due: data?.filter(t => t.status === 'due').length || 0,
        confirmed: data?.filter(t => t.status === 'confirmed').length || 0,
        canceled: data?.filter(t => t.status === 'canceled').length || 0,
        paused: data?.filter(t => t.status === 'paused').length || 0,
      };

      setTaskStats(stats);
    } catch (error) {
      console.error('Error loading task stats:', error);
    }
  };

  const loadNextMonthMRR = async () => {
    try {
      setLoading(true);
      const nextMonth = startOfMonth(addMonths(new Date(), 1));
      const nextMonthStr = format(nextMonth, 'yyyy-MM-dd');

      // Only fetch MRR commissions where the sale still exists
      const { data, error } = await supabase
        .from('mrr_commissions')
        .select(`
          *,
          sales!inner(id)
        `)
        .eq('team_id', teamId)
        .eq('month_date', nextMonthStr)
        .order('team_member_name');

      if (error) throw error;
      setNextMonthCommissions(data || []);
    } catch (error) {
      console.error('Error loading MRR:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommissions = nextMonthCommissions.filter(comm => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      comm.team_member_name.toLowerCase().includes(search) ||
      comm.prospect_name.toLowerCase().includes(search) ||
      comm.prospect_email.toLowerCase().includes(search)
    );
  });

  const totalCommissions = filteredCommissions.reduce((sum, comm) => sum + Number(comm.commission_amount), 0);

  if (loading) {
    return <div className="p-4">Loading MRR data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Gradient Header Section */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border border-primary/30 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Active MRR Deals
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeSchedulesCount} active subscription{activeSchedulesCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 border rounded-xl px-6 py-3">
            <DollarSign className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total MRR</p>
              <p className="text-2xl font-bold text-success">
                ${totalMRR.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Input
            placeholder="Search by team member, prospect name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* MRR Task Status Breakdown */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-medium">Due Tasks</p>
            <p className="text-2xl font-bold text-primary">{taskStats.due}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-medium">Confirmed</p>
            <p className="text-2xl font-bold text-success">{taskStats.confirmed}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-medium">Canceled</p>
            <p className="text-2xl font-bold text-destructive">{taskStats.canceled}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-medium">Paused</p>
            <p className="text-2xl font-bold text-warning">{taskStats.paused}</p>
          </div>
        </div>
      </div>

      {/* Commissions Table */}
      {nextMonthCommissions.length === 0 ? (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Next Month's MRR Commissions</h3>
          <p className="text-muted-foreground">No MRR commissions scheduled for next month</p>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Next Month's MRR Commissions</h3>
            <p className="text-sm text-muted-foreground">
              {format(addMonths(new Date(), 1), 'MMMM yyyy')} - Total: ${totalCommissions.toFixed(2)}
            </p>
          </div>
          <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Prospect</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>MRR</TableHead>
            <TableHead>Commission %</TableHead>
            <TableHead className="text-right">Commission</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCommissions.map((commission) => (
            <TableRow key={commission.id}>
              <TableCell className="font-medium">{commission.team_member_name}</TableCell>
              <TableCell className="capitalize">{commission.role}</TableCell>
              <TableCell>{commission.prospect_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{commission.prospect_email}</TableCell>
              <TableCell>${Number(commission.mrr_amount).toFixed(2)}</TableCell>
              <TableCell>{commission.commission_percentage}%</TableCell>
              <TableCell className="text-right font-medium">
                ${Number(commission.commission_amount).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
      )}
    </div>
  );
};
