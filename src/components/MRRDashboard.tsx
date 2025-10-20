import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { format, addMonths, startOfMonth } from 'date-fns';

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

  useEffect(() => {
    loadNextMonthMRR();
  }, [teamId]);

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

  if (loading) {
    return <div className="p-4">Loading MRR data...</div>;
  }

  if (nextMonthCommissions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Next Month's MRR Commissions</h3>
        <p className="text-muted-foreground">No MRR commissions scheduled for next month</p>
      </Card>
    );
  }

  const totalMRR = nextMonthCommissions.reduce((sum, comm) => sum + Number(comm.commission_amount), 0);

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Next Month's MRR Commissions</h3>
        <p className="text-sm text-muted-foreground">
          {format(addMonths(new Date(), 1), 'MMMM yyyy')} - Total: ${totalMRR.toFixed(2)}
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
          {nextMonthCommissions.map((commission) => (
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
  );
};
