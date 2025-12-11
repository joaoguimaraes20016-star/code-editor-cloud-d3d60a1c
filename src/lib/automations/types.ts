// src/lib/automations/types.ts

export type TriggerType =
  | 'lead_created'
  | 'lead_tag_added'
  | 'appointment_booked'
  | 'appointment_rescheduled'
  | 'appointment_no_show'
  | 'appointment_completed'
  | 'payment_received'
  | 'time_delay';

export type ActionType =
  | 'send_message'        // generic (sms / email / voice / in_app)
  | 'add_task'
  | 'add_tag'
  | 'notify_team'
  | 'enqueue_dialer'      // generic power dialer
  | 'custom_webhook';

export interface AutomationCondition {
  field: string; // e.g. 'lead.status'
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: string | number | string[];
}

export interface AutomationActionConfig {
  type: ActionType;
  params: Record<string, any>;
}

export interface AutomationDefinition {
  id: string;
  teamId: string;
  name: string;
  isActive: boolean;
  triggerType: TriggerType;
  triggerConfig: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationActionConfig[];
}
