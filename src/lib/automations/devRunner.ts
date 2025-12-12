// src/lib/automations/devRunner.ts

import { buildAutomationContext } from "./contextBuilder";
import { evaluateConditions } from "./conditions";
import { sampleWorkflows } from "../workflows/sampleTemplates";
import type {
  AutomationDefinition,
  AutomationCondition,
  AutomationStep,
} from "./types";

/**
 * Very simple dev runner so we can prove the automation engine works
 * without touching any UI yet.
 *
 * It will:
 *  - take the first sample workflow
 *  - convert it to an AutomationDefinition (engine-compatible)
 *  - build a fake lead context
 *  - "run" the steps and log what would happen
 */

export async function runSampleAutomationDev(): Promise<void> {
  const workflow = sampleWorkflows[0];

  if (!workflow) {
    console.warn("[Automation DEV] No sample workflows defined.");
    return;
  }

  const automation = workflowToSimpleAutomation(workflow);

  console.log("[Automation DEV] Running sample automation:", {
    id: automation.id,
    name: automation.name,
  });

  const payload = {
    teamId: "TEAM_DEV",
    lead: {
      id: "lead_123",
      first_name: "Dev Lead",
      email: "dev@example.com",
      phone: "+15555555555",
      status: "new",
    },
    appointment: null,
    payment: null,
    deal: null,
    meta: {
      source: "dev_runner",
    },
  };

  const triggerType =
    (automation as any).trigger?.type ??
    (automation as any).triggerType ??
    "lead_created";

  const context = buildAutomationContext(triggerType, payload);

  await runAutomationDefinitionDev(automation, context);
}

/**
 * Minimal "runner" that just logs what would happen for each step.
 * It intentionally DOES NOT send real SMS/email/etc.
 */
async function runAutomationDefinitionDev(
  automation: AutomationDefinition,
  context: Record<string, any>,
): Promise<void> {
  const steps: AutomationStep[] = automation.steps ?? [];

  if (!steps.length) {
    console.log("[Automation DEV] No steps in automation.");
    return;
  }

  for (const step of steps) {
    const conditions: AutomationCondition[] | undefined = step.conditions ?? undefined;

    const shouldRun = evaluateConditions(conditions ?? [], context, "AND");

    if (!shouldRun) {
      console.log(
        `[Automation DEV] Skipping step ${step.id} (${step.type}) – conditions not met.`,
      );
      continue;
    }

    console.log(
      `[Automation DEV] Would run step ${step.id} (${step.type}) with config:`,
      step.config,
    );

    // In the future, this is where we call the real executeAction(...)
    // For now we just simulate with a tiny delay.
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  console.log("[Automation DEV] Finished running automation.");
}

// --- Helper to flatten the workflow into an AutomationDefinition --- //

import type { WorkflowDefinition } from "../workflows/types";

function workflowToSimpleAutomation(workflow: WorkflowDefinition): AutomationDefinition {
  const triggerNode = workflow.nodes.find((n) => n.kind === "trigger");

  const steps: AutomationStep[] = workflow.nodes
    .filter((n) => n.kind === "action")
    .map((node, index) => {
      const config = (node as any).config ?? {};

      return {
        id: `${workflow.id}_step_${index}`,
        order: index,
        type: (node as any).actionType,
        config,
        conditions: (config.conditions as AutomationCondition[]) ?? undefined,
      };
    });

  const triggerType =
    (triggerNode && (triggerNode as any).triggerType) || "lead_created";

  return {
    id: workflow.id,
    teamId: workflow.teamId,
    name: workflow.name,
    description: workflow.description ?? "",
    isActive: workflow.isActive,
    triggerType,
    trigger: {
      type: triggerType,
      config: (triggerNode as any)?.config ?? {},
    },
    steps,
  } as AutomationDefinition;
}
