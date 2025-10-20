import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { format, addMonths, startOfMonth } from "date-fns";
import { DollarSign, MessageSquare, Clock, Mail, User } from "lucide-react";
import { getUserFriendlyError } from "@/lib/errorUtils";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  setter_name: string | null;
  setter_notes: string | null;
  setter_id: string | null;
  revenue: number;
  closer_name: string | null;
  closer_id: string | null;
  cc_collected?: number;
  mrr_amount?: number;
  mrr_months?: number;
  product_name?: string;
}

interface CloserViewProps {
  teamId: string;
}

export function CloserView({ teamId }: CloserViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [allNewAppointments, setAllNewAppointments] = useState<Appointment[]>([]);
  const [myNewAppointments, setMyNewAppointments] = useState<Appointment[]>([]);
  const [allClosedAppointments, setAllClosedAppointments] = useState<Appointment[]>([]);
  const [myClosedAppointments, setMyClosedAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");
  const [productName, setProductName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [setterCommissionPct, setSetterCommissionPct] = useState(5);
  const [closerCommissionPct, setCloserCommissionPct] = useState(10);

  useEffect(() => {
    loadUserProfile();
    loadTeamSettings();
    loadAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('closer-view-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error: any) {
      // Error loading profile - no action needed as it's not critical
    }
  };

  const loadTeamSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('setter_commission_percentage, closer_commission_percentage')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      if (data) {
        setSetterCommissionPct(Number(data.setter_commission_percentage) || 5);
        setCloserCommissionPct(Number(data.closer_commission_percentage) || 10);
      }
    } catch (error: any) {
      console.error('Error loading commission settings:', error);
    }
  };

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      // Load ALL new appointments (not closed) for the team - newest first
      const { data: allNewData, error: allNewError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .neq('status', 'CLOSED')
        .order('start_at_utc', { ascending: false });

      if (allNewError) throw allNewError;
      setAllNewAppointments(allNewData || []);

      // Load MY new appointments (assigned to this closer, not closed)
      const { data: myNewData, error: myNewError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('closer_id', user.id)
        .neq('status', 'CLOSED')
        .order('start_at_utc', { ascending: true });

      if (myNewError) throw myNewError;
      setMyNewAppointments(myNewData || []);

      // Load ALL closed appointments for the team
      const { data: allClosedData, error: allClosedError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'CLOSED')
        .gt('revenue', 0)
        .order('start_at_utc', { ascending: false });

      if (allClosedError) throw allClosedError;
      setAllClosedAppointments(allClosedData || []);

      // Load MY closed appointments (assigned to this closer)
      const { data: myClosedData, error: myClosedError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('closer_id', user.id)
        .eq('status', 'CLOSED')
        .gt('revenue', 0)
        .order('start_at_utc', { ascending: false });

      if (myClosedError) throw myClosedError;
      setMyClosedAppointments(myClosedData || []);
    } catch (error: any) {
      toast({
        title: 'Error loading appointments',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCloseDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCcCollected("");
    setMrrAmount("");
    setMrrMonths("");
    setCloseDialogOpen(true);
  };

  const handleClose = async () => {
    if (!user || !userProfile || !selectedAppointment) return;

    const cc = parseFloat(ccCollected);
    const mrr = parseFloat(mrrAmount);
    const months = parseInt(mrrMonths);

    if (isNaN(cc) || cc <= 0) {
      toast({
        title: 'CC amount required',
        description: 'Please enter a valid cash collected amount greater than $0',
        variant: 'destructive',
      });
      return;
    }

    if (mrr > 0 && (isNaN(months) || months <= 0)) {
      toast({
        title: 'Invalid MRR months',
        description: 'Please enter a valid number of months for MRR',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Closing deal - CC:', cc, 'MRR:', mrr, 'Months:', months);
      
      // Check if closer is offer owner
      const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .single();
      
      const isOfferOwner = teamMemberData?.role === 'offer_owner';
      
      // Check if setter is offer owner
      let isSetterOfferOwner = false;
      if (selectedAppointment.setter_id) {
        const { data: setterData } = await supabase
          .from('team_members')
          .select('role')
          .eq('user_id', selectedAppointment.setter_id)
          .eq('team_id', teamId)
          .single();
        isSetterOfferOwner = setterData?.role === 'offer_owner';
      }
      
      // Calculate commissions on CC using configured percentages
      // Offer owners don't get commissions on their own deals
      const closerCommission = isOfferOwner ? 0 : cc * (closerCommissionPct / 100);
      const setterCommission = (selectedAppointment.setter_id && !isSetterOfferOwner) ? cc * (setterCommissionPct / 100) : 0;
      
      console.log('Calculated commissions - Closer:', closerCommission, 'Setter:', setterCommission, 'Is offer owner:', isOfferOwner);

      // Update appointment to closed - revenue is just CC, MRR tracked separately
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'CLOSED', // Set status to CLOSED
          closer_id: user.id,
          closer_name: userProfile.full_name,
          revenue: cc, // Revenue is just CC
          cc_collected: cc,
          mrr_amount: mrr || 0,
          mrr_months: months || 0,
          product_name: productName || null,
        })
        .eq('id', selectedAppointment.id);

      if (updateError) throw updateError;

      // Create a sale record with CC commissions
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          customer_name: selectedAppointment.lead_name,
          offer_owner: isOfferOwner ? userProfile.full_name : null,
          product_name: productName || null,
          setter: selectedAppointment.setter_name || 'No Setter',
          sales_rep: userProfile.full_name,
          date: new Date().toISOString().split('T')[0],
          revenue: cc, // Revenue is just CC
          commission: closerCommission,
          setter_commission: setterCommission,
          status: 'closed',
        })
        .select()
        .single();

      if (saleError) throw saleError;

      console.log('Deal closed successfully - Appointment updated, Sale created');

      // Create MRR commission records if MRR exists
      if (mrr > 0 && months > 0 && saleData) {
        const mrrCommissions = [];
        
        for (let i = 1; i <= months; i++) {
          const monthDate = startOfMonth(addMonths(new Date(), i));
          
          // Closer MRR commission - only if closer is not offer owner
          if (!isOfferOwner) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id,
              appointment_id: selectedAppointment.id,
              team_member_id: user.id,
              team_member_name: userProfile.full_name,
              role: 'closer',
              prospect_name: selectedAppointment.lead_name,
              prospect_email: selectedAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * (closerCommissionPct / 100),
              commission_percentage: closerCommissionPct,
            });
          }

          // Setter MRR commission if there's a setter (track MRR even for offer owners)
          if (selectedAppointment.setter_id && selectedAppointment.setter_name) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id,
              appointment_id: selectedAppointment.id,
              team_member_id: selectedAppointment.setter_id,
              team_member_name: selectedAppointment.setter_name,
              role: 'setter',
              prospect_name: selectedAppointment.lead_name,
              prospect_email: selectedAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * (setterCommissionPct / 100),
              commission_percentage: setterCommissionPct,
            });
          }
        }

        if (mrrCommissions.length > 0) {
          const { error: mrrError } = await supabase
            .from('mrr_commissions')
            .insert(mrrCommissions);

          if (mrrError) throw mrrError;
        }
      }

      toast({
        title: 'Deal closed',
        description: `Successfully closed deal - CC: $${cc.toLocaleString()}${mrr > 0 ? `, MRR: $${mrr.toLocaleString()}/mo for ${months} months` : ''}`,
      });

      setCloseDialogOpen(false);
      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error closing deal',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const apt = appointment as any;
    setCcCollected(String(apt.cc_collected || 0));
    setMrrAmount(String(apt.mrr_amount || 0));
    setMrrMonths(String(apt.mrr_months || 0));
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!user || !userProfile || !editingAppointment) return;

    const cc = parseFloat(ccCollected);
    const mrr = parseFloat(mrrAmount);
    const months = parseInt(mrrMonths);

    if (isNaN(cc) || cc <= 0) {
      toast({
        title: 'CC amount required',
        description: 'Please enter a valid cash collected amount greater than $0',
        variant: 'destructive',
      });
      return;
    }

    if (mrr > 0 && (isNaN(months) || months <= 0)) {
      toast({
        title: 'Invalid MRR months',
        description: 'Please enter valid months for MRR',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check if closer is offer owner
      const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .single();
      
      const isOfferOwner = teamMemberData?.role === 'offer_owner';
      
      const closerCommission = isOfferOwner ? 0 : cc * (closerCommissionPct / 100);
      const setterCommission = editingAppointment.setter_id ? cc * (setterCommissionPct / 100) : 0;

      // Update appointment - revenue is just CC
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          revenue: cc, // Revenue is just CC
          cc_collected: cc,
          mrr_amount: mrr || 0,
          mrr_months: months || 0,
        })
        .eq('id', editingAppointment.id);

      if (updateError) throw updateError;

      // Update sale record and get the sale_id
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .update({
          revenue: cc, // Revenue is just CC
          commission: closerCommission,
          setter_commission: setterCommission,
        })
        .eq('customer_name', editingAppointment.lead_name)
        .eq('team_id', teamId)
        .select()
        .single();

      if (saleError) throw saleError;

      // Delete old MRR commissions
      await supabase
        .from('mrr_commissions')
        .delete()
        .eq('appointment_id', editingAppointment.id);

      // Create new MRR commission records if MRR exists
      if (mrr > 0 && months > 0 && saleData) {
        const mrrCommissions = [];
        
        for (let i = 1; i <= months; i++) {
          const monthDate = startOfMonth(addMonths(new Date(), i));
          
          // Closer MRR commission - only if closer is not offer owner
          if (!isOfferOwner) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id, // Link to the sale
              appointment_id: editingAppointment.id,
              team_member_id: user.id,
              team_member_name: userProfile.full_name,
              role: 'closer',
              prospect_name: editingAppointment.lead_name,
              prospect_email: editingAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * (closerCommissionPct / 100),
              commission_percentage: closerCommissionPct,
            });
          }

          if (editingAppointment.setter_id && editingAppointment.setter_name) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id, // Link to the sale
              appointment_id: editingAppointment.id,
              team_member_id: editingAppointment.setter_id,
              team_member_name: editingAppointment.setter_name,
              role: 'setter',
              prospect_name: editingAppointment.lead_name,
              prospect_email: editingAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * (setterCommissionPct / 100),
              commission_percentage: setterCommissionPct,
            });
          }
        }

        if (mrrCommissions.length > 0) {
          await supabase.from('mrr_commissions').insert(mrrCommissions);
        }
      }

      toast({
        title: 'Deal updated',
        description: `Successfully updated - CC: $${cc.toLocaleString()}${mrr > 0 ? `, MRR: $${mrr.toLocaleString()}/mo for ${months} months` : ''}`,
      });

      setEditDialogOpen(false);
      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error updating deal',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: 'NEW' | 'CONFIRMED' | 'SHOWED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Appointment status changed to ${newStatus}`,
      });

      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error updating status',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const formatLocalTime = (utcTime: string) => {
    return format(new Date(utcTime), 'MMM d, yyyy h:mm a');
  };

  const getFilteredByDate = (appointments: Appointment[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case "last7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= sevenDaysAgo && aptDate <= now;
        });
      case "last30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= thirtyDaysAgo && aptDate <= now;
        });
      case "next7days":
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= now && aptDate <= sevenDaysFromNow;
        });
      case "next30days":
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= now && aptDate <= thirtyDaysFromNow;
        });
      default:
        return appointments;
    }
  };

  const getFilteredByStatus = (appointments: Appointment[]) => {
    if (statusFilter === "all") return appointments;
    return appointments.filter(apt => apt.status === statusFilter);
  };

  const filteredAllNewAppointments = getFilteredByStatus(getFilteredByDate(allNewAppointments));

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <>
      <Tabs defaultValue="all-new" className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
            <TabsTrigger value="all-new" className="text-xs md:text-sm flex-1 md:flex-none whitespace-nowrap">All Appointments ({allNewAppointments.length})</TabsTrigger>
            <TabsTrigger value="my-new" className="text-xs md:text-sm flex-1 md:flex-none whitespace-nowrap">My Meetings ({myNewAppointments.length})</TabsTrigger>
            <TabsTrigger value="all-closed" className="text-xs md:text-sm flex-1 md:flex-none whitespace-nowrap">All Closed ({allClosedAppointments.length})</TabsTrigger>
            <TabsTrigger value="my-closed" className="text-xs md:text-sm flex-1 md:flex-none whitespace-nowrap">My Closed ({myClosedAppointments.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all-new" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="next7days">Next 7 Days</SelectItem>
                <SelectItem value="next30days">Next 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="SHOWED">Showed</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredAllNewAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No appointments match your filters
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {filteredAllNewAppointments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{apt.lead_name}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{apt.lead_email}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium flex-shrink-0 ${
                        apt.status === 'SHOWED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{formatLocalTime(apt.start_at_utc)}</span>
                    </div>
                    
                    {apt.closer_name && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="text-primary font-medium">Closer: {apt.closer_name}</span>
                      </div>
                    )}
                    
                    {apt.setter_name && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="text-primary font-medium">Setter: {apt.setter_name}</span>
                      </div>
                    )}
                    
                    {apt.setter_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{apt.setter_notes}</p>
                    )}
                  </CardContent>
                  
                  <CardFooter className="p-3 pt-0">
                    <Button
                      size="sm"
                      onClick={() => openCloseDialog(apt)}
                      className="w-full h-10 text-sm"
                    >
                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                      Close Deal
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Setter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Setter Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
              {filteredAllNewAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                      <TableCell className="font-medium">{apt.lead_name}</TableCell>
                      <TableCell>{apt.lead_email}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{apt.closer_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{apt.setter_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          apt.status === 'SHOWED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {apt.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {apt.setter_notes ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="max-w-xs truncate justify-start">
                                <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                                <span className="truncate">{apt.setter_notes}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-96">
                              <div className="space-y-2">
                                <h4 className="font-medium">Setter Notes</h4>
                                <Textarea
                                  value={apt.setter_notes}
                                  readOnly
                                  className="min-h-[120px]"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => openCloseDialog(apt)}
                          className="flex items-center gap-1"
                        >
                          <DollarSign className="h-3 w-3" />
                          Close Deal
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-new" className="mt-6">
          {myNewAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No meetings assigned to you
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {myNewAppointments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{apt.lead_name}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{apt.lead_email}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{formatLocalTime(apt.start_at_utc)}</span>
                    </div>
                    
                    {apt.setter_name && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="text-primary font-medium">Setter: {apt.setter_name}</span>
                      </div>
                    )}
                    
                    {apt.setter_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{apt.setter_notes}</p>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select
                        value={apt.status}
                        onValueChange={(value: 'NEW' | 'CONFIRMED' | 'SHOWED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => handleStatusChange(apt.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">NEW</SelectItem>
                          <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                          <SelectItem value="SHOWED">SHOWED</SelectItem>
                          <SelectItem value="NO_SHOW">NO SHOW</SelectItem>
                          <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                          <SelectItem value="RESCHEDULED">RESCHEDULED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-3 pt-0">
                    <Button
                      size="sm"
                      onClick={() => openCloseDialog(apt)}
                      className="w-full h-10 text-sm"
                    >
                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                      Close Deal
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Email</TableHead>
                      <TableHead>Setter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Setter Notes</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {myNewAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                      <TableCell className="font-medium">{apt.lead_name}</TableCell>
                      <TableCell>{apt.lead_email}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{apt.setter_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={apt.status}
                          onValueChange={(value: 'NEW' | 'CONFIRMED' | 'SHOWED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => handleStatusChange(apt.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEW">NEW</SelectItem>
                            <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                            <SelectItem value="SHOWED">SHOWED</SelectItem>
                            <SelectItem value="NO_SHOW">NO SHOW</SelectItem>
                            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                            <SelectItem value="RESCHEDULED">RESCHEDULED</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {apt.setter_notes ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="max-w-xs truncate justify-start">
                                <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                                <span className="truncate">{apt.setter_notes}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-96">
                              <div className="space-y-2">
                                <h4 className="font-medium">Setter Notes</h4>
                                <Textarea
                                  value={apt.setter_notes}
                                  readOnly
                                  className="min-h-[120px]"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => openCloseDialog(apt)}
                          className="flex items-center gap-1"
                        >
                          <DollarSign className="h-3 w-3" />
                          Close Deal
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all-closed" className="mt-6">
          {allClosedAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No closed deals yet
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {allClosedAppointments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{apt.lead_name}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{apt.lead_email}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{formatLocalTime(apt.start_at_utc)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Setter</p>
                        <p className="text-sm font-medium text-primary">{apt.setter_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Closer</p>
                        <p className="text-sm font-medium">{apt.closer_name || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">CC Revenue</p>
                        <p className="text-sm font-semibold text-green-600">${apt.revenue?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">MRR</p>
                        <p className="text-sm font-medium text-blue-600">
                          {apt.mrr_amount && apt.mrr_amount > 0 
                            ? `$${apt.mrr_amount.toLocaleString()}/mo × ${apt.mrr_months}` 
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Setter</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>CC Revenue</TableHead>
                    <TableHead>MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allClosedAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                      <TableCell className="font-medium">{apt.lead_name}</TableCell>
                      <TableCell>{apt.lead_email}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{apt.setter_name || '-'}</span>
                      </TableCell>
                      <TableCell>{apt.closer_name || '-'}</TableCell>
                      <TableCell className="font-semibold text-green-600">${apt.revenue?.toLocaleString() || '0'}</TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {apt.mrr_amount && apt.mrr_amount > 0 
                          ? `$${apt.mrr_amount.toLocaleString()}/mo × ${apt.mrr_months}` 
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-closed" className="mt-6">
          {myClosedAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No closed deals yet
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {myClosedAppointments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{apt.lead_name}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{apt.lead_email}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{formatLocalTime(apt.start_at_utc)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Setter</p>
                        <p className="text-sm font-medium text-primary">{apt.setter_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Closer</p>
                        <p className="text-sm font-medium">{apt.closer_name || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">CC Revenue</p>
                        <p className="text-sm font-semibold text-green-600">${apt.revenue?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">MRR</p>
                        {apt.mrr_amount && apt.mrr_amount > 0 ? (
                          <div className="text-sm">
                            <div className="font-medium text-blue-600">${apt.mrr_amount.toLocaleString()}/mo</div>
                            <div className="text-[10px] text-muted-foreground">{apt.mrr_months} months</div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-3 pt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(apt)}
                      className="w-full h-10 text-sm"
                    >
                      Edit
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Setter</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>CC Revenue</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myClosedAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                      <TableCell className="font-medium">{apt.lead_name}</TableCell>
                      <TableCell>{apt.lead_email}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{apt.setter_name || '-'}</span>
                      </TableCell>
                      <TableCell>{apt.closer_name || '-'}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ${apt.revenue?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        {apt.mrr_amount && apt.mrr_amount > 0 ? (
                          <div className="text-sm">
                            <div className="font-medium">${apt.mrr_amount.toLocaleString()}/mo</div>
                            <div className="text-muted-foreground">{apt.mrr_months} months</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(apt)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lead Name</Label>
              <p className="text-sm font-medium">{selectedAppointment?.lead_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Setter</Label>
              <p className="text-sm font-medium text-primary">{selectedAppointment?.setter_name || 'No Setter'}</p>
              {selectedAppointment?.setter_name && (
                <p className="text-xs text-muted-foreground">Setter will receive 5% commission on CC and MRR</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Premium Coaching Program"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc">Cash Collected (CC) ($) *</Label>
              <Input
                id="cc"
                type="number"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
                placeholder="2000.00"
                min="0.01"
                step="0.01"
                required
              />
              <p className="text-xs text-muted-foreground">
                Commissions: Closer {closerCommissionPct}%, Setter {setterCommissionPct}% on CC
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mrr">Monthly Recurring Revenue (MRR) ($)</Label>
              <Input
                id="mrr"
                type="number"
                value={mrrAmount}
                onChange={(e) => setMrrAmount(e.target.value)}
                placeholder="200.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="months">Number of MRR Months</Label>
              <Input
                id="months"
                type="number"
                value={mrrMonths}
                onChange={(e) => setMrrMonths(e.target.value)}
                placeholder="5"
                min="0"
                step="1"
              />
              {parseFloat(mrrAmount) > 0 && parseInt(mrrMonths) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total MRR: ${(parseFloat(mrrAmount) * parseInt(mrrMonths)).toFixed(2)} over {mrrMonths} months
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClose}>
              Close Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lead Name</Label>
              <p className="text-sm font-medium">{editingAppointment?.lead_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Setter</Label>
              <p className="text-sm font-medium text-primary">{editingAppointment?.setter_name || 'No Setter'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cc">Cash Collected (CC) ($) *</Label>
              <Input
                id="edit-cc"
                type="number"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
                placeholder="2000.00"
                min="0.01"
                step="0.01"
                required
              />
              <p className="text-xs text-muted-foreground">
                Commissions: Closer {closerCommissionPct}%, Setter {setterCommissionPct}% on CC
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mrr">Monthly Recurring Revenue (MRR) ($)</Label>
              <Input
                id="edit-mrr"
                type="number"
                value={mrrAmount}
                onChange={(e) => setMrrAmount(e.target.value)}
                placeholder="200.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-months">Number of MRR Months</Label>
              <Input
                id="edit-months"
                type="number"
                value={mrrMonths}
                onChange={(e) => setMrrMonths(e.target.value)}
                placeholder="5"
                min="0"
                step="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Update Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
