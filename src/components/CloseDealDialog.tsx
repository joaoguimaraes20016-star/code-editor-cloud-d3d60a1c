import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startOfMonth, addMonths, format } from "date-fns";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  setter_id: string | null;
  setter_name: string | null;
}

interface CloseDealDialogProps {
  appointment: Appointment | null;
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function CloseDealDialog({
  appointment,
  teamId,
  open,
  onOpenChange,
  onSuccess,
  closerCommissionPct,
  setterCommissionPct,
}: CloseDealDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");
  const [productName, setProductName] = useState("");
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    if (!user || !appointment) return;

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      toast({
        title: 'Error',
        description: 'Could not load user profile',
        variant: 'destructive',
      });
      return;
    }

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

    setClosing(true);
    try {
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
      if (appointment.setter_id) {
        const { data: setterData } = await supabase
          .from('team_members')
          .select('role')
          .eq('user_id', appointment.setter_id)
          .eq('team_id', teamId)
          .single();
        isSetterOfferOwner = setterData?.role === 'offer_owner';
      }
      
      // Calculate commissions on CC using configured percentages
      const closerCommission = isOfferOwner ? 0 : cc * (closerCommissionPct / 100);
      const setterCommission = (appointment.setter_id && !isSetterOfferOwner) ? cc * (setterCommissionPct / 100) : 0;

      // Update appointment to closed
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'CLOSED',
          closer_id: user.id,
          closer_name: userProfile.full_name,
          revenue: cc,
          cc_collected: cc,
          mrr_amount: mrr || 0,
          mrr_months: months || 0,
          product_name: productName || null,
        })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      // Create a sale record with CC commissions
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          team_id: teamId,
          customer_name: appointment.lead_name,
          offer_owner: isOfferOwner ? userProfile.full_name : null,
          product_name: productName || null,
          setter: appointment.setter_name || 'No Setter',
          sales_rep: userProfile.full_name,
          date: new Date().toISOString().split('T')[0],
          revenue: cc,
          commission: closerCommission,
          setter_commission: setterCommission,
          status: 'closed',
        })
        .select()
        .single();

      if (saleError) throw saleError;

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
              appointment_id: appointment.id,
              team_member_id: user.id,
              team_member_name: userProfile.full_name,
              role: 'closer',
              prospect_name: appointment.lead_name,
              prospect_email: appointment.lead_email,
              month_date: format(monthDate, 'yyyy-MM-dd'),
              mrr_amount: mrr,
              commission_amount: mrr * (closerCommissionPct / 100),
              commission_percentage: closerCommissionPct,
            });
          }

          // Setter MRR commission if there's a setter
          if (appointment.setter_id && appointment.setter_name) {
            mrrCommissions.push({
              team_id: teamId,
              sale_id: saleData.id,
              appointment_id: appointment.id,
              team_member_id: appointment.setter_id,
              team_member_name: appointment.setter_name,
              role: 'setter',
              prospect_name: appointment.lead_name,
              prospect_email: appointment.lead_email,
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

      onOpenChange(false);
      setCcCollected("");
      setMrrAmount("");
      setMrrMonths("");
      setProductName("");
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error closing deal',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setClosing(false);
    }
  };

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cc">Cash Collected (CC) *</Label>
        <Input
          id="cc"
          type="number"
          step="0.01"
          placeholder="Enter amount collected"
          value={ccCollected}
          onChange={(e) => setCcCollected(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mrr">Monthly Recurring Revenue (MRR)</Label>
        <Input
          id="mrr"
          type="number"
          step="0.01"
          placeholder="Enter MRR amount (optional)"
          value={mrrAmount}
          onChange={(e) => setMrrAmount(e.target.value)}
        />
      </div>

      {parseFloat(mrrAmount) > 0 && (
        <div className="space-y-2">
          <Label htmlFor="months">Number of Months</Label>
          <Input
            id="months"
            type="number"
            placeholder="Enter number of months"
            value={mrrMonths}
            onChange={(e) => setMrrMonths(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="product">Product Name</Label>
        <Input
          id="product"
          placeholder="Enter product name (optional)"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Close Deal</DrawerTitle>
            <DrawerDescription>
              {appointment && `Closing deal for ${appointment.lead_name}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            {formContent}
          </div>
          <DrawerFooter>
            <Button onClick={handleClose} disabled={closing}>
              {closing ? 'Closing...' : 'Close Deal'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Deal</DialogTitle>
          <DialogDescription>
            {appointment && `Closing deal for ${appointment.lead_name}`}
          </DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={closing}>
            {closing ? 'Closing...' : 'Close Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
