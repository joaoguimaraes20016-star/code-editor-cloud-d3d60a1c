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
  | "custom_webhook"
  | "assign_owner"
  | "update_stage";

type CrmEntity = "lead" | "deal";

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
  entity?: CrmEntity;
  ownerId?: string;
  stageId?: string;
  error?: string;
  to?: string;
  messageId?: string;
  renderedBody?: string;
}

interface TriggerResponse {
  status: "ok" | "error";
  triggerType: TriggerType;
  automationsRun: string[];
  stepsExecuted: StepExecutionLog[];
  error?: string;
}

// --- Supabase Client ---
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// --- Context Builder ---
function buildAutomationContext(triggerType: TriggerType, payload: Record<string, any>): AutomationContext {
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

function evaluateCondition(condition: AutomationCondition, context: Record<string, any>): boolean {
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
  logic: "AND" | "OR" = "AND",
): boolean {
  if (!conditions || conditions.length === 0) return true;
  if (logic === "AND") {
    return conditions.every((c) => evaluateCondition(c, context));
  }
  return conditions.some((c) => evaluateCondition(c, context));
}

// --- Get Automations from DB ONLY (no templates to prevent duplicates) ---
async function getAutomationsForTrigger(
  supabase: any,
  teamId: string,
  triggerType: TriggerType,
): Promise<AutomationDefinition[]> {
  try {
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("team_id", teamId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (error) {
      console.error("[Automation Trigger] Error fetching automations:", error);
      return [];
    }

    if (data && data.length > 0) {
      console.log(`[Automation Trigger] Found ${data.length} DB automations for ${triggerType}`);
      return data.map((row: any) => {
        const definition = row.definition || {};
        return {
          id: row.id,
          teamId: row.team_id,
          name: row.name,
          description: row.description || "",
          isActive: row.is_active,
          trigger: definition.trigger || { type: row.trigger_type, config: {} },
          triggerType: row.trigger_type as TriggerType,
          steps: definition.steps || [],
        } as AutomationDefinition;
      });
    }

    console.log(`[Automation Trigger] No DB automations found for ${triggerType}`);
    return [];
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error fetching automations:", err);
    return [];
  }
}

/**
 * Per-automation idempotency check.
 * Composite key: teamId + triggerType + automationKey + eventId
 * This ensures each automation runs EXACTLY ONCE per event, even if trigger is called multiple times.
 */
async function hasAutomationAlreadyRunForEvent(
  supabase: any,
  teamId: string,
  triggerType: TriggerType,
  automationKey: string,
  eventId: string,
): Promise<{ alreadyRan: boolean; existingRunId?: string }> {
  try {
    // Query for existing run with matching automationKey AND eventId in context_snapshot
    const { data, error } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("team_id", teamId)
      .eq("trigger_type", triggerType)
      .filter("context_snapshot->>eventId", "eq", eventId)
      .filter("context_snapshot->>automationKey", "eq", automationKey)
      .limit(1);

    if (error) {
      console.error("[Automation Trigger] Idempotency check failed:", error);
      return { alreadyRan: false }; // On error, allow run (fail open)
    }

    if (data && data.length > 0) {
      return { alreadyRan: true, existingRunId: data[0].id };
    }

    return { alreadyRan: false };
  } catch (err) {
    console.error("[Automation Trigger] Idempotency check exception:", err);
    return { alreadyRan: false };
  }
}

// --- Create Automation Run (returns run_id) ---
async function createAutomationRun(
  supabase: any,
  params: {
    automationId?: string | null;
    teamId: string;
    triggerType: TriggerType;
    context?: AutomationContext;
    eventId: string;
    automationKey: string;
  },
): Promise<string | null> {
  try {
    // Build context_snapshot with eventId and automationKey for idempotency
    const contextSnapshot = {
      ...(params.context ? JSON.parse(JSON.stringify(params.context)) : {}),
      eventId: params.eventId,
      automationKey: params.automationKey,
    };

    const { data, error } = await supabase
      .from("automation_runs")
      .insert([
        {
          automation_id: params.automationId ?? null,
          team_id: params.teamId,
          trigger_type: params.triggerType,
          status: "running",
          steps_executed: [],
          context_snapshot: contextSnapshot,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[Automation Trigger] Error creating run:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error creating run:", err);
    return null;
  }
}

// --- Update Automation Run ---
async function updateAutomationRun(
  supabase: any,
  runId: string,
  params: {
    status: "success" | "error";
    errorMessage?: string;
    stepsExecuted: StepExecutionLog[];
  },
): Promise<void> {
  try {
    const { error } = await supabase
      .from("automation_runs")
      .update({
        status: params.status,
        error_message: params.errorMessage || null,
        steps_executed: JSON.parse(JSON.stringify(params.stepsExecuted)),
      })
      .eq("id", runId);

    if (error) {
      console.error("[Automation Trigger] Error updating run:", error);
    }
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error updating run:", err);
  }
}

// --- Log Message to message_logs ---
async function logMessage(
  supabase: any,
  params: {
    teamId: string;
    automationId: string;
    runId: string | null;
    channel: string;
    provider: string;
    toAddress: string;
    fromAddress?: string;
    template?: string;
    payload: Record<string, any>;
    status: "queued" | "sent" | "failed";
    errorMessage?: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("message_logs").insert([
      {
        team_id: params.teamId,
        automation_id: params.automationId,
        run_id: params.runId,
        channel: params.channel,
        provider: params.provider,
        to_address: params.toAddress,
        from_address: params.fromAddress || null,
        template: params.template || null,
        payload: params.payload,
        status: params.status,
        error_message: params.errorMessage || null,
      },
    ]);

    if (error) {
      console.error("[Automation Trigger] Error logging message:", error);
    }
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error logging message:", err);
  }
}

// --- Template Variable Extraction (for logging) ---
function extractTemplateVariables(template: string, context: AutomationContext): Record<string, any> {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
  const variables: Record<string, any> = {};
  for (const match of matches) {
    const path = match.replace(/\{\{|\}\}/g, "").trim();
    variables[path] = getFieldValue(context, path);
  }
  return variables;
}

// --- Render Template ---
function renderTemplate(template: string, context: AutomationContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getFieldValue(context, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

// --- Run Automation ---
async function runAutomation(
  automation: AutomationDefinition,
  context: AutomationContext,
  supabase: any,
  runId: string | null,
): Promise<StepExecutionLog[]> {
  const logs: StepExecutionLog[] = [];

  console.log(`[Automation] Running "${automation.name}" (${automation.id})`);

  for (const step of automation.steps.sort((a, b) => a.order - b.order)) {
    const conditionsMet = evaluateConditions(step.conditions, context);

    if (!conditionsMet) {
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
        const template = step.config.template || step.config.body || "";
        const provider = "stub";
        const toPhone = context.lead?.phone || context.appointment?.lead_phone || step.config.to || "";
        const renderedBody = renderTemplate(template, context);
        const messageId = `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        log.channel = channel;
        log.provider = provider;
        log.to = toPhone;
        log.messageId = messageId;
        log.renderedBody = renderedBody;
        log.templateVariables = extractTemplateVariables(template, context);

        if (channel === "sms" && toPhone) {
          try {
            await logMessage(supabase, {
              teamId: context.teamId,
              automationId: automation.id,
              runId,
              channel: "sms",
              provider,
              toAddress: toPhone,
              template,
              payload: {
                to: toPhone,
                body: renderedBody,
                templateVariables: log.templateVariables,
                leadId: context.lead?.id,
                appointmentId: context.appointment?.id,
              },
              status: "sent",
            });
          } catch (msgErr) {
            console.error("[Automation] Error logging SMS to message_logs:", msgErr);
          }
        }
        break;
      }

      case "time_delay": {
        const delayHours = step.config.delayHours || 0;
        log.templateVariables = { delayHours };
        break;
      }

      case "notify_team": {
        const message = step.config.message || "";
        log.channel = "in_app";
        log.templateVariables = extractTemplateVariables(message, context);
        break;
      }

      case "add_task": {
        log.templateVariables = step.config;
        break;
      }

      case "add_tag": {
        log.templateVariables = step.config;
        break;
      }

      case "enqueue_dialer": {
        log.channel = "voice";
        log.provider = "power_dialer";
        log.templateVariables = step.config;
        break;
      }

      case "custom_webhook": {
        log.templateVariables = step.config;
        break;
      }

      case "assign_owner": {
        const entity = step.config.entity as CrmEntity;
        const ownerId = step.config.ownerId as string;
        log.entity = entity;
        log.ownerId = ownerId;

        if (entity === "lead") {
          const leadId = context.lead?.id;
          if (!leadId) {
            log.skipped = true;
            log.skipReason = "no_lead_id_in_context";
          } else {
            try {
              const { error } = await supabase.from("contacts").update({ owner_id: ownerId }).eq("id", leadId);
              if (error) {
                log.error = error.message;
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
            }
          }
        } else if (entity === "deal") {
          const dealId = context.deal?.id || context.appointment?.id;
          if (!dealId) {
            log.skipped = true;
            log.skipReason = "no_deal_id_in_context";
          } else {
            try {
              const { error } = await supabase.from("appointments").update({ closer_id: ownerId }).eq("id", dealId);
              if (error) {
                log.error = error.message;
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
            }
          }
        }
        break;
      }

      case "update_stage": {
        const entity = step.config.entity as CrmEntity;
        const stageId = step.config.stageId as string;
        log.entity = entity;
        log.stageId = stageId;

        if (entity === "lead") {
          const leadId = context.lead?.id;
          if (!leadId) {
            log.skipped = true;
            log.skipReason = "no_lead_id_in_context";
          } else {
            try {
              const { error } = await supabase.from("contacts").update({ stage_id: stageId }).eq("id", leadId);
              if (error) {
                log.error = error.message;
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
            }
          }
        } else if (entity === "deal") {
          const dealId = context.deal?.id || context.appointment?.id;
          if (!dealId) {
            log.skipped = true;
            log.skipReason = "no_deal_id_in_context";
          } else {
            try {
              const { error } = await supabase.from("appointments").update({ pipeline_stage: stageId }).eq("id", dealId);
              if (error) {
                log.error = error.message;
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
            }
          }
        }
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

  const supabase = getSupabaseClient();

  try {
    const body: TriggerRequest = await req.json();

    const { triggerType, teamId, eventPayload, eventId } = body as any;
    console.log("[automation-trigger] incoming", {
      triggerType,
      teamId,
      eventId,
      leadId: (eventPayload as any)?.lead?.id,
    });

    if (!triggerType || !teamId) {
      return new Response(
        JSON.stringify({ status: "error", error: "Missing triggerType or teamId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Compute stable eventId from request or derive from lead/appointment
    // This is the canonical event identifier for idempotency
    const stableEventId: string =
      eventId ??
      (eventPayload as any)?.eventId ??
      (triggerType === "lead_created" && (eventPayload as any)?.lead?.id
        ? `lead_created:${(eventPayload as any).lead.id}`
        : `${triggerType}:${Date.now()}`);

    console.log(`[Automation Trigger] stableEventId=${stableEventId}`);

    // Build context
    const context = buildAutomationContext(triggerType, {
      teamId,
      ...eventPayload,
    });

    // Get matching automations from DB ONLY (no templates - prevents duplicates)
    const automations = await getAutomationsForTrigger(supabase, teamId, triggerType);

    if (automations.length === 0) {
      console.log(`[Automation Trigger] No matching automations, exiting`);
      return new Response(
        JSON.stringify({ status: "ok", automationsRun: [], stepsExecuted: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[Automation Trigger] Found ${automations.length} matching automations`);

    const automationsRun: string[] = [];
    const automationsSkipped: string[] = [];
    const allStepsExecuted: StepExecutionLog[] = [];

    // Run each automation with PER-AUTOMATION idempotency check
    for (const automation of automations) {
      // Generate automationKey: unique identifier for this automation
      // For DB automations, use the database ID
      const automationKey = `db:${automation.id}`;

      // PER-AUTOMATION IDEMPOTENCY CHECK
      // Prevents duplicate runs when trigger is called multiple times for same event
      // Composite key: teamId + triggerType + automationKey + eventId
      const { alreadyRan, existingRunId } = await hasAutomationAlreadyRunForEvent(
        supabase,
        teamId,
        triggerType,
        automationKey,
        stableEventId,
      );

      if (alreadyRan) {
        console.log(
          `[Automation Trigger] SKIPPED automation ${automation.id} - already ran for event ${stableEventId} (run ${existingRunId})`,
        );
        automationsSkipped.push(automation.id);
        continue;
      }

      // Create automation run with eventId and automationKey stored in context_snapshot
      const runId = await createAutomationRun(supabase, {
        automationId: automation.id,
        teamId,
        triggerType,
        context,
        eventId: stableEventId,
        automationKey,
      });

      if (!runId) {
        console.error(`[Automation Trigger] Failed to create run for automation ${automation.id}`);
        continue;
      }

      automationsRun.push(automation.id);

      let status: "success" | "error" = "success";
      let errorMessage: string | undefined;
      let stepLogs: StepExecutionLog[] = [];

      try {
        stepLogs = await runAutomation(automation, context, supabase, runId);
        allStepsExecuted.push(...stepLogs);
      } catch (err) {
        status = "error";
        errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Automation Trigger] Error running automation ${automation.id}:`, err);
      }

      // Update the automation run with final status and steps
      await updateAutomationRun(supabase, runId, {
        status,
        errorMessage,
        stepsExecuted: stepLogs,
      });
    }

    const response: TriggerResponse = {
      status: "ok",
      triggerType,
      automationsRun,
      stepsExecuted: allStepsExecuted,
    };

    console.log(`[Automation Trigger] Complete: ran=${automationsRun.length}, skipped=${automationsSkipped.length}`);

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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
