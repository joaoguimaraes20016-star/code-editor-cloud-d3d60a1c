import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { SalesTable, Sale } from "@/components/SalesTable";
import { AddSaleDialog } from "@/components/AddSaleDialog";
import { RevenueChart } from "@/components/RevenueChart";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";
import { Leaderboard } from "@/components/Leaderboard";
import { ImportSpreadsheet } from "@/components/ImportSpreadsheet";
import { DateRangeFilter, DateRangePreset } from "@/components/DateRangeFilter";
import { NewAppointments } from "@/components/NewAppointments";
import { AllClaimed } from "@/components/AllClaimed";
import { MyClaimed } from "@/components/MyClaimed";
import { CloserView } from "@/components/CloserView";
import { MRRDashboard } from "@/components/MRRDashboard";
import { ImportAppointments } from "@/components/ImportAppointments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null; preset: DateRangePreset }>({
    from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    to: new Date(),
    preset: "last7days"
  });

  useEffect(() => {
    if (!user || !teamId) {
      navigate('/');
      return;
    }
    loadTeamData();
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

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedSales: Sale[] = (data || []).map((sale: any) => ({
        id: sale.id,
        customerName: sale.customer_name,
        offerOwner: sale.offer_owner || '',
        setter: sale.setter,
        salesRep: sale.sales_rep,
        date: sale.date,
        revenue: Number(sale.revenue),
        setterCommission: Number(sale.setter_commission),
        commission: Number(sale.commission),
        status: sale.status,
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

  const handleAddSale = async (newSale: {
    customerName: string;
    setter: string;
    salesRep: string;
    offerOwner: string;
    date: string;
    revenue: number;
    setterCommission: number;
    commission: number;
    status: 'closed' | 'pending' | 'no-show';
  }) => {
    try {
      const { error } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          customer_name: newSale.customerName,
          offer_owner: newSale.offerOwner,
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
        customer_name: sale.customerName,
        offer_owner: sale.offerOwner,
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

  // Filter sales by selected rep and date range
  const filteredSales = sales.filter(s => {
    const repMatch = selectedRep === 'all' || s.salesRep === selectedRep;
    
    // Date range filtering
    let dateMatch = true;
    if (dateRange.from || dateRange.to) {
      const saleDate = new Date(s.date);
      saleDate.setHours(0, 0, 0, 0);
      
      if (dateRange.from && dateRange.to) {
        dateMatch = saleDate >= dateRange.from && saleDate <= dateRange.to;
      } else if (dateRange.from) {
        dateMatch = saleDate >= dateRange.from;
      } else if (dateRange.to) {
        dateMatch = saleDate <= dateRange.to;
      }
    }
    
    return repMatch && dateMatch;
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

  // Calculate leaderboards
  const closedSales = filteredSales.filter(s => s.status === 'closed');
  
  const closerLeaderboard = Object.entries(
    closedSales.reduce((acc, sale) => {
      if (!acc[sale.salesRep]) {
        acc[sale.salesRep] = { sales: 0, revenue: 0, commission: 0 };
      }
      acc[sale.salesRep].sales += 1;
      acc[sale.salesRep].revenue += sale.revenue;
      acc[sale.salesRep].commission += sale.commission;
      return acc;
    }, {} as Record<string, { sales: number; revenue: number; commission: number }>)
  )
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.commission - a.commission);

  const setterLeaderboard = Object.entries(
    closedSales.reduce((acc, sale) => {
      if (!acc[sale.setter]) {
        acc[sale.setter] = { sales: 0, revenue: 0, commission: 0 };
      }
      acc[sale.setter].sales += 1;
      acc[sale.setter].revenue += sale.revenue;
      acc[sale.setter].commission += sale.setterCommission;
      return acc;
    }, {} as Record<string, { sales: number; revenue: number; commission: number }>)
  )
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.commission - a.commission);

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

  const canViewSetterScheduling = userRole === 'setter' || userRole === 'admin' || isOwner;
  const canViewCloserScheduling = userRole === 'closer' || userRole === 'admin' || isOwner;

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
            <AddSaleDialog onAddSale={handleAddSale} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            {(canViewSetterScheduling || canViewCloserScheduling) && (
              <TabsTrigger value="scheduling">Appointments</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date Range:</label>
            <DateRangeFilter onRangeChange={setDateRange} />
          </div>

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
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            trend="+12.5% from last month"
            trendUp
          />
          <MetricCard
            title="Total Commissions"
            value={`$${totalCommissions.toLocaleString()}`}
            icon={TrendingUp}
            trend="+8.2% from last month"
            trendUp
          />
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

        {/* MRR Dashboard */}
        <MRRDashboard teamId={teamId!} />

        {/* Commission Breakdown */}
        <CommissionBreakdown sales={filteredSales} />

        {/* Leaderboards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Leaderboard 
            title="Top Closers" 
            entries={closerLeaderboard}
            type="closer"
          />
          <Leaderboard 
            title="Top Setters" 
            entries={setterLeaderboard}
            type="setter"
          />
        </div>

        {/* Chart */}
        <RevenueChart data={chartData} />

            {/* Sales Table */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">
                {selectedRep === 'all' ? 'All Sales' : `${selectedRep}'s Sales`}
              </h2>
              <SalesTable sales={filteredSales} />
            </div>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-6 mt-6">
            <Tabs defaultValue={canViewSetterScheduling ? "new" : "closer"} className="w-full">
              <TabsList>
                {canViewSetterScheduling && <TabsTrigger value="new">New Appointments</TabsTrigger>}
                {canViewSetterScheduling && <TabsTrigger value="claimed">All Assigned</TabsTrigger>}
                {canViewSetterScheduling && <TabsTrigger value="my-claimed">My Assigned</TabsTrigger>}
                {canViewCloserScheduling && <TabsTrigger value="closer">Closer View</TabsTrigger>}
              </TabsList>

              {canViewSetterScheduling && (
                <>
                  <TabsContent value="new" className="mt-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-2xl font-semibold">New Appointments</h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            Import daily CSV or click "Assign" to add appointments to your list
                          </p>
                        </div>
                        <ImportAppointments teamId={teamId!} onImport={loadSales} />
                      </div>
                      <NewAppointments teamId={teamId!} />
                    </div>
                  </TabsContent>

                  <TabsContent value="claimed" className="mt-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-4">All Assigned Appointments</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        View all appointments assigned to setters
                      </p>
                      <AllClaimed teamId={teamId!} />
                    </div>
                  </TabsContent>

                  <TabsContent value="my-claimed" className="mt-6">
                    <div>
                      <h2 className="text-2xl font-semibold mb-4">My Assigned Appointments</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manage your assigned appointments and add notes
                      </p>
                      <MyClaimed teamId={teamId!} />
                    </div>
                  </TabsContent>
                </>
              )}

              {canViewCloserScheduling && (
                <TabsContent value="closer" className="mt-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-4">Closer Dashboard</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Close deals and track your closed appointments
                    </p>
                    <CloserView teamId={teamId!} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
