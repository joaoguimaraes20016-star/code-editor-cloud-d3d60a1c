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

    setClosing(true);

    try {
      // Update appointment status and pipeline stage
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "CLOSED",
          cc_collected: cc,
          mrr_amount: mrr,
          mrr_months: months,
          product_name: productName || null,
          pipeline_stage: "won",
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      // Upsert sale record (revenue is only CC, MRR tracked separately)
      const closerCommission = cc * (closerCommissionPct / 100);
      const setterCommission = cc * (setterCommissionPct / 100);
      const revenue = cc;
      const todayDate = new Date().toISOString().split("T")[0];

      // Check if sale already exists for this appointment
      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("customer_name", appointment.lead_name)
        .eq("team_id", appointment.team_id)
        .eq("date", todayDate)
        .single();

      if (existingSale) {
        // Update existing sale
        const { error: saleError } = await supabase
          .from("sales")
          .update({
            revenue,
            commission: closerCommission,
            setter_commission: setterCommission,
            sales_rep: appointment.closer_name || "Unknown",
            setter: appointment.setter_name || "Unknown",
            product_name: productName || null,
            status: "Closed",
          })
          .eq("id", existingSale.id);

        if (saleError) throw saleError;
      } else {
        // Create new sale
        const { error: saleError } = await supabase.from("sales").insert({
          customer_name: appointment.lead_name,
          date: todayDate,
          revenue,
          commission: closerCommission,
          setter_commission: setterCommission,
          sales_rep: appointment.closer_name || "Unknown",
          setter: appointment.setter_name || "Unknown",
          product_name: productName || null,
          status: "Closed",
          team_id: appointment.team_id,
        });

        if (saleError) throw saleError;
      }

      // Create MRR commissions if applicable
      if (mrr > 0 && months > 0) {
        const mrrRecords = [];
        const startDate = new Date();

        for (let i = 0; i < months; i++) {
          const monthDate = new Date(startDate);
          monthDate.setMonth(monthDate.getMonth() + i);

          if (appointment.closer_id) {
            mrrRecords.push({
              team_id: appointment.team_id,
              team_member_id: appointment.closer_id,
              team_member_name: appointment.closer_name || "Unknown",
              role: "closer",
              prospect_name: appointment.lead_name,
              prospect_email: appointment.lead_email,
              mrr_amount: mrr,
              commission_percentage: closerCommissionPct,
              commission_amount: mrr * (closerCommissionPct / 100),
              month_date: monthDate.toISOString().split("T")[0],
            });
          }

          if (appointment.setter_id) {
            mrrRecords.push({
              team_id: appointment.team_id,
              team_member_id: appointment.setter_id,
              team_member_name: appointment.setter_name || "Unknown",
              role: "setter",
              prospect_name: appointment.lead_name,
              prospect_email: appointment.lead_email,
              mrr_amount: mrr,
              commission_percentage: setterCommissionPct,
              commission_amount: mrr * (setterCommissionPct / 100),
              month_date: monthDate.toISOString().split("T")[0],
            });
          }
        }

        if (mrrRecords.length > 0) {
          const { error: mrrError } = await supabase
            .from("mrr_commissions")
            .insert(mrrRecords);

          if (mrrError) throw mrrError;
        }
      }

      toast.success("Deal closed successfully!", {
        description: `Commission: $${closerCommission.toFixed(2)} + $${setterCommission.toFixed(2)} setter`,
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
        description: error.message,
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
