import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { SalesTable, Sale } from "@/components/SalesTable";
import { AddSaleDialog } from "@/components/AddSaleDialog";
import { RevenueChart } from "@/components/RevenueChart";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";
import { ImportSpreadsheet } from "@/components/ImportSpreadsheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, Calendar, ArrowLeft, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTeamRole } from "@/hooks/useTeamRole";

const Index = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { role: userRole, isOwner } = useTeamRole(teamId);
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    if (!user || !teamId) {
      navigate('/');
      return;
    }
    loadTeamData();
    loadClients();
    loadSales();
  }, [user, teamId, navigate]);

  const loadTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      setTeamName(data.name);
    } catch (error: any) {
      toast({
        title: 'Error loading team',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading clients',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, clients(name)')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedSales: Sale[] = (data || []).map((sale: any) => ({
        id: sale.id,
        customerName: sale.customer_name,
        setter: sale.setter,
        salesRep: sale.sales_rep,
        date: sale.date,
        revenue: Number(sale.revenue),
        setterCommission: Number(sale.setter_commission),
        commission: Number(sale.commission),
        status: sale.status,
        clientName: sale.clients?.name,
      }));

      setSales(formattedSales);
    } catch (error: any) {
      toast({
        title: 'Error loading sales',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSale = async (newSale: Omit<Sale, 'id'>) => {
    try {
      const { error } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          client_id: newSale.clientId || null,
          customer_name: newSale.customerName,
          setter: newSale.setter,
          sales_rep: newSale.salesRep,
          date: newSale.date,
          revenue: newSale.revenue,
          setter_commission: newSale.setterCommission,
          commission: newSale.commission,
          status: newSale.status,
        });

      if (error) throw error;

      toast({
        title: 'Sale added',
        description: 'New sale has been added successfully',
      });

      loadSales();
    } catch (error: any) {
      toast({
        title: 'Error adding sale',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleImport = async (importedSales: Omit<Sale, 'id'>[]) => {
    try {
      const salesData = importedSales.map(sale => ({
        team_id: teamId,
        client_id: sale.clientId || null,
        customer_name: sale.customerName,
        setter: sale.setter,
        sales_rep: sale.salesRep,
        date: sale.date,
        revenue: sale.revenue,
        setter_commission: sale.setterCommission,
        commission: sale.commission,
        status: sale.status,
      }));

      const { error } = await supabase
        .from('sales')
        .insert(salesData);

      if (error) throw error;

      toast({
        title: 'Sales imported',
        description: `${importedSales.length} sales have been imported successfully`,
      });

      loadSales();
    } catch (error: any) {
      toast({
        title: 'Error importing sales',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Get unique sales reps
  const salesReps = ['all', ...new Set(sales.map(s => s.salesRep))];

  // Filter sales by selected rep and client
  const filteredSales = sales.filter(s => {
    const repMatch = selectedRep === 'all' || s.salesRep === selectedRep;
    const clientMatch = selectedClient === 'all' || s.clientId === selectedClient;
    return repMatch && clientMatch;
  });

  // Calculate metrics
  const totalRevenue = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + sale.revenue, 0);
  
  const totalCommissions = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + sale.commission + sale.setterCommission, 0);
  
  const closeRate = filteredSales.length > 0 
    ? ((filteredSales.filter(s => s.status === 'closed').length / filteredSales.length) * 100).toFixed(1)
    : '0';
  
  const showUpRate = filteredSales.length > 0
    ? ((filteredSales.filter(s => s.status !== 'no-show').length / filteredSales.length) * 100).toFixed(1)
    : '0';

  // Prepare chart data (last 7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const dayRevenue = sales
      .filter(s => s.date === dateStr && s.status === 'closed')
      .reduce((sum, s) => sum + s.revenue, 0);

    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: dayRevenue,
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{teamName}</h1>
            <p className="text-muted-foreground mt-1">
              Track your sales performance and commissions
            </p>
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <Button variant="outline" onClick={() => navigate(`/team/${teamId}/settings`)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
            <ImportSpreadsheet onImport={handleImport} />
            <AddSaleDialog onAddSale={handleAddSale} clients={clients} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sales Rep:</label>
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-[200px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                {salesReps.map((rep) => (
                  <SelectItem key={rep} value={rep}>
                    {rep === 'all' ? 'All Sales Reps' : rep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Client:</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            trend="+12.5% from last month"
            trendUp
          />
          {userRole === 'owner' && (
            <MetricCard
              title="Total Commissions"
              value={`$${totalCommissions.toLocaleString()}`}
              icon={TrendingUp}
              trend="+8.2% from last month"
              trendUp
            />
          )}
          <MetricCard
            title="Close Rate"
            value={`${closeRate}%`}
            icon={Users}
            trend="+4.3% from last month"
            trendUp
          />
          <MetricCard
            title="Show Up Rate"
            value={`${showUpRate}%`}
            icon={Calendar}
            trend="-2.1% from last month"
            trendUp={false}
          />
        </div>

        {/* Commission Breakdown - Only for owners */}
        {userRole === 'owner' && <CommissionBreakdown sales={filteredSales} />}

        {/* Chart */}
        <RevenueChart data={chartData} />

        {/* Sales Table */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            {selectedRep === 'all' ? 'All Sales' : `${selectedRep}'s Sales`}
            {selectedClient !== 'all' && ` - ${clients.find(c => c.id === selectedClient)?.name}`}
          </h2>
          <SalesTable sales={filteredSales} userRole={userRole} />
        </div>
      </div>
    </div>
  );
};

export default Index;
