import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import { format, addMonths, startOfMonth } from "date-fns";
import { DollarSign, MessageSquare } from "lucide-react";

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
}

interface CloserViewProps {
  teamId: string;
}

export function CloserView({ teamId }: CloserViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadUserProfile();
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
      console.error('Error loading profile:', error);
    }
  };

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      // Load ALL new appointments (not closed) for the team
      const { data: allNewData, error: allNewError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .neq('status', 'CLOSED')
        .order('start_at_utc', { ascending: true });

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
        description: error.message,
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

    if (isNaN(cc) || cc < 0) {
      toast({
        title: 'Invalid CC amount',
        description: 'Please enter a valid cash collected amount (cannot be negative)',
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
      // Calculate commissions on CC
      const closerCommission = cc * 0.10; // 10% for closer
      const setterCommission = selectedAppointment.setter_id ? cc * 0.05 : 0; // 5% for setter if assigned

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
        })
        .eq('id', selectedAppointment.id);

      if (updateError) throw updateError;

      // Create a sale record with CC commissions
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          customer_name: selectedAppointment.lead_name,
          setter: selectedAppointment.setter_name || 'No Setter',
          sales_rep: userProfile.full_name,
          date: new Date().toISOString().split('T')[0],
          revenue: cc, // Revenue is just CC
          commission: closerCommission,
          setter_commission: setterCommission,
          status: 'closed',
        });

      if (saleError) throw saleError;

      // Create MRR commission records if MRR exists
      if (mrr > 0 && months > 0) {
        const mrrCommissions = [];
        
        for (let i = 1; i <= months; i++) {
          const monthDate = startOfMonth(addMonths(new Date(), i));
          
          // Closer MRR commission (10%)
          mrrCommissions.push({
            team_id: teamId,
            appointment_id: selectedAppointment.id,
            team_member_id: user.id,
            team_member_name: userProfile.full_name,
            role: 'closer',
            prospect_name: selectedAppointment.lead_name,
            prospect_email: selectedAppointment.lead_email,
            month_date: format(monthDate, 'yyyy-MM-dd'),
            mrr_amount: mrr,
            commission_amount: mrr * 0.10,
            commission_percentage: 10,
          });

          // Setter MRR commission (5%) if there's a setter
          if (selectedAppointment.setter_id && selectedAppointment.setter_name) {
            mrrCommissions.push({
              team_id: teamId,
              appointment_id: selectedAppointment.id,
              team_member_id: selectedAppointment.setter_id,
              team_member_name: selectedAppointment.setter_name,
              role: 'setter',
              prospect_name: selectedAppointment.lead_name,
              prospect_email: selectedAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * 0.05,
              commission_percentage: 5,
            });
          }
        }

        const { error: mrrError } = await supabase
          .from('mrr_commissions')
          .insert(mrrCommissions);

        if (mrrError) throw mrrError;
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
        description: error.message,
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

    if (isNaN(cc) || cc < 0) {
      toast({
        title: 'Invalid CC amount',
        description: 'Please enter a valid cash collected amount',
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
      const closerCommission = cc * 0.10;
      const setterCommission = editingAppointment.setter_id ? cc * 0.05 : 0;

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

      // Update sale record
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          revenue: cc, // Revenue is just CC
          commission: closerCommission,
          setter_commission: setterCommission,
        })
        .eq('customer_name', editingAppointment.lead_name)
        .eq('team_id', teamId);

      if (saleError) throw saleError;

      // Delete old MRR commissions
      await supabase
        .from('mrr_commissions')
        .delete()
        .eq('appointment_id', editingAppointment.id);

      // Create new MRR commission records if MRR exists
      if (mrr > 0 && months > 0) {
        const mrrCommissions = [];
        
        for (let i = 1; i <= months; i++) {
          const monthDate = startOfMonth(addMonths(new Date(), i));
          
          mrrCommissions.push({
            team_id: teamId,
            appointment_id: editingAppointment.id,
            team_member_id: user.id,
            team_member_name: userProfile.full_name,
            role: 'closer',
            prospect_name: editingAppointment.lead_name,
            prospect_email: editingAppointment.lead_email,
            month_date: format(monthDate, 'yyyy-MM-dd'),
            mrr_amount: mrr,
            commission_amount: mrr * 0.10,
            commission_percentage: 10,
          });

          if (editingAppointment.setter_id && editingAppointment.setter_name) {
            mrrCommissions.push({
              team_id: teamId,
              appointment_id: editingAppointment.id,
              team_member_id: editingAppointment.setter_id,
              team_member_name: editingAppointment.setter_name,
              role: 'setter',
              prospect_name: editingAppointment.lead_name,
              prospect_email: editingAppointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * 0.05,
              commission_percentage: 5,
            });
          }
        }

        await supabase.from('mrr_commissions').insert(mrrCommissions);
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
        description: error.message,
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
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatLocalTime = (utcTime: string) => {
    return format(new Date(utcTime), 'MMM d, yyyy h:mm a');
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <>
      <Tabs defaultValue="all-new" className="w-full">
        <TabsList>
          <TabsTrigger value="all-new">All Appointments ({allNewAppointments.length})</TabsTrigger>
          <TabsTrigger value="my-new">My Meetings ({myNewAppointments.length})</TabsTrigger>
          <TabsTrigger value="all-closed">All Closed ({allClosedAppointments.length})</TabsTrigger>
          <TabsTrigger value="my-closed">My Closed ({myClosedAppointments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all-new" className="mt-6">
          {allNewAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No new appointments
            </div>
          ) : (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allNewAppointments.map((apt) => (
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
          ) : (
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
          ) : (
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
          ) : (
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
              <Label htmlFor="cc">Cash Collected (CC) ($) *</Label>
              <Input
                id="cc"
                type="number"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
                placeholder="2000.00"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Commissions: Closer 10%, Setter 5% on CC
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
              <Label htmlFor="edit-cc">Cash Collected (CC) ($)</Label>
              <Input
                id="edit-cc"
                type="number"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
                placeholder="2000.00"
                min="0"
                step="0.01"
              />
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
