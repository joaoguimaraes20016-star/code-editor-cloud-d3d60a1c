import { supabase } from "@/integrations/supabase/client";

export interface RecordPaymentParams {
  teamId: string;
  leadId?: string | null;
  appointmentId?: string | null;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  type: 'deposit' | 'initial' | 'recurring' | 'upsell' | 'refund';
  processedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Records a payment to the payments table.
 * This is additive logging only - failures are silent and do not break main flows.
 */
export async function recordPayment(params: RecordPaymentParams): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        team_id: params.teamId,
        lead_id: params.leadId || null,
        appointment_id: params.appointmentId || null,
        amount: params.amount,
        currency: params.currency || 'USD',
        payment_method: params.paymentMethod || 'credit_card',
        type: params.type,
        processed_at: params.processedAt?.toISOString() || new Date().toISOString(),
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[payments] Failed to record payment:', error);
      return { success: false, error: error.message };
    }

    return { success: true, paymentId: data?.id };
  } catch (err: any) {
    // Silent failure - payment logging should never break main flows
    console.error('[payments] Exception recording payment:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
