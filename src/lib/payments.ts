import { supabase } from "@/integrations/supabase/client";

export interface RecordPaymentParams {
  teamId: string;
  leadId?: string | null;
  appointmentId?: string | null;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  type: "deposit" | "initial" | "recurring" | "upsell" | "refund";
  processedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Records a payment to the payments table.
 * This is additive logging only - failures are silent and do not break main flows.
 */
export async function recordPayment(
  params: RecordPaymentParams,
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        team_id: params.teamId,
        lead_id: params.leadId || null,
        appointment_id: params.appointmentId || null,
        amount: params.amount,
        currency: params.currency || "USD",
        payment_method: params.paymentMethod || "credit_card",
        type: params.type,
        processed_at: params.processedAt?.toISOString() || new Date().toISOString(),
        metadata: params.metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[payments] Failed to record payment:", error);
      return { success: false, error: error.message };
    }

    return { success: true, paymentId: data?.id };
  } catch (err: any) {
    // Silent failure - payment logging should never break main flows
    console.error("[payments] Exception recording payment:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Safely converts unknown metadata into a JSONB-storable object.
 */
function normalizeMetadata(meta: any): Record<string, any> {
  if (!meta || typeof meta !== "object") return {};
  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return {};
  }
}

/**
 * Fetches payments for an appointment in camelCase format.
 * Read-only. Errors return [] and never break flows.
 */
export async function getPaymentsForAppointment(teamId: string, appointmentId: string) {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(`id, amount, currency, payment_method, type, processed_at, metadata`)
      .eq("team_id", teamId)
      .eq("appointment_id", appointmentId)
      .order("processed_at", { ascending: false });

    if (error) {
      console.warn("[payments] Failed to fetch appointment payments:", error);
      return [];
    }

    return (
      data?.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.payment_method,
        type: p.type,
        processedAt: p.processed_at,
        metadata: p.metadata || {},
      })) || []
    );
  } catch (err) {
    console.warn("[payments] Exception fetching appointment payments:", err);
    return [];
  }
}

/**
 * Fetches payments for a lead in camelCase format.
 * Read-only. Errors return [] and never break flows.
 */
export async function getPaymentsForLead(teamId: string, leadId: string) {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(`id, appointment_id, amount, currency, payment_method, type, processed_at, metadata`)
      .eq("team_id", teamId)
      .eq("lead_id", leadId)
      .order("processed_at", { ascending: false });

    if (error) {
      console.warn("[payments] Failed to fetch lead payments:", error);
      return [];
    }

    return (
      data?.map((p) => ({
        id: p.id,
        appointmentId: p.appointment_id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.payment_method,
        type: p.type,
        processedAt: p.processed_at,
        metadata: p.metadata || {},
      })) || []
    );
  } catch (err) {
    console.warn("[payments] Exception fetching lead payments:", err);
    return [];
  }
}

/**
 * Utility to sum payment amounts safely.
 */
export function sumPayments(payments: { amount: number }[] | null | undefined): number {
  if (!Array.isArray(payments)) return 0;
  return payments.reduce((acc, p) => acc + (p.amount || 0), 0);
}

/**
 * Fetches all payments for a team within a date range (by processed_at).
 * Used for dashboard "Today / This Week / This Month" revenue.
 * Read-only. Errors return [] and never break flows.
 */
export async function getTeamPaymentsInRange(teamId: string, fromIso: string, toIso: string) {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(`id, amount, currency, payment_method, type, processed_at, metadata`)
      .eq("team_id", teamId)
      .gte("processed_at", fromIso)
      .lte("processed_at", toIso)
      .order("processed_at", { ascending: false });

    if (error) {
      console.warn("[payments] Failed to fetch team payments in range:", error);
      return [];
    }

    return (
      data?.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.payment_method,
        type: p.type,
        processedAt: p.processed_at,
        metadata: p.metadata || {},
      })) || []
    );
  } catch (err) {
    console.warn("[payments] Exception fetching team payments in range:", err);
    return [];
  }
}
