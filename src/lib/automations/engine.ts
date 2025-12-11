// src/lib/automations/engine.ts
import {
  type AutomationDefinition,
  type AutomationCondition,
  type TriggerType,
} from './types';
import { runAction } from './actions';

interface RunAutomationsParams {
  teamId: string;
  triggerType: TriggerType;
  eventPayload: Record<string, any>;
}

/**
 * Call this whenever something happens
 * (lead created, appointment booked, payment received, etc.).
 */
export async function runAutomationsForTrigger({
  teamId,
  triggerType,
  eventPayload,
}: RunAutomationsParams) {
  const automations = await fetchAutomationsForTeamAndTrigger(
    teamId,
    triggerType,
  );

  for (const automation of automations) {
    if (!automation.isActive) continue;

    const passed = evaluateConditions(automation.conditions, eventPayload);
    if (!passed) continue;

    for (const action of automation.actions) {
      await runAction({
        teamId,
        automationId: automation.id,
        actionConfig: action,
        eventPayload,
      });
    }
  }
}

// TODO: wire this to Supabase table later
async function fetchAutomationsForTeamAndTrigger(
  teamId: string,
  triggerType: TriggerType,
): Promise<AutomationDefinition[]> {
  console.warn(
    '[automations] fetchAutomationsForTeamAndTrigger not implemented yet',
    { teamId, triggerType },
  );
  return [];
}

function evaluateConditions(
  conditions: AutomationCondition[],
  payload: Record<string, any>,
): boolean {
  if (!conditions.length) return true;

  return conditions.every((cond) => {
    const value = get(payload, cond.field);

    switch (cond.operator) {
      case 'equals':
        return value === cond.value;
      case 'not_equals':
        return value !== cond.value;
      case 'contains':
        return typeof value === 'string' &&
          String(value).includes(String(cond.value));
      case 'gt':
        return Number(value) > Number(cond.value);
      case 'lt':
        return Number(value) < Number(cond.value);
      case 'in':
        return Array.isArray(cond.value) && cond.value.includes(value);
      default:
        return false;
    }
  });
}

function get(obj: any, path: string): any {
  return path
    .split('.')
    .reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}
