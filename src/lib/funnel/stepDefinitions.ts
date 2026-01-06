// src/lib/funnel/stepDefinitions.ts
// Central Step Definition Registry - Single Source of Truth

import type { StepDefinition, StepType, StepIntent } from './types';

/**
 * STEP_DEFINITIONS is the canonical registry for all funnel step types.
 * This defines:
 * - What each step type can do (capabilities)
 * - What fields it handles (schema)
 * - Validation rules
 * - Builder configuration (allowed intents, defaults)
 */
export const STEP_DEFINITIONS: Record<StepType, StepDefinition> = {
  welcome: {
    type: 'welcome',
    label: 'Welcome',
    description: 'Introduction screen with CTA button',
    capabilities: {
      canCreateLead: false,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: [],
      optional: [],
      extracted: [],
    },
    validation: {
      requiresInput: false,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['collect', 'complete'],
      defaultIntent: 'collect',
    },
  },

  text_question: {
    type: 'text_question',
    label: 'Text Question',
    description: 'Free-form text input question',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: [],
      optional: ['name'],
      extracted: ['name'], // Can extract name from text question
    },
    validation: {
      requiresInput: true,
      inputValidator: (value: any) => typeof value === 'string' && value.trim().length > 0,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['collect', 'capture'],
      defaultIntent: 'collect',
    },
  },

  multi_choice: {
    type: 'multi_choice',
    label: 'Multi Choice',
    description: 'Multiple choice selection question',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: [],
      optional: [],
      extracted: [],
    },
    validation: {
      requiresInput: true,
      inputValidator: (value: any) => value !== undefined && value !== null,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['collect'],
      defaultIntent: 'collect',
    },
  },

  email_capture: {
    type: 'email_capture',
    label: 'Email Capture',
    description: 'Collects email address - can trigger workflows',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: true,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: ['email'],
      optional: [],
      extracted: ['email'],
    },
    validation: {
      requiresInput: true,
      inputValidator: (value: any) => {
        if (typeof value !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['capture', 'collect'],
      defaultIntent: 'capture',
    },
  },

  phone_capture: {
    type: 'phone_capture',
    label: 'Phone Capture',
    description: 'Collects phone number - can trigger workflows',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: true,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: ['phone'],
      optional: [],
      extracted: ['phone'],
    },
    validation: {
      requiresInput: true,
      inputValidator: (value: any) => typeof value === 'string' && value.length >= 7,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['capture', 'collect'],
      defaultIntent: 'capture',
    },
  },

  video: {
    type: 'video',
    label: 'Video',
    description: 'Video content with optional CTA',
    capabilities: {
      canCreateLead: false,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: [],
      optional: [],
      extracted: [],
    },
    validation: {
      requiresInput: false,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['collect'],
      defaultIntent: 'collect',
    },
  },

  opt_in: {
    type: 'opt_in',
    label: 'Opt-In Form',
    description: 'Full contact form (name, email, phone) - primary capture step',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: true,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: ['email', 'phone', 'name'],
      optional: [],
      extracted: ['email', 'phone', 'name'],
    },
    validation: {
      requiresInput: true,
      inputValidator: (value: any) => {
        if (typeof value !== 'object') return false;
        return !!(value.email && value.phone && value.name);
      },
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['capture'],
      defaultIntent: 'capture',
    },
  },

  embed: {
    type: 'embed',
    label: 'Embed/iFrame',
    description: 'Calendly or other embedded content',
    capabilities: {
      canCreateLead: true,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: true,
    },
    fields: {
      required: [],
      optional: ['calendly_booking_data'],
      extracted: [],
    },
    validation: {
      requiresInput: false,
    },
    builder: {
      intentLocked: false,
      allowedIntents: ['schedule', 'collect'],
      defaultIntent: 'schedule',
    },
  },

  thank_you: {
    type: 'thank_you',
    label: 'Thank You',
    description: 'Final completion page - never triggers workflows',
    capabilities: {
      canCreateLead: false,
      canFinalizeLead: false,
      canEmitEvents: true,
      canSchedule: false,
    },
    fields: {
      required: [],
      optional: [],
      extracted: [],
    },
    validation: {
      requiresInput: false,
    },
    builder: {
      intentLocked: true, // Cannot change intent - always complete
      allowedIntents: ['complete'],
      defaultIntent: 'complete',
    },
  },
};

/**
 * Get the step definition for a given step type
 */
export function getStepDefinition(stepType: string): StepDefinition | null {
  return STEP_DEFINITIONS[stepType as StepType] || null;
}

/**
 * Get the default intent for a step type
 * This is the canonical source - replaces inline getDefaultIntent functions
 */
export function getDefaultIntent(stepType: string): StepIntent {
  const definition = getStepDefinition(stepType);
  return definition?.builder.defaultIntent || 'collect';
}

/**
 * Check if a step type can be a capture authority
 */
export function canBeCapture(stepType: string): boolean {
  const definition = getStepDefinition(stepType);
  return definition?.capabilities.canFinalizeLead || false;
}

/**
 * Get allowed intents for a step type
 */
export function getAllowedIntents(stepType: string): StepIntent[] {
  const definition = getStepDefinition(stepType);
  return definition?.builder.allowedIntents || ['collect'];
}

/**
 * Check if intent is locked for a step type (cannot be changed)
 */
export function isIntentLocked(stepType: string): boolean {
  const definition = getStepDefinition(stepType);
  return definition?.builder.intentLocked || false;
}

/**
 * Validate that an intent is valid for a step type
 */
export function isValidIntent(stepType: string, intent: StepIntent): boolean {
  const allowedIntents = getAllowedIntents(stepType);
  return allowedIntents.includes(intent);
}

/**
 * Get label for step type
 */
export function getStepTypeLabel(stepType: string): string {
  const definition = getStepDefinition(stepType);
  return definition?.label || stepType;
}

/**
 * Intent labels for UI display
 */
export const INTENT_LABELS: Record<StepIntent, string> = {
  capture: 'Submit (Send Lead)',
  collect: 'Save Progress',
  schedule: 'Book a Time',
  complete: 'Finish',
};

/**
 * Intent descriptions for UI display
 */
export const INTENT_DESCRIPTIONS: Record<StepIntent, string> = {
  capture: 'Sends the lead and starts any connected actions.',
  collect: 'Saves progress without sending the lead yet.',
  schedule: 'Use for scheduling or calendar embeds.',
  complete: 'Final step with no further action.',
};

/**
 * Check if a funnel has multiple capture steps (guardrail violation)
 */
export function countCaptureSteps(steps: Array<{ step_type: string; content: Record<string, any> }>): number {
  return steps.filter(step => {
    const intent = step.content?.intent || getDefaultIntent(step.step_type);
    return intent === 'capture';
  }).length;
}

/**
 * Validate funnel structure - returns array of warnings
 */
export function validateFunnelStructure(steps: Array<{ step_type: string; content: Record<string, any> }>): string[] {
  const warnings: string[] = [];
  
  const captureCount = countCaptureSteps(steps);
  
  if (captureCount === 0) {
    warnings.push('No submit step found. Funnels should have at least one step that sends a lead.');
  } else if (captureCount > 1) {
    warnings.push(`Multiple submit steps detected (${captureCount}). Keep only one submit step to avoid duplicate sends.`);
  }
  
  // Check if thank_you is last
  const lastStep = steps[steps.length - 1];
  if (lastStep && lastStep.step_type !== 'thank_you') {
    warnings.push('Consider adding a Thank You page as the final step.');
  }
  
  return warnings;
}
