import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface MonthlyCommissionReportProps {
  teamId: string;
}

export function MonthlyCommissionReport({ teamId }: MonthlyCommissionReportProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [setterData, setSetterData] = useState<any[]>([]);
  const [closerData, setCloserData] = useState<any[]>([]);
  const [mrrData, setMrrData] = useState<any[]>([]);
  const [selectedSetter, setSelectedSetter] = useState('all');
  const [selectedCloser, setSelectedCloser] = useState('all');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    loadTeamMembers();
    loadData();
  }, [teamId, selectedMonth]);

  const loadTeamMembers = async () => {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (members) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profiles) {
        setTeamMembers(profiles.map(p => ({
          id: p.id,
          name: p.full_name,
          role: members.find(m => m.user_id === p.id)?.role
        })));
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      // Load setter commissions (from booked appointments)
      const { data: setterAppts } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('setter_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      // Load closer commissions (from closed deals)
      const { data: closerAppts } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'CLOSED')
        .gte('updated_at', start.toISOString())
        .lte('updated_at', end.toISOString())
        .order('updated_at', { ascending: false });

      // Load MRR commissions
      const { data: mrr } = await supabase
        .from('mrr_commissions')
        .select('*')
        .eq('team_id', teamId)
        .gte('month_date', start.toISOString().split('T')[0])
        .lte('month_date', end.toISOString().split('T')[0])
        .order('month_date', { ascending: false });

      // Get team commission settings
      const { data: team } = await supabase
        .from('teams')
        .select('setter_commission_percentage, closer_commission_percentage')
        .eq('id', teamId)
        .maybeSingle();

      const setterPct = Number(team?.setter_commission_percentage || 5);
      const closerPct = Number(team?.closer_commission_percentage || 10);

      setSetterData((setterAppts || []).map(apt => ({
        ...apt,
        commission: Number(apt.cc_collected || 0) * (setterPct / 100)
      })));

      setCloserData((closerAppts || []).map(apt => ({
        ...apt,
        commission: Number(apt.cc_collected || 0) * (closerPct / 100)
      })));

      setMrrData(mrr || []);
    } catch (error) {
      console.error('Error loading commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSetterData = selectedSetter === 'all' 
    ? setterData 
    : setterData.filter(d => d.setter_name === selectedSetter);

  const filteredCloserData = selectedCloser === 'all'
    ? closerData
    : closerData.filter(d => d.closer_name === selectedCloser);

  const setterTotals = {
    appointments: filteredSetterData.length,
    closed: filteredSetterData.filter(d => d.status === 'CLOSED').length,
    commission: filteredSetterData.reduce((sum, d) => sum + d.commission, 0)
  };

  const closerTotals = {
    deals: filteredCloserData.length,
    revenue: filteredCloserData.reduce((sum, d) => sum + (Number(d.cc_collected) || 0), 0),
    commission: filteredCloserData.reduce((sum, d) => sum + d.commission, 0)
  };

  const mrrTotals = {
    amount: mrrData.reduce((sum, m) => sum + (Number(m.mrr_amount) || 0), 0),
    commission: mrrData.reduce((sum, m) => sum + (Number(m.commission_amount) || 0), 0)
  };

  const exportToCSV = (type: 'setter' | 'closer' | 'mrr') => {
    let data: any[][] = [];
    let filename = '';

    if (type === 'setter') {
      data = [
        ['Setter Commission Report', format(selectedMonth, 'MMMM yyyy')],
        [],
        ['Lead Name', 'Booked Date', 'Status', 'Closed Date', 'Close Amount', 'Commission'],
        ...filteredSetterData.map(d => [
          d.lead_name,
          format(new Date(d.created_at), 'MMM dd, yyyy'),
          d.status,
          d.status === 'CLOSED' ? format(new Date(d.updated_at), 'MMM dd, yyyy') : '',
          `$${Number(d.cc_collected || 0).toLocaleString()}`,
          `$${d.commission.toFixed(2)}`
        ]),
        [],
        ['Totals', '', '', '', '', `$${setterTotals.commission.toFixed(2)}`]
      ];
      filename = `Setter_Commissions_${format(selectedMonth, 'yyyy-MM')}.csv`;
    } else if (type === 'closer') {
      data = [
        ['Closer Commission Report', format(selectedMonth, 'MMMM yyyy')],
        [],
        ['Lead Name', 'Closed Date', 'Product', 'Close Amount', 'Commission', 'MRR'],
        ...filteredCloserData.map(d => [
          d.lead_name,
          format(new Date(d.updated_at), 'MMM dd, yyyy'),
          d.product_name || '',
          `$${Number(d.cc_collected).toLocaleString()}`,
          `$${d.commission.toFixed(2)}`,
          d.mrr_amount ? `$${Number(d.mrr_amount)}x${d.mrr_months}mo` : ''
        ]),
        [],
        ['Totals', '', '', `$${closerTotals.revenue.toLocaleString()}`, `$${closerTotals.commission.toFixed(2)}`, '']
      ];
      filename = `Closer_Commissions_${format(selectedMonth, 'yyyy-MM')}.csv`;
    } else {
      data = [
        ['MRR Commission Report', format(selectedMonth, 'MMMM yyyy')],
        [],
        ['Month', 'Team Member', 'Client', 'MRR Amount', 'Commission %', 'Commission'],
        ...mrrData.map(m => [
          format(new Date(m.month_date), 'MMM yyyy'),
          m.team_member_name,
          m.prospect_name,
          `$${Number(m.mrr_amount).toLocaleString()}`,
          `${m.commission_percentage}%`,
          `$${Number(m.commission_amount).toFixed(2)}`
        ]),
        [],
        ['Totals', '', '', `$${mrrTotals.amount.toLocaleString()}`, '', `$${mrrTotals.commission.toFixed(2)}`]
      ];
      filename = `MRR_Commissions_${format(selectedMonth, 'yyyy-MM')}.csv`;
    }

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i));

  return (
    <div className="space-y-6">
      {/* Header with Date Picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Monthly Commission Report</h2>
        </div>
        <Select 
          value={selectedMonth.toISOString()} 
          onValueChange={(v) => setSelectedMonth(new Date(v))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(month => (
              <SelectItem key={month.toISOString()} value={month.toISOString()}>
                {format(month, 'MMMM yyyy')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">${closerTotals.revenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Setter Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">${setterTotals.commission.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closer Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">${closerTotals.commission.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">${mrrTotals.amount.toLocaleString()}/mo</p>
          </CardContent>
        </Card>
      </div>

      {/* Setter Commission Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Setter Commissions</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedSetter} onValueChange={setSelectedSetter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Setters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Setters</SelectItem>
                  {Array.from(new Set(setterData.map(d => d.setter_name))).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => exportToCSV('setter')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Name</TableHead>
                <TableHead>Booked Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Close Amount</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSetterData.map(apt => (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium">{apt.lead_name}</TableCell>
                  <TableCell>{format(new Date(apt.created_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={apt.status === 'CLOSED' ? 'success' : 'secondary'}>
                      {apt.status}
                    </Badge>
                  </TableCell>
                  <TableCell>${Number(apt.cc_collected || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">${apt.commission.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell>{setterTotals.appointments} appointments</TableCell>
                <TableCell>{setterTotals.closed} closed</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">${setterTotals.commission.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Closer Commission Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Closer Commissions</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Closers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Closers</SelectItem>
                  {Array.from(new Set(closerData.map(d => d.closer_name))).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => exportToCSV('closer')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Name</TableHead>
                <TableHead>Closed Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Close Amount</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCloserData.map(apt => (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium">{apt.lead_name}</TableCell>
                  <TableCell>{format(new Date(apt.updated_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{apt.product_name || '-'}</TableCell>
                  <TableCell>${Number(apt.cc_collected).toLocaleString()}</TableCell>
                  <TableCell>
                    {apt.mrr_amount ? `$${Number(apt.mrr_amount)}x${apt.mrr_months}mo` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">${apt.commission.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell>{closerTotals.deals} deals</TableCell>
                <TableCell></TableCell>
                <TableCell>${closerTotals.revenue.toLocaleString()}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">${closerTotals.commission.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MRR Commission Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>MRR Recurring Commissions</CardTitle>
            <Button size="sm" variant="outline" onClick={() => exportToCSV('mrr')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>MRR Amount</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mrrData.map((m, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{m.team_member_name}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'closer' ? 'default' : 'secondary'}>
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.prospect_name}</TableCell>
                  <TableCell>${Number(m.mrr_amount).toLocaleString()}</TableCell>
                  <TableCell>{m.commission_percentage}%</TableCell>
                  <TableCell className="text-right font-medium">${Number(m.commission_amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell>${mrrTotals.amount.toLocaleString()}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">${mrrTotals.commission.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
