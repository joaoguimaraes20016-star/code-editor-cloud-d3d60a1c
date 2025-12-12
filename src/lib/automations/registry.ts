// src/lib/automations/registry.ts
import type { AutomationDefinition, TriggerType } from './types';

/**
 * Simple in-memory registry so the engine has something to run against
 * even before you wire a real DB table.
 *
 * Later you can swap these helpers to read/write from your "automations" table.
 */

const automationStore: Record<string, AutomationDefinition[]> = {};

/**
 * Register/replace all automations for a team.
 * Useful when saving from a visual workflow builder.
 */
export function setAutomationsForTeam(
  teamId: string,
  automations: AutomationDefinition[],
): void {
  automationStore[teamId] = automations ?? [];
}

/**
 * Returns all automations for the team (across triggers).
 */
export function getAutomationsForTeam(teamId: string): AutomationDefinition[] {
  return automationStore[teamId] ?? [];
}

/**
 * Returns only automations that match the given trigger type.
 */
export function getAutomationsForTrigger(
  teamId: string,
  triggerType: TriggerType,
): AutomationDefinition[] {
  const list = automationStore[teamId] ?? [];
  return list.filter((a) => a.triggerType === triggerType);
}

/**
 * Allows adding a single automation without blowing away the rest.
 */
export function addAutomation(teamId: string, automation: AutomationDefinition): void {
  const list = automationStore[teamId] ?? [];
  automationStore[teamId] = [...list, automation];
}
