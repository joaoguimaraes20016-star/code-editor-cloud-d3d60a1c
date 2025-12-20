import { supabase } from "@/integrations/supabase/client";
import type { FunnelEvent, RecordEventResult } from "./types";

type RecordFunnelEventResponse = {
  inserted?: boolean;
  event?: FunnelEvent;
};

/**
 * recordEvent - attempts to persist a funnel event to the backend.
 * Strategy:
 * 1) Try calling a dedicated Edge Function `record-funnel-event` (source of truth for writes).
 * 2) In DEV only, and when VITE_ALLOW_EVENT_FALLBACK === "true", optionally fallback to a direct `events` insert.
 * The function returns an object with success/error; failures are surfaced instead of silently falling back.
 */
export async function recordEvent(event: FunnelEvent): Promise<RecordEventResult> {
  try {
    // Prefer serverless function if available (allows DB migrations and unique upserts server-side)
    try {
      const { data, error } = await supabase.functions.invoke("record-funnel-event", {
        body: event,
      });

      if (error) {
        // Edge Function returned an error; log and delegate to fallback policy below.
        console.error("record-funnel-event function returned error", error);
        throw error;
      }

      // Function returned successfully. Expect shape { inserted: boolean, event?: object }
      const response = (data ?? null) as RecordFunnelEventResponse | null;
      const inserted = response?.inserted;
      const returnedEvent = response?.event;

      if (inserted === false) {
        // Idempotent duplicate — treat as success
        if (import.meta.env.DEV) {
          console.debug("recordEvent: dedupe hit (inserted=false)", event.dedupe_key);
        }
        return { success: true, event: returnedEvent as FunnelEvent | undefined };
      }

      return { success: true, event: returnedEvent as FunnelEvent | undefined };
    } catch (fnErr) {
      // Function might not exist or be restricted; in PROD we do NOT fall back to direct table writes.
      console.error("record-funnel-event function failed", fnErr);

      if (import.meta.env.DEV && import.meta.env.VITE_ALLOW_EVENT_FALLBACK === "true") {
        // Dev-only fallback: allow direct table writes while keeping the Edge Function as the
        // source of truth for dedupe + RLS behavior in production.
        const { data, error } = await supabase.from("events").insert(event).select().limit(1).single();
        if (error) {
          return { success: false, error };
        }

        return { success: true, event: data as FunnelEvent };
      }

      console.error("record-funnel-event failed and direct fallback is disabled");
      throw fnErr;
    }
  } catch (err) {
    return { success: false, error: err };
  }
}

export default recordEvent;
