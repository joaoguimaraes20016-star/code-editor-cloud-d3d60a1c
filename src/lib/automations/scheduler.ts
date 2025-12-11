// src/lib/automations/scheduler.ts
import type { TriggerType } from './types';
import { runAutomationsForTrigger } from './engine';

export interface ScheduledAutomationJob {
  id: string;
  teamId: string;
  triggerType: TriggerType;
  runAt: string; // ISO
  payload: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Time-based / delayed automations.
 * Later this will query a scheduled_automation_jobs table.
 */
export async function processDueAutomationJobs() {
  console.warn('[scheduler] processDueAutomationJobs stub called');

  const jobs: ScheduledAutomationJob[] = [];

  for (const job of jobs) {
    try {
      await runAutomationsForTrigger({
        teamId: job.teamId,
        triggerType: job.triggerType,
        eventPayload: job.payload,
      });
      // TODO: mark job as completed
    } catch (error) {
      console.error('[scheduler] job failed', { jobId: job.id, error });
      // TODO: mark job as failed
    }
  }
}
