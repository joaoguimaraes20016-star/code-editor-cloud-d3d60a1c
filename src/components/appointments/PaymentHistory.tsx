import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, Receipt, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  type: string;
  processed_at: string;
  created_at: string;
}

interface PaymentHistoryProps {
  appointmentId: string;
  teamId: string;
}

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  initial: "Initial Payment",
  recurring: "Recurring",
  upsell: "Upsell",
  refund: "Refund",
};

const typeColors: Record<string, string> = {
  deposit: "bg-primary/10 text-primary border-primary/30",
  initial: "bg-success/10 text-success border-success/30",
  recurring: "bg-info/10 text-info border-info/30",
  upsell: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  refund: "bg-destructive/10 text-destructive border-destructive/30",
};

export function PaymentHistory({ appointmentId, teamId }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, [appointmentId, teamId]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("payments")
        .select("id, amount, currency, payment_method, type, processed_at, created_at")
        .eq("appointment_id", appointmentId)
        .eq("team_id", teamId)
        .order("processed_at", { ascending: false });

      if (fetchError) {
        console.error("[PaymentHistory] Error fetching payments:", fetchError);
        setError("Unable to load payment history");
        return;
      }

      setPayments(data || []);
    } catch (err) {
      console.error("[PaymentHistory] Exception:", err);
      setError("Unable to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const totalLogged = payments.reduce((sum, p) => {
    // Refunds are negative
    return sum + (p.type === "refund" ? -p.amount : p.amount);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading payment history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Payment History
        </div>
        {payments.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 border border-success/30 rounded-md">
            <DollarSign className="h-3.5 w-3.5 text-success" />
            <span className="text-sm font-semibold text-success tabular-nums">
              ${totalLogged.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">total logged</span>
          </div>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
          No payments logged yet
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(parseISO(payment.processed_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${typeColors[payment.type] || ""}`}
                    >
                      {typeLabels[payment.type] || payment.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {payment.payment_method.replace("_", " ")}
                  </TableCell>
                  <TableCell className={`text-xs text-right font-medium tabular-nums ${
                    payment.type === "refund" ? "text-destructive" : "text-foreground"
                  }`}>
                    {payment.type === "refund" ? "-" : ""}${payment.amount.toLocaleString()} {payment.currency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
