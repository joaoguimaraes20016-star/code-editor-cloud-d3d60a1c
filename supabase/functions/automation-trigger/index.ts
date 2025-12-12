// supabase/functions/automation-trigger/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types mirrored from src/lib/automations/types.ts
type TriggerType =
  | "lead_created"
  | "lead_tag_added"
  | "appointment_booked"
  | "appointment_rescheduled"
  | "appointment_no_show"
  | "appointment_completed"
  | "payment_received"
  | "time_delay";

type ActionType =
  | "send_message"
  | "add_task"
  | "add_tag"
  | "notify_team"
  | "enqueue_dialer"
  | "time_delay"
  | "custom_webhook";

interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "in";
  value: string | number | string[];
}

interface AutomationStep {
  id: string;
  order: number;
  type: ActionType;
  config: Record<string, any>;
  conditions?: AutomationCondition[];
}

interface AutomationDefinition {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: TriggerType;
    config: Record<string, any>;
  };
  steps: AutomationStep[];
  triggerType?: TriggerType;
}

interface AutomationContext {
  teamId: string;
  triggerType: TriggerType;
  now: string;
  lead?: Record<string, any> | null;
  appointment?: Record<string, any> | null;
  payment?: Record<string, any> | null;
  deal?: Record<string, any> | null;
  meta?: Record<string, any> | null;
}

interface TriggerRequest {
  triggerType: TriggerType;
  teamId: string;
  eventPayload: Record<string, any>;
}

interface StepExecutionLog {
  stepId: string;
  actionType: ActionType;
  channel?: string;
  provider?: string;
  templateVariables?: Record<string, any>;
  skipped: boolean;
  skipReason?: string;
}

interface TriggerResponse {
  status: "ok" | "error";
  triggerType: TriggerType;
  automationsRun: string[];
  stepsExecuted: StepExecutionLog[];
  error?: string;
}

// --- Context Builder ---
function buildAutomationContext(
  triggerType: TriggerType,
  payload: Record<string, any>
): AutomationContext {
  const { teamId } = payload;
  return {
    teamId,
    triggerType,
    now: new Date().toISOString(),
    lead: payload.lead ?? null,
    appointment: payload.appointment ?? null,
    payment: payload.payment ?? null,
    deal: payload.deal ?? null,
    meta: payload.meta ?? null,
  };
}

// --- Condition Evaluator ---
function getFieldValue(context: Record<string, any>, path: string): any {
  const keys = path.split(".");
  let value: any = context;
  for (const key of keys) {
    if (value == null) return undefined;
    value = value[key];
  }
  return value;
}

function evaluateCondition(
  condition: AutomationCondition,
  context: Record<string, any>
): boolean {
  const actual = getFieldValue(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return typeof actual === "string" && actual.includes(String(expected));
    case "gt":
      return typeof actual === "number" && actual > Number(expected);
    case "lt":
      return typeof actual === "number" && actual < Number(expected);
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    default:
      return false;
  }
}

function evaluateConditions(
  conditions: AutomationCondition[] | undefined,
  context: Record<string, any>,
  logic: "AND" | "OR" = "AND"
): boolean {
  if (!conditions || conditions.length === 0) return true;
  if (logic === "AND") {
    return conditions.every((c) => evaluateCondition(c, context));
  }
  return conditions.some((c) => evaluateCondition(c, context));
}

// --- Sample Automations (hardcoded for now, swap to DB later) ---
function getSampleAutomations(teamId: string): AutomationDefinition[] {
  return [
    {
      id: "lead-nurture-new-lead",
      teamId,
      name: "New Lead – 2-Day Nurture",
      description: "Sends a welcome SMS and a follow-up reminder for new leads.",
      isActive: true,
      trigger: {
        type: "lead_created",
        config: {},
      },
      triggerType: "lead_created",
      steps: [
        {
          id: "step_0",
          order: 0,
          type: "send_message",
          config: {
            channel: "sms",
            template: "Hey {{lead.first_name}}, it's {{team.name}}. Got your info – reply YES to confirm.",
          },
        },
        {
          id: "step_1",
          order: 1,
          type: "time_delay",
          config: {
            delayHours: 24,
          },
        },
        {
          id: "step_2",
          order: 2,
          type: "send_message",
          config: {
            channel: "sms",
            template: "Still interested in working with us, {{lead.first_name}}?",
          },
        },
      ],
    },
    {
      id: "appointment-booked-confirmation",
      teamId,
      name: "Appointment Booked – Confirmation",
      description: "Sends confirmation when appointment is booked.",
      isActive: true,
      trigger: {
        type: "appointment_booked",
        config: {},
      },
      triggerType: "appointment_booked",
      steps: [
        {
          id: "step_0",
          order: 0,
          type: "send_message",
          config: {
            channel: "sms",
            template: "Your appointment is confirmed for {{appointment.start_at_utc}}. See you then!",
          },
        },
        {
          id: "step_1",
          order: 1,
          type: "notify_team",
          config: {
            message: "New appointment booked: {{lead.name}} at {{appointment.start_at_utc}}",
          },
        },
      ],
    },
    {
      id: "no-show-follow-up",
      teamId,
      name: "No-Show Follow-Up",
      description: "Follows up with leads who missed their appointment.",
      isActive: true,
      trigger: {
        type: "appointment_no_show",
        config: {},
      },
      triggerType: "appointment_no_show",
      steps: [
        {
          id: "step_0",
          order: 0,
          type: "send_message",
          config: {
            channel: "sms",
            template: "Hey {{lead.first_name}}, we missed you! Want to reschedule?",
          },
        },
      ],
    },
  ];
}

// --- Get Automations for Trigger ---
function getAutomationsForTrigger(
  teamId: string,
  triggerType: TriggerType
): AutomationDefinition[] {
  const automations = getSampleAutomations(teamId);
  return automations.filter(
    (a) =>
      a.isActive &&
      (a.triggerType === triggerType || a.trigger?.type === triggerType)
  );
}

// --- Template Variable Extraction (for logging) ---
function extractTemplateVariables(
  template: string,
  context: AutomationContext
): Record<string, any> {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
  const variables: Record<string, any> = {};
  for (const match of matches) {
    const path = match.replace(/\{\{|\}\}/g, "").trim();
    variables[path] = getFieldValue(context, path);
  }
  return variables;
}

// --- Run Automation ---
function runAutomation(
  automation: AutomationDefinition,
  context: AutomationContext
): StepExecutionLog[] {
  const logs: StepExecutionLog[] = [];

  console.log(`[Automation] Running "${automation.name}" (${automation.id})`);

  for (const step of automation.steps.sort((a, b) => a.order - b.order)) {
    const conditionsMet = evaluateConditions(step.conditions, context);

    if (!conditionsMet) {
      console.log(`[Automation] Skipping step ${step.id} – conditions not met`);
      logs.push({
        stepId: step.id,
        actionType: step.type,
        skipped: true,
        skipReason: "conditions_not_met",
      });
      continue;
    }

    const log: StepExecutionLog = {
      stepId: step.id,
      actionType: step.type,
      skipped: false,
    };

    switch (step.type) {
      case "send_message": {
        const channel = step.config.channel || "sms";
        const template = step.config.template || "";
        const provider = channel === "sms" ? "twilio" : channel === "email" ? "resend" : "noop";

        log.channel = channel;
        log.provider = provider;
        log.templateVariables = extractTemplateVariables(template, context);

        console.log(`[Automation] WOULD send ${channel} via ${provider}:`, {
          template,
          variables: log.templateVariables,
        });
        break;
      }

      case "time_delay": {
        const delayHours = step.config.delayHours || 0;
        console.log(`[Automation] WOULD wait ${delayHours} hours before next step`);
        log.templateVariables = { delayHours };
        break;
      }

      case "notify_team": {
        const message = step.config.message || "";
        log.channel = "in_app";
        log.templateVariables = extractTemplateVariables(message, context);
        console.log(`[Automation] WOULD notify team:`, {
          message,
          variables: log.templateVariables,
        });
        break;
      }

      case "add_task": {
        console.log(`[Automation] WOULD add task:`, step.config);
        log.templateVariables = step.config;
        break;
      }

      case "add_tag": {
        console.log(`[Automation] WOULD add tag:`, step.config);
        log.templateVariables = step.config;
        break;
      }

      case "enqueue_dialer": {
        log.channel = "voice";
        log.provider = "power_dialer";
        console.log(`[Automation] WOULD enqueue for dialer:`, step.config);
        log.templateVariables = step.config;
        break;
      }

      case "custom_webhook": {
        console.log(`[Automation] WOULD call webhook:`, step.config);
        log.templateVariables = step.config;
        break;
      }

      default:
        console.log(`[Automation] Unknown action type: ${step.type}`);
    }

    logs.push(log);
  }

  return logs;
}

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TriggerRequest = await req.json();
    const { triggerType, teamId, eventPayload } = body;

    if (!triggerType || !teamId) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Missing triggerType or teamId",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Automation Trigger] Received ${triggerType} for team ${teamId}`);

    // Build context
    const context = buildAutomationContext(triggerType, {
      teamId,
      ...eventPayload,
    });

    // Get matching automations
    const automations = getAutomationsForTrigger(teamId, triggerType);

    console.log(`[Automation Trigger] Found ${automations.length} matching automations`);

    const automationsRun: string[] = [];
    const allStepsExecuted: StepExecutionLog[] = [];

    // Run each automation
    for (const automation of automations) {
      automationsRun.push(automation.id);
      const stepLogs = runAutomation(automation, context);
      allStepsExecuted.push(...stepLogs);
    }

    const response: TriggerResponse = {
      status: "ok",
      triggerType,
      automationsRun,
      stepsExecuted: allStepsExecuted,
    };

    console.log(`[Automation Trigger] Complete:`, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Automation Trigger] Error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
