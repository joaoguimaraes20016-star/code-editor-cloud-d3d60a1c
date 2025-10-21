import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { SalesTable, Sale } from "@/components/SalesTable";
import { AddSaleDialog } from "@/components/AddSaleDialog";
import { FixCommissionsButton } from "@/components/FixCommissionsButton";
import { RevenueChart } from "@/components/RevenueChart";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";
import { Leaderboard } from "@/components/Leaderboard";
import { ImportSpreadsheet } from "@/components/ImportSpreadsheet";
import { SyncFromUrl } from "@/components/SyncFromUrl";
import { DateRangeFilter, DateRangePreset } from "@/components/DateRangeFilter";
import { NewAppointments } from "@/components/NewAppointments";
import { AllNewAppointments } from "@/components/AllNewAppointments";
import { AllClaimed } from "@/components/AllClaimed";
import { MyClaimed } from "@/components/MyClaimed";
import { CloserView } from "@/components/CloserView";
import { MRRDashboard } from "@/components/MRRDashboard";
import { CalendlyConfig } from "@/components/CalendlyConfig";
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
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { useTeamRole } from "@/hooks/useTeamRole";

const Index = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { role: userRole, isOwner } = useTeamRole(teamId);
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [calendlyAccessToken, setCalendlyAccessToken] = useState<string | null>(null);
  const [calendlyOrgUri, setCalendlyOrgUri] = useState<string | null>(null);
  const [calendlyWebhookId, setCalendlyWebhookId] = useState<string | null>(null);
  const [calendlyEventTypes, setCalendlyEventTypes] = useState<string[] | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null; preset: DateRangePreset }>({
    from: null,
    to: null,
    preset: "alltime"
  });
  const [setterCommissionPct, setSetterCommissionPct] = useState(5);
  const [closerCommissionPct, setCloserCommissionPct] = useState(10);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!user || !teamId) {
      navigate('/dashboard');
      return;
    }
    loadUserProfile();
    loadTeamData();
    loadTeamSettings();
    loadTeamMembers();
    loadSales();
    loadAppointments();

    // Set up real-time subscription for appointments
    const appointmentsChannel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, [user, teamId, navigate]);


  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setCurrentUserName(data?.full_name || null);
    } catch (error: any) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('name, calendly_access_token, calendly_organization_uri, calendly_webhook_id, calendly_event_types')
        .eq('id', teamId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTeamName(prev => prev !== data.name ? data.name : prev);
        setCalendlyAccessToken(prev => prev !== data.calendly_access_token ? data.calendly_access_token : prev);
        setCalendlyOrgUri(prev => prev !== data.calendly_organization_uri ? data.calendly_organization_uri : prev);
        setCalendlyWebhookId(prev => prev !== data.calendly_webhook_id ? data.calendly_webhook_id : prev);
        setCalendlyEventTypes(prev => JSON.stringify(prev) !== JSON.stringify(data.calendly_event_types) ? data.calendly_event_types : prev);
      }
    } catch (error: any) {
      console.error('Error loading team:', error);
      toast({
        title: 'Error loading team',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const loadTeamSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('setter_commission_percentage, closer_commission_percentage')
        .eq('id', teamId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSetterCommissionPct(Number(data.setter_commission_percentage) || 5);
        setCloserCommissionPct(Number(data.closer_commission_percentage) || 10);
      }
    } catch (error: any) {
      console.error('Error loading commission settings:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      if (error) throw error;

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        if (profiles) {
          setTeamMembers(profiles.map(p => ({ id: p.id, name: p.full_name || 'Unknown' })));
        }
      }
    } catch (error) {
      console.error('Error loading team members:', error);
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

      console.log(`Loaded ${formattedSales.length} sales, ${formattedSales.filter(s => s.status === 'closed').length} closed`);

      setSales(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(formattedSales)) {
          return formattedSales;
        }
        return prev;
      });
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

  const loadAppointments = async () => {
    try {
      // Load ALL appointments (past and future) for comprehensive filtering
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .order('start_at_utc', { ascending: false });

      if (error) throw error;
      
      console.log(`Loaded ${data?.length || 0} appointments, ${data?.filter(a => a.status === 'CLOSED').length || 0} closed`);
      
      // Only update if data has changed
      setAppointments(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data || [])) {
          return data || [];
        }
        return prev;
      });
    } catch (error: any) {
      console.error('Error loading appointments:', error);
    }
  };

  const handleAddSale = async (newSale: {
    customerName: string;
    setterId: string;
    setter: string;
    salesRepId: string;
    salesRep: string;
    offerOwner: string;
    productName: string;
    date: string;
    ccCollected: number;
    mrrAmount: number;
    mrrMonths: number;
    status: 'closed' | 'pending' | 'no-show';
    setterCommissionPct: number;
    closerCommissionPct: number;
  }) => {
    try {
      console.log('Adding manual sale - CC:', newSale.ccCollected, 'MRR:', newSale.mrrAmount, 'Months:', newSale.mrrMonths);
      
      // Check if closer is the offer owner - if so, no closer commission
      const isCloserOfferOwner = newSale.salesRep === newSale.offerOwner;
      // Check if setter is the offer owner - if so, no setter commission
      const isSetterOfferOwner = newSale.setter === newSale.offerOwner;
      
      // Calculate commissions on CC using configured percentages
      const closerCommission = isCloserOfferOwner ? 0 : newSale.ccCollected * (newSale.closerCommissionPct / 100);
      const setterCommission = (newSale.setterId && !isSetterOfferOwner) ? newSale.ccCollected * (newSale.setterCommissionPct / 100) : 0;
      
      console.log('Calculated commissions - Closer:', closerCommission, 'Setter:', setterCommission, 'Is offer owner:', isCloserOfferOwner);

      // Insert sale record with CC as revenue
      const { data: saleData, error } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          customer_name: newSale.customerName,
          offer_owner: newSale.offerOwner,
          product_name: newSale.productName,
          setter: newSale.setter,
          sales_rep: newSale.salesRep,
          date: newSale.date,
          revenue: newSale.ccCollected, // Revenue is CC
          setter_commission: setterCommission,
          commission: closerCommission,
          status: newSale.status,
        })
        .select()
        .single();

      if (error) throw error;

      // Create MRR commission records if MRR exists
      if (newSale.mrrAmount > 0 && newSale.mrrMonths > 0 && saleData) {
        const { startOfMonth, addMonths, format } = await import('date-fns');
        const mrrCommissions = [];
        
        for (let i = 1; i <= newSale.mrrMonths; i++) {
          const monthDate = startOfMonth(addMonths(new Date(), i));
          
          // Closer MRR commission - only if closer is not the offer owner
          if (!isCloserOfferOwner) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id, // Link to the sale
              team_member_id: newSale.salesRepId,
              team_member_name: newSale.salesRep,
              role: 'closer',
              prospect_name: newSale.customerName,
              prospect_email: '', // Not available for manual sales
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: newSale.mrrAmount,
              commission_amount: newSale.mrrAmount * (newSale.closerCommissionPct / 100),
              commission_percentage: newSale.closerCommissionPct,
            });
          }

          // Setter MRR commission if there's a setter (track MRR even for offer owners)
          if (newSale.setterId) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id, // Link to the sale
              team_member_id: newSale.setterId,
              team_member_name: newSale.setter,
              role: 'setter',
              prospect_name: newSale.customerName,
              prospect_email: '', // Not available for manual sales
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: newSale.mrrAmount,
              commission_amount: newSale.mrrAmount * (newSale.setterCommissionPct / 100),
              commission_percentage: newSale.setterCommissionPct,
            });
          }
        }

        const { error: mrrError } = await supabase
          .from('mrr_commissions')
          .insert(mrrCommissions);

        if (mrrError) throw mrrError;
      }

      toast({
        title: 'Sale added',
        description: 'New sale has been added successfully with all commissions',
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

  // Get unique sales reps - use Map to deduplicate, match partial names to full names
  const allNamesMap = new Map<string, string>();
  
  // First, add all team members with their full names (canonical source)
  teamMembers.forEach(member => {
    const nameLower = member.name.toLowerCase();
    allNamesMap.set(nameLower, member.name);
  });
  
  // Helper function to find best match for a name
  const findBestMatch = (name: string): string => {
    const nameLower = name.toLowerCase();
    
    // Check for exact match first
    if (allNamesMap.has(nameLower)) {
      return allNamesMap.get(nameLower)!;
    }
    
    // Check if this name is a partial match (first name only) of a team member
    for (const [fullNameLower, fullName] of allNamesMap.entries()) {
      const firstName = fullNameLower.split(' ')[0];
      if (firstName === nameLower || fullNameLower.includes(nameLower)) {
        return fullName; // Return the full name from team members
      }
    }
    
    return name; // Return original if no match found
  };
  
  // Add names from sales, matching to full names where possible
  sales.forEach(s => {
    if (s.salesRep) {
      const bestMatch = findBestMatch(s.salesRep);
      const nameLower = bestMatch.toLowerCase();
      if (!allNamesMap.has(nameLower)) {
        allNamesMap.set(nameLower, bestMatch);
      }
    }
    if (s.setter) {
      const bestMatch = findBestMatch(s.setter);
      const nameLower = bestMatch.toLowerCase();
      if (!allNamesMap.has(nameLower)) {
        allNamesMap.set(nameLower, bestMatch);
      }
    }
  });
  
  // Add names from appointments, matching to full names where possible
  appointments.forEach(apt => {
    if (apt.closer_name) {
      const bestMatch = findBestMatch(apt.closer_name);
      const nameLower = bestMatch.toLowerCase();
      if (!allNamesMap.has(nameLower)) {
        allNamesMap.set(nameLower, bestMatch);
      }
    }
    if (apt.setter_name) {
      const bestMatch = findBestMatch(apt.setter_name);
      const nameLower = bestMatch.toLowerCase();
      if (!allNamesMap.has(nameLower)) {
        allNamesMap.set(nameLower, bestMatch);
      }
    }
  });
  
  const salesReps = ['all', ...Array.from(allNamesMap.values()).sort()];

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

  // Filter appointments by date range
  const filteredAppointments = appointments.filter(apt => {
    if (!dateRange.from && !dateRange.to) return true;
    const aptDate = new Date(apt.start_at_utc);
    aptDate.setHours(0, 0, 0, 0);
    if (dateRange.from && dateRange.to) {
      return aptDate >= dateRange.from && aptDate <= dateRange.to;
    } else if (dateRange.from) {
      return aptDate >= dateRange.from;
    } else if (dateRange.to) {
      return aptDate <= dateRange.to;
    }
    return true;
  });

  // Calculate metrics from CLOSED appointments only (actual deals closed)
  // Note: We filter for CLOSED status only, cc_collected can be 0 for some deals
  const closedAppointments = filteredAppointments.filter(apt => apt.status === 'CLOSED');
  
  // Include CC from both closed appointments AND closed sales
  const ccFromAppointments = closedAppointments.reduce((sum, apt) => sum + (Number(apt.cc_collected) || 0), 0);
  const ccFromSales = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + (Number(sale.revenue) || 0), 0);
  const totalCCRevenue = ccFromAppointments + ccFromSales;
  
  const totalMRR = closedAppointments.reduce((sum, apt) => sum + ((Number(apt.mrr_amount) || 0) * (Number(apt.mrr_months) || 0)), 0);
  
  // Include commissions from both appointments AND sales
  const commissionsFromAppointments = closedAppointments.reduce((sum, apt) => {
    const cc = Number(apt.cc_collected) || 0;
    const closerComm = cc * (closerCommissionPct / 100);
    const setterComm = apt.setter_id ? cc * (setterCommissionPct / 100) : 0;
    return sum + closerComm + setterComm;
  }, 0);
  
  const commissionsFromSales = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + (Number(sale.commission) || 0) + (Number(sale.setterCommission) || 0), 0);
  
  const totalCommissions = commissionsFromAppointments + commissionsFromSales;
  
  // Calculate appointment-based metrics
  const showedAppointments = filteredAppointments.filter(apt => apt.status === 'SHOWED' || apt.status === 'CLOSED');
  const noShowAppointments = filteredAppointments.filter(apt => apt.status === 'NO_SHOW');
  const totalScheduledAppointments = filteredAppointments.length;
  
  // Include closed sales in close rate calculation
  const closedSalesCount = filteredSales.filter(s => s.status === 'closed').length;
  const totalClosedDeals = closedAppointments.length + closedSalesCount;
  const totalShowedOrClosed = showedAppointments.length + closedSalesCount;
  
  // Close Rate: All closed deals (appointments + sales) / All showed opportunities (appointments + sales)
  const closeRate = totalShowedOrClosed > 0 
    ? ((totalClosedDeals / totalShowedOrClosed) * 100).toFixed(1)
    : '0';
  
  // Show-Up Rate: Appointments that SHOWED / Total SCHEDULED
  const showUpRate = totalScheduledAppointments > 0
    ? ((showedAppointments.length / totalScheduledAppointments) * 100).toFixed(1)
    : '0';

  // No-Show Rate: NO_SHOW appointments / Total SCHEDULED
  const noShowRate = totalScheduledAppointments > 0
    ? ((noShowAppointments.length / totalScheduledAppointments) * 100).toFixed(1)
    : '0';

  // Deals that showed but didn't close
  const showedButNotClosed = showedAppointments.length - closedAppointments.length;

  // Calculate leaderboards (exclude zero commissions)
  const closedSales = filteredSales.filter(s => s.status === 'closed');
  
  const closerLeaderboard = Object.entries(
    closedSales
      .filter(sale => sale.commission > 0)
      .reduce((acc, sale) => {
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
    closedSales
      .filter(sale => sale.setterCommission > 0)
      .reduce((acc, sale) => {
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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-xs md:text-sm">
                <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                Back
              </Button>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <Logo size="large" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{teamName}</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Track your sales performance and commissions
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {isOwner && (
              <Button variant="outline" onClick={() => navigate(`/team/${teamId}/settings`)} className="text-sm md:text-base w-full sm:w-auto">
                <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                Settings
              </Button>
            )}
            <AddSaleDialog onAddSale={handleAddSale} preselectedOfferOwner={userRole === 'offer_owner' ? currentUserName : undefined} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid h-auto">
            <TabsTrigger value="dashboard" className="text-xs md:text-sm py-2 md:py-2.5">Dashboard</TabsTrigger>
            {canViewSetterScheduling && (
              <TabsTrigger value="scheduling" className="text-xs md:text-sm py-2 md:py-2.5">Appointments</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-3 md:gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
            <label className="text-xs md:text-sm font-medium">Date Range:</label>
            <DateRangeFilter onRangeChange={setDateRange} />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
            <label className="text-xs md:text-sm font-medium">Sales Rep:</label>
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-full md:w-[200px] bg-card text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                {salesReps.map((rep) => (
                  <SelectItem key={rep} value={rep} className="text-sm">
                    {rep === 'all' ? 'All Sales Reps' : rep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-6">
          <MetricCard
            title="CC Revenue"
            value={`$${totalCCRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            trend={`${totalClosedDeals} deals closed`}
            trendUp
          />
          <MetricCard
            title="Total MRR"
            value={`$${totalMRR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            trend="All recurring revenue"
            trendUp
          />
          <MetricCard
            title="Total Commissions"
            value={`$${totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={TrendingUp}
            trend="From closed deals"
            trendUp
          />
          <MetricCard
            title="Close Rate"
            value={`${closeRate}%`}
            icon={Users}
            trend={`${totalClosedDeals}/${totalShowedOrClosed} showed closed`}
            trendUp={Number(closeRate) >= 30}
          />
          <MetricCard
            title="Show Up Rate"
            value={`${showUpRate}%`}
            icon={Calendar}
            trend={`${showedAppointments.length}/${totalScheduledAppointments} showed`}
            trendUp={Number(showUpRate) >= 70}
          />
          <MetricCard
            title="No-Show Rate"
            value={`${noShowRate}%`}
            icon={Calendar}
            trend={`${noShowAppointments.length}/${totalScheduledAppointments} no-shows`}
            trendUp={false}
          />
        </div>

        {/* Not Closed Deals Alert */}
        {showedButNotClosed > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>{showedButNotClosed}</strong> appointment{showedButNotClosed !== 1 ? 's' : ''} showed up but {showedButNotClosed !== 1 ? 'were' : 'was'} not closed yet
            </p>
          </div>
        )}

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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">
                  {selectedRep === 'all' ? 'All Sales' : `${selectedRep}'s Sales`}
                </h2>
                <div className="flex gap-2">
                  {isOwner && <FixCommissionsButton teamId={teamId || ''} onComplete={loadSales} />}
                  <ImportSpreadsheet teamId={teamId!} onImport={() => {
                    loadSales();
                    loadAppointments();
                  }} />
                  <SyncFromUrl teamId={teamId!} onSync={() => {
                    loadSales();
                    loadAppointments();
                  }} />
                </div>
              </div>
              <SalesTable 
                sales={filteredSales} 
                userRole={userRole}
                currentUserName={currentUserName}
                teamMembers={teamMembers}
                onSaleDeleted={() => {
                  loadSales();
                  loadAppointments();
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-6 mt-6">
            {(userRole === "owner" || userRole === "offer_owner" || userRole === "admin") && (
              <CalendlyConfig 
                teamId={teamId!} 
                currentAccessToken={calendlyAccessToken}
                currentOrgUri={calendlyOrgUri}
                currentWebhookId={calendlyWebhookId}
                currentEventTypes={calendlyEventTypes}
                onUpdate={loadTeamData}
              />
            )}
            
            <Tabs defaultValue="all-new" className="w-full">
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
                  {canViewSetterScheduling && <TabsTrigger value="all-new" className="text-xs md:text-sm flex-1 md:flex-none">All Appointments</TabsTrigger>}
                  {canViewSetterScheduling && <TabsTrigger value="unassigned" className="text-xs md:text-sm flex-1 md:flex-none">Unassigned Appointments</TabsTrigger>}
                  {canViewSetterScheduling && <TabsTrigger value="claimed" className="text-xs md:text-sm flex-1 md:flex-none">Assigned Appointments</TabsTrigger>}
                  {canViewSetterScheduling && <TabsTrigger value="my-claimed" className="text-xs md:text-sm flex-1 md:flex-none">My Assigned</TabsTrigger>}
                  <TabsTrigger value="closer" className="text-xs md:text-sm flex-1 md:flex-none">Closer View</TabsTrigger>
                </TabsList>
              </div>

              {canViewSetterScheduling && (
                <>
                  <TabsContent value="all-new" className="mt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">All Appointments</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        View all appointments in the system
                      </p>
                      <AllNewAppointments 
                        teamId={teamId!} 
                        closerCommissionPct={closerCommissionPct}
                        setterCommissionPct={setterCommissionPct}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="unassigned" className="mt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Unassigned Appointments</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Assign setters and closers to new appointments
                      </p>
                      <NewAppointments 
                        teamId={teamId!}
                        closerCommissionPct={closerCommissionPct}
                        setterCommissionPct={setterCommissionPct}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="claimed" className="mt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Assigned Appointments</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        View all assigned appointments in the system
                      </p>
                      <AllClaimed 
                        teamId={teamId!}
                        closerCommissionPct={closerCommissionPct}
                        setterCommissionPct={setterCommissionPct}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="my-claimed" className="mt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">My Assigned Appointments</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manage your assigned appointments and add notes
                      </p>
                      <MyClaimed 
                        teamId={teamId!}
                        closerCommissionPct={closerCommissionPct}
                        setterCommissionPct={setterCommissionPct}
                      />
                    </div>
                  </TabsContent>
                </>
              )}

              <TabsContent value="closer" className="mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Closer View</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Close deals and manage appointments
                  </p>
                  <CloserView teamId={teamId!} />
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
