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
  | 'time_delay'          // wait before next action
  | 'custom_webhook'
  | 'assign_owner'        // set owner_id on lead or deal
  | 'update_stage';       // set stage_id on lead or deal

export type CrmEntity = 'lead' | 'deal';

export interface AssignOwnerConfig {
  entity: CrmEntity;
  ownerId: string;
}

export interface UpdateStageConfig {
  entity: CrmEntity;
  stageId: string;
}

export interface AutomationCondition {
  field: string; // e.g. 'lead.status'
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: string | number | string[];
}

export interface AutomationActionConfig {
  type: ActionType;
  params: Record<string, any>;
}

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, any>;
}

export interface AutomationStep {
  id: string;
  order: number;
  type: ActionType;
  config: Record<string, any>;
  conditions?: AutomationCondition[];
}

export interface AutomationDefinition {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  // Legacy fields for backwards compatibility
  triggerType?: TriggerType;
  triggerConfig?: Record<string, any>;
  conditions?: AutomationCondition[];
  actions?: AutomationActionConfig[];
}
