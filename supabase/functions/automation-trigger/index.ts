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
  // CRM action fields
  entity?: CrmEntity;
  ownerId?: string;
  stageId?: string;
  error?: string;
  // SMS fields
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

// --- Default Template Automations (fallback) ---
function getDefaultTemplateAutomations(teamId: string): AutomationDefinition[] {
  return [
    {
      id: "template-lead-nurture",
      teamId,
      name: "New Lead – 2-Day Nurture",
      description: "Sends a welcome SMS and a follow-up reminder for new leads.",
      isActive: true,
      trigger: { type: "lead_created", config: {} },
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
          config: { delayHours: 24 },
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
      id: "template-appointment-confirmation",
      teamId,
      name: "Appointment Booked – Confirmation",
      description: "Sends confirmation when appointment is booked.",
      isActive: true,
      trigger: { type: "appointment_booked", config: {} },
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
      id: "template-no-show-follow-up",
      teamId,
      name: "No-Show Follow-Up",
      description: "Follows up with leads who missed their appointment.",
      isActive: true,
      trigger: { type: "appointment_no_show", config: {} },
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

// --- Get Automations from DB ---
async function getAutomationsForTrigger(
  supabase: any,
  teamId: string,
  triggerType: TriggerType
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
      return getDefaultTemplateAutomations(teamId).filter(
        (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
      );
    }

    if (data && data.length > 0) {
      console.log(`[Automation Trigger] Found ${data.length} automations in DB`);
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

    console.log("[Automation Trigger] No DB automations found, using templates");
    return getDefaultTemplateAutomations(teamId).filter(
      (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
    );
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error fetching automations:", err);
    return getDefaultTemplateAutomations(teamId).filter(
      (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
    );
  }
}

// --- Create Automation Run (returns run_id) ---
async function createAutomationRun(
  supabase: any,
  params: {
    automationId: string;
    teamId: string;
    triggerType: TriggerType;
    context?: AutomationContext;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("automation_runs").insert([{
      automation_id: params.automationId,
      team_id: params.teamId,
      trigger_type: params.triggerType,
      status: "running",
      steps_executed: [],
      context_snapshot: params.context ? JSON.parse(JSON.stringify(params.context)) : null,
    }]).select('id').single();

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
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from("automation_runs")
      .update({
        status: params.status,
        error_message: params.errorMessage || null,
        steps_executed: JSON.parse(JSON.stringify(params.stepsExecuted)),
      })
      .eq('id', runId);

    if (error) {
      console.error("[Automation Trigger] Error updating run:", error);
    } else {
      console.log(`[Automation Trigger] Updated run ${runId}`);
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
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("message_logs").insert([{
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
    }]);

    if (error) {
      console.error("[Automation Trigger] Error logging message:", error);
    } else {
      console.log(`[Automation Trigger] Logged ${params.channel} message to ${params.toAddress}`);
    }
  } catch (err) {
    console.error("[Automation Trigger] Unexpected error logging message:", err);
  }
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
  runId: string | null
): Promise<StepExecutionLog[]> {
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
        const template = step.config.template || step.config.body || "";
        
        // Use stub provider for now (no external API calls)
        const provider = "stub";
        
        // Get recipient phone from context
        const toPhone = context.lead?.phone || context.appointment?.lead_phone || step.config.to || "";
        
        // Render the template with context variables
        const renderedBody = renderTemplate(template, context);
        
        // Generate fake message ID for stub mode
        const messageId = `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        log.channel = channel;
        log.provider = provider;
        log.to = toPhone;
        log.messageId = messageId;
        log.renderedBody = renderedBody;
        log.templateVariables = extractTemplateVariables(template, context);

        console.log(`[Automation] Sending ${channel} via ${provider}:`, {
          to: toPhone,
          template,
          renderedBody,
          messageId,
        });

        // Log to message_logs table (non-blocking)
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
            // Non-blocking: don't fail the step
          }
        }
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

      case "assign_owner": {
        const entity = step.config.entity as CrmEntity;
        const ownerId = step.config.ownerId as string;
        log.entity = entity;
        log.ownerId = ownerId;

        if (entity === "lead") {
          const leadId = context.lead?.id;
          if (!leadId) {
            console.warn(`[Automation] assign_owner: No lead.id in context, skipping`);
            log.skipped = true;
            log.skipReason = "no_lead_id_in_context";
          } else {
            try {
              const { error } = await supabase
                .from("contacts")
                .update({ owner_id: ownerId })
                .eq("id", leadId);

              if (error) {
                console.error(`[Automation] assign_owner lead update error:`, error);
                log.error = error.message;
              } else {
                console.log(`[Automation] assign_owner: Set lead ${leadId} owner to ${ownerId}`);
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
              console.error(`[Automation] assign_owner exception:`, err);
            }
          }
        } else if (entity === "deal") {
          const dealId = context.deal?.id || context.appointment?.id;
          if (!dealId) {
            console.warn(`[Automation] assign_owner: No deal/appointment id in context, skipping`);
            log.skipped = true;
            log.skipReason = "no_deal_id_in_context";
          } else {
            try {
              const { error } = await supabase
                .from("appointments")
                .update({ closer_id: ownerId })
                .eq("id", dealId);

              if (error) {
                console.error(`[Automation] assign_owner deal update error:`, error);
                log.error = error.message;
              } else {
                console.log(`[Automation] assign_owner: Set deal ${dealId} owner to ${ownerId}`);
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
              console.error(`[Automation] assign_owner exception:`, err);
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
            console.warn(`[Automation] update_stage: No lead.id in context, skipping`);
            log.skipped = true;
            log.skipReason = "no_lead_id_in_context";
          } else {
            try {
              const { error } = await supabase
                .from("contacts")
                .update({ stage_id: stageId })
                .eq("id", leadId);

              if (error) {
                console.error(`[Automation] update_stage lead update error:`, error);
                log.error = error.message;
              } else {
                console.log(`[Automation] update_stage: Set lead ${leadId} stage to ${stageId}`);
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
              console.error(`[Automation] update_stage exception:`, err);
            }
          }
        } else if (entity === "deal") {
          const dealId = context.deal?.id || context.appointment?.id;
          if (!dealId) {
            console.warn(`[Automation] update_stage: No deal/appointment id in context, skipping`);
            log.skipped = true;
            log.skipReason = "no_deal_id_in_context";
          } else {
            try {
              const { error } = await supabase
                .from("appointments")
                .update({ pipeline_stage: stageId })
                .eq("id", dealId);

              if (error) {
                console.error(`[Automation] update_stage deal update error:`, error);
                log.error = error.message;
              } else {
                console.log(`[Automation] update_stage: Set deal ${dealId} stage to ${stageId}`);
              }
            } catch (err) {
              log.error = err instanceof Error ? err.message : "Unknown error";
              console.error(`[Automation] update_stage exception:`, err);
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

    // Get matching automations from DB (with template fallback)
    const automations = await getAutomationsForTrigger(supabase, teamId, triggerType);

    console.log(`[Automation Trigger] Found ${automations.length} matching automations`);

    const automationsRun: string[] = [];
    const allStepsExecuted: StepExecutionLog[] = [];

    // Run each automation and log the run
    for (const automation of automations) {
      automationsRun.push(automation.id);
      
      let status: "success" | "error" = "success";
      let errorMessage: string | undefined;
      let stepLogs: StepExecutionLog[] = [];

      // Create run first to get run_id
      const runId = await createAutomationRun(supabase, {
        automationId: automation.id,
        teamId,
        triggerType,
        context,
      });

      try {
        stepLogs = await runAutomation(automation, context, supabase, runId);
        allStepsExecuted.push(...stepLogs);
      } catch (err) {
        status = "error";
        errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Automation Trigger] Error running automation ${automation.id}:`, err);
      }

      // Update the automation run with final status and steps
      if (runId) {
        await updateAutomationRun(supabase, runId, {
          status,
          errorMessage,
          stepsExecuted: stepLogs,
        });
      }
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
