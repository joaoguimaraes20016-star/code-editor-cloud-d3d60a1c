// src/lib/automations/triggerHelper.ts
import { supabase } from "@/integrations/supabase/client";
import type { TriggerType } from "./types";

export interface AutomationTriggerPayload {
  triggerType: TriggerType;
  teamId: string;
  eventPayload: {
    lead?: Record<string, any>;
    appointment?: Record<string, any>;
    payment?: Record<string, any>;
    deal?: Record<string, any>;
    meta?: Record<string, any>;
  };
}

export interface StepExecutionLog {
  stepId: string;
  actionType: string;
  channel?: string;
  provider?: string;
  templateVariables?: Record<string, any>;
  skipped: boolean;
  skipReason?: string;
}

export interface AutomationTriggerResponse {
  status: "ok" | "error";
  triggerType: TriggerType;
  automationsRun: string[];
  stepsExecuted: StepExecutionLog[];
  error?: string;
}

/**
 * Triggers automations for a specific event.
 * Call this from anywhere in the app when events occur.
 *
 * @example
 * // When a new lead is created
 * await runAutomationsForEvent({
 *   triggerType: 'lead_created',
 *   teamId: 'uuid-here',
 *   eventPayload: {
 *     lead: { id: '...', first_name: 'John', email: 'john@example.com' }
 *   }
 * });
 *
 * @example
 * // When an appointment is booked
 * await runAutomationsForEvent({
 *   triggerType: 'appointment_booked',
 *   teamId: 'uuid-here',
 *   eventPayload: {
 *     lead: { name: 'John Doe', email: 'john@example.com' },
 *     appointment: { id: '...', start_at_utc: '2025-01-15T10:00:00Z' }
 *   }
 * });
 */
export async function runAutomationsForEvent(
  payload: AutomationTriggerPayload
): Promise<AutomationTriggerResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("automation-trigger", {
      body: payload,
    });

    if (error) {
      console.error("[runAutomationsForEvent] Edge function error:", error);
      return {
        status: "error",
        triggerType: payload.triggerType,
        automationsRun: [],
        stepsExecuted: [],
        error: error.message,
      };
    }

    return data as AutomationTriggerResponse;
  } catch (err) {
    console.error("[runAutomationsForEvent] Unexpected error:", err);
    return {
      status: "error",
      triggerType: payload.triggerType,
      automationsRun: [],
      stepsExecuted: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Convenience helpers for common trigger types
 */
export const AutomationTriggers = {
  /**
   * Trigger automations when a new lead is created
   */
  onLeadCreated: (teamId: string, lead: Record<string, any>) =>
    runAutomationsForEvent({
      triggerType: "lead_created",
      teamId,
      eventPayload: { lead },
    }),

  /**
   * Trigger automations when a tag is added to a lead
   */
  onLeadTagAdded: (teamId: string, lead: Record<string, any>, tag: string) =>
    runAutomationsForEvent({
      triggerType: "lead_tag_added",
      teamId,
      eventPayload: { lead, meta: { tag } },
    }),

  /**
   * Trigger automations when an appointment is booked
   */
  onAppointmentBooked: (
    teamId: string,
    appointment: Record<string, any>,
    lead?: Record<string, any>
  ) =>
    runAutomationsForEvent({
      triggerType: "appointment_booked",
      teamId,
      eventPayload: { appointment, lead },
    }),

  /**
   * Trigger automations when an appointment is rescheduled
   */
  onAppointmentRescheduled: (
    teamId: string,
    appointment: Record<string, any>,
    lead?: Record<string, any>
  ) =>
    runAutomationsForEvent({
      triggerType: "appointment_rescheduled",
      teamId,
      eventPayload: { appointment, lead },
    }),

  /**
   * Trigger automations when a no-show occurs
   */
  onAppointmentNoShow: (
    teamId: string,
    appointment: Record<string, any>,
    lead?: Record<string, any>
  ) =>
    runAutomationsForEvent({
      triggerType: "appointment_no_show",
      teamId,
      eventPayload: { appointment, lead },
    }),

  /**
   * Trigger automations when an appointment is completed
   */
  onAppointmentCompleted: (
    teamId: string,
    appointment: Record<string, any>,
    lead?: Record<string, any>
  ) =>
    runAutomationsForEvent({
      triggerType: "appointment_completed",
      teamId,
      eventPayload: { appointment, lead },
    }),

  /**
   * Trigger automations when a payment is received
   */
  onPaymentReceived: (
    teamId: string,
    payment: Record<string, any>,
    deal?: Record<string, any>
  ) =>
    runAutomationsForEvent({
      triggerType: "payment_received",
      teamId,
      eventPayload: { payment, deal },
    }),
};
