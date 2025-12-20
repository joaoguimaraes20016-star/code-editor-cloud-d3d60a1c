export type FunnelEventType =
  | "step_viewed"
  | "step_completed"
  | "lead_submitted"
  | "schedule"
  | "pixel_fired"
  | "funnel_step_intent"
  | "lead_captured"
  | "info_collected"
  | "appointment_scheduled"
  | "funnel_completed";

export interface FunnelEvent {
  id?: string;
  team_id: string;
  funnel_id: string;
  event_type: FunnelEventType;
  dedupe_key?: string;
  payload?: Record<string, any>;
  client_request_id?: string | null;
  created_at?: string;
}

export interface RecordEventResult {
  success: boolean;
  event?: FunnelEvent;
  error?: any;
}

export const DEFAULT_EVENTS_TABLE = "events";
