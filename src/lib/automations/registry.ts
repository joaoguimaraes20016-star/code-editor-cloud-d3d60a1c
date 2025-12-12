// src/lib/automations/registry.ts
import { supabase } from '@/integrations/supabase/client';
import type { AutomationDefinition, TriggerType } from './types';
import { sampleWorkflows } from '../workflows/sampleTemplates';
import { workflowToAutomation } from '../workflows/serializer';

/**
 * Registry for automations.
 * Reads from Supabase `automations` table, with fallback to sample templates.
 */

// In-memory cache for fallback (used by edge function which can't import supabase client)
const automationStore: Record<string, AutomationDefinition[]> = {};

/**
 * Register/replace all automations for a team (in-memory, for edge function use).
 */
export function setAutomationsForTeam(
  teamId: string,
  automations: AutomationDefinition[],
): void {
  automationStore[teamId] = automations ?? [];
}

/**
 * Returns all automations for the team from in-memory store.
 */
export function getAutomationsForTeam(teamId: string): AutomationDefinition[] {
  return automationStore[teamId] ?? [];
}

/**
 * Get default template automations for a team (fallback when no DB automations exist).
 */
export function getDefaultTemplateAutomations(teamId: string): AutomationDefinition[] {
  return sampleWorkflows
    .map((workflow) => {
      const automation = workflowToAutomation({
        ...workflow,
        teamId, // Override template teamId with actual teamId
      });
      return automation;
    })
    .filter((a): a is AutomationDefinition => a !== null);
}

/**
 * Fetches automations from the database for a specific team and trigger type.
 * Falls back to sample templates if no automations exist.
 */
export async function getAutomationsForTrigger(
  teamId: string,
  triggerType: TriggerType,
): Promise<AutomationDefinition[]> {
  try {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('team_id', teamId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (error) {
      console.error('[Registry] Error fetching automations:', error);
      // Fall back to templates on error
      return getDefaultTemplateAutomations(teamId).filter(
        (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
      );
    }

    if (data && data.length > 0) {
      // Map DB rows to AutomationDefinition
      return data.map((row) => {
        const definition = row.definition as Record<string, any>;
        return {
          id: row.id,
          teamId: row.team_id,
          name: row.name,
          description: row.description || '',
          isActive: row.is_active,
          trigger: definition.trigger || { type: row.trigger_type, config: {} },
          triggerType: row.trigger_type as TriggerType,
          steps: definition.steps || [],
          conditions: definition.conditions,
          actions: definition.actions,
        } as AutomationDefinition;
      });
    }

    // No automations found - fall back to templates
    console.log('[Registry] No automations found for team, using templates');
    return getDefaultTemplateAutomations(teamId).filter(
      (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
    );
  } catch (err) {
    console.error('[Registry] Unexpected error:', err);
    return getDefaultTemplateAutomations(teamId).filter(
      (a) => a.trigger?.type === triggerType || a.triggerType === triggerType
    );
  }
}

/**
 * Adds a single automation to in-memory store (for edge function use).
 */
export function addAutomation(teamId: string, automation: AutomationDefinition): void {
  const list = automationStore[teamId] ?? [];
  automationStore[teamId] = [...list, automation];
}

/**
 * Saves an automation to the database.
 */
export async function saveAutomation(
  automation: Omit<AutomationDefinition, 'id'> & { id?: string }
): Promise<{ id: string } | null> {
  const definition = JSON.parse(JSON.stringify({
    trigger: automation.trigger,
    steps: automation.steps,
    conditions: automation.conditions,
    actions: automation.actions,
  }));

  const payload = {
    team_id: automation.teamId,
    name: automation.name,
    description: automation.description || null,
    trigger_type: String(automation.trigger?.type || automation.triggerType),
    is_active: automation.isActive,
    definition,
  };

  if (automation.id) {
    // Update existing
    const { error } = await supabase
      .from('automations')
      .update(payload)
      .eq('id', automation.id);

    if (error) {
      console.error('[Registry] Error updating automation:', error);
      return null;
    }
    return { id: automation.id };
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('automations')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      console.error('[Registry] Error saving automation:', error);
      return null;
    }
    return data;
  }
}

/**
 * Deletes an automation from the database.
 */
export async function deleteAutomation(automationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('automations')
    .delete()
    .eq('id', automationId);

  if (error) {
    console.error('[Registry] Error deleting automation:', error);
    return false;
  }
  return true;
}
