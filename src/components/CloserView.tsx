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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, addMonths, startOfMonth } from "date-fns";
import { DollarSign } from "lucide-react";

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
}

interface CloserViewProps {
  teamId: string;
}

export function CloserView({ teamId }: CloserViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newAppointments, setNewAppointments] = useState<Appointment[]>([]);
  const [closedAppointments, setClosedAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");

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
    try {
      // Load new/showed appointments
      const { data: newData, error: newError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .in('status', ['NEW', 'SHOWED'])
        .not('setter_id', 'is', null)
        .order('start_at_utc', { ascending: true });

      if (newError) throw newError;
      setNewAppointments(newData || []);

      // Load closed appointments (status changed to CLOSED when revenue is added)
      const { data: closedData, error: closedError } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'CANCELLED')
        .gt('revenue', 0)
        .order('start_at_utc', { ascending: false });

      if (closedError) throw closedError;
      setClosedAppointments(closedData || []);
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

    if (isNaN(cc) || cc <= 0) {
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
        description: 'Please enter a valid number of months for MRR',
        variant: 'destructive',
      });
      return;
    }

    try {
      const totalRevenue = cc + (mrr * (months || 0));
      
      // Calculate commissions on CC
      const closerCommission = cc * 0.10; // 10% for closer
      const setterCommission = selectedAppointment.setter_id ? cc * 0.05 : 0; // 5% for setter if assigned

      // Update appointment to closed
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'CANCELLED', // Using CANCELLED to track closed deals
          closer_id: user.id,
          closer_name: userProfile.full_name,
          revenue: totalRevenue,
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
          revenue: totalRevenue,
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
        description: `Successfully closed deal - CC: $${cc.toLocaleString()}, Total: $${totalRevenue.toLocaleString()}`,
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

  const formatLocalTime = (utcTime: string) => {
    return format(new Date(utcTime), 'MMM d, yyyy h:mm a');
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <>
      <Tabs defaultValue="new" className="w-full">
        <TabsList>
          <TabsTrigger value="new">New Appointments ({newAppointments.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedAppointments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6">
          {newAppointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No new appointments to close
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
                  {newAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                      <TableCell className="font-medium">{apt.lead_name}</TableCell>
                      <TableCell>{apt.lead_email}</TableCell>
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
                      <TableCell className="max-w-xs truncate">{apt.setter_notes || '-'}</TableCell>
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

        <TabsContent value="closed" className="mt-6">
          {closedAppointments.length === 0 ? (
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
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedAppointments.map((apt) => (
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
    </>
  );
}
