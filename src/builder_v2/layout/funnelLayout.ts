import type { LayoutPersonality, Page, PageType, StepIntent } from '../types';
import {
  resolveLayoutPersonality,
  type ResolvedPersonality,
} from './personalityResolver';
import { SPACING, RULE_0 } from './layoutTokens';

export type FunnelWidthPreset = 'compact' | 'standard' | 'wide';

export interface VerticalRhythmTokens {
  stepGap: number;
  blockGap: number;
  contentGap: number;
  actionGap: number;
}

export interface FunnelLayoutMetrics {
  intent: StepIntent;
  width: FunnelWidthPreset;
  maxWidth: number;
  gutters: {
    horizontal: number;
    top: number;
    bottom: number;
  };
  spacing: VerticalRhythmTokens;
  /** Phase 27: Resolved personality configuration */
  personality: ResolvedPersonality;
}

export type LayoutTarget = Pick<Page, 'type' | 'layoutIntent' | 'layoutPersonality'>;

const WIDTH_PIXELS: Record<FunnelWidthPreset, number> = {
  compact: 420,
  standard: 460,
  wide: 520,
};

const WIDTH_GUTTERS: Record<FunnelWidthPreset, number> = {
  compact: 16,
  standard: 20,
  wide: 24,
};

const PAGE_TYPE_INTENT_MAP: Record<PageType, StepIntent> = {
  landing: 'content',
  optin: 'optin',
  appointment: 'checkout',
  thank_you: 'thank_you',
};

const INTENT_WIDTH_MAP: Record<StepIntent, FunnelWidthPreset> = {
  optin: 'compact',
  content: 'wide',
  checkout: 'standard',
  thank_you: 'compact',
};

const BASE_SPACING: VerticalRhythmTokens = {
  stepGap: 40,
  blockGap: 28,
  contentGap: 16,
  actionGap: 28,
};

const INTENT_SPACING: Record<StepIntent, Partial<VerticalRhythmTokens>> = {
  optin: {
    blockGap: 24,
    contentGap: 14,
    actionGap: 32,
  },
  content: {
    stepGap: 48,
    blockGap: 36,
    contentGap: 20,
    actionGap: 32,
  },
  checkout: {
    blockGap: 26,
    contentGap: 15,
    actionGap: 36,
  },
  thank_you: {
    blockGap: 24,
    contentGap: 14,
    actionGap: 24,
  },
};

const INTENT_VERTICAL_PADDING: Record<StepIntent, { top: number; bottom: number }> = {
  optin: { top: 48, bottom: 64 },
  content: { top: 64, bottom: 80 },
  checkout: { top: 56, bottom: 72 },
  thank_you: { top: 40, bottom: 56 },
};

function mapPageTypeToIntent(type: PageType): StepIntent {
  return PAGE_TYPE_INTENT_MAP[type] ?? 'content';
}

export function resolveStepIntent(target: LayoutTarget): StepIntent {
  if (target.layoutIntent) {
    return target.layoutIntent;
  }
  return mapPageTypeToIntent(target.type);
}

function resolveWidthPreset(intent: StepIntent): FunnelWidthPreset {
  return INTENT_WIDTH_MAP[intent] ?? 'standard';
}

/**
 * Phase 38: LOCKED spacing resolution.
 * 
 * Dynamic rhythm multipliers and intent-based spacing overrides are DISABLED.
 * Returns canonical locked values only.
 * 
 * RULE_0: Intelligence MAY NOT change spacing units.
 */
function resolveSpacing(
  _intent: StepIntent,
  _personality: ResolvedPersonality,
): VerticalRhythmTokens {
  // Phase 38: LOCKED values — no multipliers, no overrides
  // Intent and personality parameters are ignored for geometry (RULE_0)
  return {
    stepGap: SPACING.SECTION_GAP,
    blockGap: SPACING.BLOCK_GAP,
    contentGap: SPACING.TEXT_GAP,
    actionGap: SPACING.CTA_GAP,
  };
}

export function resolveFunnelLayout(target: LayoutTarget): FunnelLayoutMetrics {
  const intent = resolveStepIntent(target);
  const width = resolveWidthPreset(intent);
  const personality = resolveLayoutPersonality(target.layoutPersonality);
  const spacing = resolveSpacing(intent, personality);
  
  // Phase 38: LOCKED vertical padding — no personality multipliers for geometry
  // Personality is preserved for DECORATIVE use only (opacity, color, scale ≤ 1.03)
  const verticalPadding = { top: 64, bottom: 72 }; // LOCKED values

  return {
    intent,
    width,
    maxWidth: WIDTH_PIXELS[width],
    gutters: {
      horizontal: WIDTH_GUTTERS[width],
      // Phase 38: LOCKED padding values
      top: verticalPadding.top,
      bottom: verticalPadding.bottom,
    },
    spacing,
    personality,
  };
}
