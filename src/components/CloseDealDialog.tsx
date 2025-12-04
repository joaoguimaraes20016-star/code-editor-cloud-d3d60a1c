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
  closer_id?: string | null;
  closer_name?: string | null;
}

interface CloseDealDialogProps {
  appointment: Appointment | null;
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  closerCommissionPct: number;
  setterCommissionPct: number;
  onTrackUndo?: (action: {
    table: string;
    recordId: string;
    previousData: Record<string, any>;
    description: string;
  }) => void;
  onShowUndoToast?: (description: string) => void;
}

export function CloseDealDialog({
  appointment,
  teamId,
  open,
  onOpenChange,
  onSuccess,
  closerCommissionPct,
  setterCommissionPct,
  onTrackUndo,
  onShowUndoToast,
}: CloseDealDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");
  const [productName, setProductName] = useState("");
  const [firstChargeDate, setFirstChargeDate] = useState(() => {
    // Default to 30 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    return format(defaultDate, 'yyyy-MM-dd');
  });
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    if (!user || !appointment) return;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      toast({
        title: 'Error',
        description: 'Could not load user profile',
        variant: 'destructive',
      });
      return;
    }

    const cc = parseFloat(ccCollected);
    const mrr = parseFloat(mrrAmount) || 0;
    const months = parseInt(mrrMonths) || 0;

    if (isNaN(cc) || cc <= 0) {
      toast({
        title: 'CC amount required',
        description: 'Please enter a valid cash collected amount greater than $0',
        variant: 'destructive',
      });
      return;
    }

    if (cc > 1000000) {
      toast({
        title: 'Amount Too Large',
        description: 'Cash collected cannot exceed $1,000,000',
        variant: 'destructive',
      });
      return;
    }

    if (mrr < 0) {
      toast({
        title: 'Invalid MRR',
        description: 'MRR amount cannot be negative',
        variant: 'destructive',
      });
      return;
    }

    if (mrr > 0 && (isNaN(months) || months <= 0 || months > 120)) {
      toast({
        title: 'Invalid MRR months',
        description: 'MRR months must be between 1 and 120',
        variant: 'destructive',
      });
      return;
    }

    setClosing(true);
    try {
      // Use the appointment's closer name if assigned, otherwise use the admin who's closing
      const effectiveCloserName = appointment.closer_name || userProfile.full_name;
      const effectiveCloserId = appointment.closer_id || user.id;
      
      // Use transaction function for guaranteed atomicity
      const { data, error } = await supabase.rpc('close_deal_transaction', {
        p_appointment_id: appointment.id,
        p_closer_id: effectiveCloserId,
        p_cc_amount: cc,
        p_mrr_amount: mrr,
        p_mrr_months: months,
        p_product_name: productName || null,
        p_notes: null,
        p_closer_name: effectiveCloserName,
        p_closer_commission_pct: closerCommissionPct,
        p_setter_commission_pct: setterCommissionPct,
      });

      if (error) {
        if (error.message?.includes('already closed')) {
          toast({
            title: 'Deal Already Closed',
            description: 'This deal has already been closed.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      const successMessage = `Closed deal - CC: $${cc.toLocaleString()}${mrr > 0 ? `, MRR: $${mrr.toLocaleString()}/mo for ${months} months` : ''}`;
      
      if (onShowUndoToast) {
        onShowUndoToast(successMessage);
      } else {
        toast({
          title: 'Deal closed',
          description: successMessage,
        });
      }

      onOpenChange(false);
      setCcCollected("");
      setMrrAmount("");
      setMrrMonths("");
      setProductName("");
      setFirstChargeDate(() => {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        return format(defaultDate, 'yyyy-MM-dd');
      });
      onSuccess();
    } catch (error: any) {
      console.error('Error closing deal:', error);
      toast({
        title: 'Error closing deal',
        description: error.message || 'An unexpected error occurred',
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
        <>
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

          <div className="space-y-2">
            <Label htmlFor="firstCharge">First Charge Date</Label>
            <Input
              id="firstCharge"
              type="date"
              value={firstChargeDate}
              onChange={(e) => setFirstChargeDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The exact date when the first recurring payment is due
            </p>
          </div>
        </>
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
