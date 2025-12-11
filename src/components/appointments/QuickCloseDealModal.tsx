import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface QuickCloseDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    lead_name: string;
    lead_email: string;
    closer_id: string | null;
    closer_name: string | null;
    setter_id: string | null;
    setter_name: string | null;
    team_id: string;
  };
  closerCommissionPct: number;
  setterCommissionPct: number;
  onSuccess: () => void;
}

export function QuickCloseDealModal({
  open,
  onOpenChange,
  appointment,
  closerCommissionPct,
  setterCommissionPct,
  onSuccess,
}: QuickCloseDealModalProps) {
  const { user } = useAuth();
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");
  const [productName, setProductName] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    if (!user) return;

    const cc = parseFloat(ccCollected) || 0;
    const mrr = parseFloat(mrrAmount) || 0;
    const months = parseInt(mrrMonths) || 0;

    if (cc === 0 && mrr === 0) {
      toast.error("Please enter either CC collected or MRR amount");
      return;
    }

    if (cc < 0 || cc > 1000000) {
      toast.error("CC amount must be between $0 and $1,000,000");
      return;
    }

    if (mrr < 0 || mrr > 100000) {
      toast.error("MRR amount cannot be negative or exceed $100,000");
      return;
    }

    if (mrr > 0 && (months <= 0 || months > 120)) {
      toast.error("MRR months must be between 1 and 120");
      return;
    }

    setClosing(true);

    try {
      // Use transaction function for guaranteed atomicity
      const { data, error } = await supabase.rpc('close_deal_transaction', {
        p_appointment_id: appointment.id,
        p_closer_id: user.id,
        p_cc_amount: cc,
        p_mrr_amount: mrr,
        p_mrr_months: months,
        p_product_name: productName || null,
        p_notes: notes || null,
        p_closer_name: appointment.closer_name || null,
        p_closer_commission_pct: closerCommissionPct,
        p_setter_commission_pct: setterCommissionPct,
      });

      if (error) {
        if (error.message?.includes('already closed')) {
          toast.error("This deal has already been closed");
        } else {
          throw error;
        }
        return;
      }

      // Record payment (additive logging - failure doesn't break main flow)
      const { recordPayment } = await import('@/lib/payments');
      await recordPayment({
        teamId: appointment.team_id,
        appointmentId: appointment.id,
        amount: cc,
        paymentMethod: 'credit_card',
        type: 'initial',
        metadata: { 
          mrr_amount: mrr, 
          mrr_months: months, 
          product_name: productName,
          notes,
          closer_name: appointment.closer_name 
        }
      });

      toast.success("Deal closed successfully!", {
        description: `Transaction completed successfully`,
      });

      onOpenChange(false);
      onSuccess();

      // Reset form
      setCcCollected("");
      setMrrAmount("");
      setMrrMonths("");
      setProductName("");
      setNotes("");
    } catch (error: any) {
      console.error("Error closing deal:", error);
      toast.error("Failed to close deal", {
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Deal</DialogTitle>
          <DialogDescription>
            Close deal for {appointment.lead_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cc">Cash Collected ($)</Label>
              <Input
                id="cc"
                type="number"
                placeholder="0"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mrr">MRR Amount ($)</Label>
              <Input
                id="mrr"
                type="number"
                placeholder="0"
                value={mrrAmount}
                onChange={(e) => setMrrAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="months">Number of Months</Label>
            <Input
              id="months"
              type="number"
              placeholder="0"
              value={mrrMonths}
              onChange={(e) => setMrrMonths(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product">Product Name (Optional)</Label>
            <Input
              id="product"
              placeholder="Enter product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this deal..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleClose} disabled={closing}>
              {closing ? "Closing..." : "Close Deal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
