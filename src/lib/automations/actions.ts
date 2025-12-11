// src/lib/automations/actions.ts
import { type AutomationActionConfig } from './types';
import { renderTemplate } from './templateUtils';

interface RunActionParams {
  teamId: string;
  automationId: string;
  actionConfig: AutomationActionConfig;
  eventPayload: Record<string, any>;
}

/**
 * Execute a single automation action.
 * Stub implementation - will be wired to real handlers later.
 */
export async function runAction({
  teamId,
  automationId,
  actionConfig,
  eventPayload,
}: RunActionParams): Promise<void> {
  console.log('[automations] runAction', {
    teamId,
    automationId,
    actionType: actionConfig.type,
    params: actionConfig.params,
  });

  switch (actionConfig.type) {
    case 'send_message':
      await handleSendMessage(teamId, actionConfig.params, eventPayload);
      break;
    case 'add_task':
      await handleAddTask(teamId, actionConfig.params, eventPayload);
      break;
    case 'add_tag':
      await handleAddTag(teamId, actionConfig.params, eventPayload);
      break;
    case 'notify_team':
      await handleNotifyTeam(teamId, actionConfig.params, eventPayload);
      break;
    case 'enqueue_dialer':
      await handleEnqueueDialer(teamId, actionConfig.params, eventPayload);
      break;
    case 'custom_webhook':
      await handleCustomWebhook(teamId, actionConfig.params, eventPayload);
      break;
    default:
      console.warn('[automations] Unknown action type:', actionConfig.type);
  }
}

// Stub handlers - to be implemented
async function handleSendMessage(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  const message = renderTemplate(params.message || '', payload);
  console.log('[automations] handleSendMessage', { teamId, message, channel: params.channel });
}

async function handleAddTask(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  console.log('[automations] handleAddTask', { teamId, params, payload });
}

async function handleAddTag(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  console.log('[automations] handleAddTag', { teamId, tag: params.tag });
}

async function handleNotifyTeam(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  const message = renderTemplate(params.message || '', payload);
  console.log('[automations] handleNotifyTeam', { teamId, message });
}

async function handleEnqueueDialer(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  console.log('[automations] handleEnqueueDialer', { teamId, params, payload });
}

async function handleCustomWebhook(
  teamId: string,
  params: Record<string, any>,
  payload: Record<string, any>,
): Promise<void> {
  console.log('[automations] handleCustomWebhook', { teamId, url: params.url, payload });
}
