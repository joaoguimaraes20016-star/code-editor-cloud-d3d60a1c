/**
 * Phase 35: Expression Resolver — Micro-Expression Layer
 *
 * A pure resolver that computes expressive interaction tokens for subtle,
 * premium interaction feedback. Expression is the feel layer that makes
 * interactions feel crafted without being animated.
 *
 * Philosophy:
 * - Expression is not animation — it's tactile response
 * - Hover should acknowledge, not celebrate
 * - Focus should clarify, not highlight
 * - Press should ground, not bounce
 * - If it's noticeable, it's too much
 *
 * Expression Dimensions:
 * - Hover: Surface response, lift acknowledgment
 * - Focus: Clarity emphasis, attention framing
 * - Press: Depth grounding, tactile feedback
 * - Transition: Timing softness, easing personality
 *
 * Constraints:
 * - CSS-variable driven only
 * - No JS event listeners
 * - No animation libraries
 * - Respects prefers-reduced-motion
 * - No new UI controls
 *
 * No side effects. Pure functions only.
 * Runtime/editor parity safe with editor-only enhancements.
 */

import type { LayoutPersonality, StepIntent } from '../types';
import type { ComponentCategory } from './presenceResolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hover expression tokens for surface response.
 * Controls the subtle acknowledgment when hovering.
 */
export interface HoverExpressionTokens {
  /** Vertical lift amount (px) - should be subtle */
  lift: number;
  /** Shadow expansion multiplier (1.0 = no change) */
  shadowGrow: number;
  /** Surface brightness shift (0 = no change, positive = brighter) */
  surfaceBrighten: number;
  /** Border opacity shift (additive, 0-0.1 range) */
  borderReveal: number;
  /** Scale factor (1.0 = no change) - use sparingly */
  scale: number;
}

/**
 * Focus expression tokens for clarity emphasis.
 * Controls how focus states clarify intent without highlighting.
 */
export interface FocusExpressionTokens {
  /** Ring opacity (0-1) - soft, not glaring */
  ringOpacity: number;
  /** Ring spread (px) - how far the ring extends */
  ringSpread: number;
  /** Ring blur (px) - softer = more premium */
  ringBlur: number;
  /** Background clarity boost (0-0.05 range) */
  backgroundClarity: number;
  /** Contrast micro-boost (1.0 = no change) */
  contrastLift: number;
}

/**
 * Press expression tokens for tactile depth.
 * Controls the grounded feel when pressing/clicking.
 */
export interface PressExpressionTokens {
  /** Vertical depth (px) - how much the element sinks */
  depth: number;
  /** Shadow collapse (0-1) - how much shadow reduces */
  shadowCollapse: number;
  /** Surface darken (0-0.1 range) - subtle darkening */
  surfaceDarken: number;
  /** Scale compression (1.0 = no change) - very subtle */
  scaleCompress: number;
}

/**
 * Transition softness tokens for timing personality.
 * Controls the feel of state transitions without animation.
 */
export interface TransitionSoftnessTokens {
  /** Base duration (ms) for hover transitions */
  hoverDuration: number;
  /** Base duration (ms) for focus transitions */
  focusDuration: number;
  /** Base duration (ms) for press transitions */
  pressDuration: number;
  /** Easing curve - CSS timing function string */
  easing: string;
  /** Reduced motion multiplier (0-1) - how much to reduce */
  reducedMotionMultiplier: number;
}

/**
 * Complete expression tokens for a component.
 */
export interface ExpressionTokens {
  hover: HoverExpressionTokens;
  focus: FocusExpressionTokens;
  press: PressExpressionTokens;
  transition: TransitionSoftnessTokens;
}

/**
 * Context for expression resolution.
 */
export interface ExpressionContext {
  category: ComponentCategory;
  personality: LayoutPersonality;
  intent?: StepIntent;
  /** Whether this is in editor context (richer feedback allowed) */
  isEditor?: boolean;
  /** Whether this is a primary/action element */
  isPrimary?: boolean;
}

// ============================================================================
// BASE TOKENS - The foundation of subtlety
// ============================================================================

/**
 * Baseline hover - acknowledgment, not celebration.
 */
const BASE_HOVER: HoverExpressionTokens = {
  lift: 1,
  shadowGrow: 1.05,
  surfaceBrighten: 0.02,
  borderReveal: 0.02,
  scale: 1,
};

/**
 * Baseline focus - clarity, not highlight.
 */
const BASE_FOCUS: FocusExpressionTokens = {
  ringOpacity: 0.15,
  ringSpread: 2,
  ringBlur: 4,
  backgroundClarity: 0.01,
  contrastLift: 1.01,
};

/**
 * Baseline press - grounded, not bouncy.
 */
const BASE_PRESS: PressExpressionTokens = {
  depth: 1,
  shadowCollapse: 0.4,
  surfaceDarken: 0.03,
  scaleCompress: 0.995,
};

/**
 * Baseline transition - calm, deliberate.
 */
const BASE_TRANSITION: TransitionSoftnessTokens = {
  hoverDuration: 180,
  focusDuration: 150,
  pressDuration: 80,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  reducedMotionMultiplier: 0.3,
};

// ============================================================================
// PERSONALITY-AWARE EXPRESSION MODIFIERS
// ============================================================================

/**
 * Clean personality: Restrained, breathing, calm.
 */
const CLEAN_EXPRESSION_MODIFIERS: Partial<ExpressionTokens> = {
  hover: {
    ...BASE_HOVER,
    lift: 1,
    surfaceBrighten: 0.015,
    borderReveal: 0.015,
  },
  focus: {
    ...BASE_FOCUS,
    ringOpacity: 0.12,
    ringBlur: 6,
  },
  transition: {
    ...BASE_TRANSITION,
    hoverDuration: 200,
    focusDuration: 170,
    easing: 'cubic-bezier(0.4, 0, 0.1, 1)',
  },
};

/**
 * Editorial personality: Reading-focused, measured.
 */
const EDITORIAL_EXPRESSION_MODIFIERS: Partial<ExpressionTokens> = {
  hover: {
    ...BASE_HOVER,
    lift: 0.5,
    shadowGrow: 1.03,
    surfaceBrighten: 0.01,
    borderReveal: 0.01,
  },
  focus: {
    ...BASE_FOCUS,
    ringOpacity: 0.1,
    ringSpread: 3,
    ringBlur: 8,
  },
  transition: {
    ...BASE_TRANSITION,
    hoverDuration: 220,
    focusDuration: 180,
    easing: 'cubic-bezier(0.35, 0, 0.15, 1)',
  },
};

/**
 * Bold personality: Confident, responsive.
 */
const BOLD_EXPRESSION_MODIFIERS: Partial<ExpressionTokens> = {
  hover: {
    ...BASE_HOVER,
    lift: 2,
    shadowGrow: 1.1,
    surfaceBrighten: 0.03,
    borderReveal: 0.03,
  },
  focus: {
    ...BASE_FOCUS,
    ringOpacity: 0.2,
    ringSpread: 2,
    ringBlur: 3,
    contrastLift: 1.02,
  },
  press: {
    ...BASE_PRESS,
    depth: 1.5,
    shadowCollapse: 0.5,
  },
  transition: {
    ...BASE_TRANSITION,
    hoverDuration: 150,
    focusDuration: 120,
    pressDuration: 60,
    easing: 'cubic-bezier(0.4, 0, 0.3, 1)',
  },
};

/**
 * Dense personality: Efficient, minimal response.
 */
const DENSE_EXPRESSION_MODIFIERS: Partial<ExpressionTokens> = {
  hover: {
    ...BASE_HOVER,
    lift: 0,
    shadowGrow: 1,
    surfaceBrighten: 0.01,
    borderReveal: 0.02,
  },
  focus: {
    ...BASE_FOCUS,
    ringOpacity: 0.12,
    ringSpread: 1,
    ringBlur: 2,
    backgroundClarity: 0.008,
  },
  press: {
    ...BASE_PRESS,
    depth: 0.5,
    scaleCompress: 0.998,
  },
  transition: {
    ...BASE_TRANSITION,
    hoverDuration: 120,
    focusDuration: 100,
    pressDuration: 50,
  },
};

/**
 * Conversion personality: Action-focused, tactile.
 */
const CONVERSION_EXPRESSION_MODIFIERS: Partial<ExpressionTokens> = {
  hover: {
    ...BASE_HOVER,
    lift: 2,
    shadowGrow: 1.12,
    surfaceBrighten: 0.025,
    borderReveal: 0.02,
    scale: 1.005,
  },
  focus: {
    ...BASE_FOCUS,
    ringOpacity: 0.18,
    ringSpread: 3,
    ringBlur: 4,
    contrastLift: 1.015,
  },
  press: {
    ...BASE_PRESS,
    depth: 2,
    shadowCollapse: 0.5,
    surfaceDarken: 0.04,
  },
  transition: {
    ...BASE_TRANSITION,
    hoverDuration: 140,
    focusDuration: 110,
    pressDuration: 70,
    easing: 'cubic-bezier(0.4, 0, 0.25, 1)',
  },
};

/**
 * Personality modifier lookup.
 */
const PERSONALITY_EXPRESSION_MODIFIERS: Record<
  LayoutPersonality,
  Partial<ExpressionTokens>
> = {
  clean: CLEAN_EXPRESSION_MODIFIERS,
  editorial: EDITORIAL_EXPRESSION_MODIFIERS,
  bold: BOLD_EXPRESSION_MODIFIERS,
  dense: DENSE_EXPRESSION_MODIFIERS,
  conversion: CONVERSION_EXPRESSION_MODIFIERS,
};

// ============================================================================
// CATEGORY-SPECIFIC EXPRESSION
// ============================================================================

/**
 * Button/CTA expression: Tactile, inviting, premium.
 */
const BUTTON_EXPRESSION: Partial<ExpressionTokens> = {
  hover: {
    lift: 2,
    shadowGrow: 1.15,
    surfaceBrighten: 0.03,
    borderReveal: 0.02,
    scale: 1.01,
  },
  focus: {
    ringOpacity: 0.22,
    ringSpread: 3,
    ringBlur: 6,
    backgroundClarity: 0.015,
    contrastLift: 1.02,
  },
  press: {
    depth: 2,
    shadowCollapse: 0.6,
    surfaceDarken: 0.05,
    scaleCompress: 0.98,
  },
};

/**
 * Input expression: Calm focus, clear response.
 */
const INPUT_EXPRESSION: Partial<ExpressionTokens> = {
  hover: {
    lift: 0,
    shadowGrow: 1.02,
    surfaceBrighten: 0.015,
    borderReveal: 0.04,
    scale: 1,
  },
  focus: {
    ringOpacity: 0.2,
    ringSpread: 2,
    ringBlur: 8,
    backgroundClarity: 0.02,
    contrastLift: 1.01,
  },
  press: {
    depth: 0,
    shadowCollapse: 0,
    surfaceDarken: 0,
    scaleCompress: 1,
  },
};

/**
 * Heading expression: Editorial clarity only in editor.
 */
const HEADING_EXPRESSION: Partial<ExpressionTokens> = {
  hover: {
    lift: 0,
    shadowGrow: 1,
    surfaceBrighten: 0.01,
    borderReveal: 0.01,
    scale: 1,
  },
  focus: {
    ringOpacity: 0.08,
    ringSpread: 4,
    ringBlur: 12,
    backgroundClarity: 0.005,
    contrastLift: 1.005,
  },
  press: {
    depth: 0,
    shadowCollapse: 0,
    surfaceDarken: 0,
    scaleCompress: 1,
  },
};

/**
 * Section/container expression: Workspace feedback.
 */
const SECTION_EXPRESSION: Partial<ExpressionTokens> = {
  hover: {
    lift: 1,
    shadowGrow: 1.08,
    surfaceBrighten: 0.012,
    borderReveal: 0.025,
    scale: 1,
  },
  focus: {
    ringOpacity: 0.1,
    ringSpread: 4,
    ringBlur: 10,
    backgroundClarity: 0.008,
    contrastLift: 1.005,
  },
  press: {
    depth: 0.5,
    shadowCollapse: 0.2,
    surfaceDarken: 0.01,
    scaleCompress: 0.999,
  },
};

/**
 * Category expression lookup.
 */
const CATEGORY_EXPRESSION: Partial<Record<ComponentCategory, Partial<ExpressionTokens>>> = {
  button: BUTTON_EXPRESSION,
  input: INPUT_EXPRESSION,
  heading: HEADING_EXPRESSION,
  section: SECTION_EXPRESSION,
  container: SECTION_EXPRESSION,
  hero: SECTION_EXPRESSION,
};

// ============================================================================
// RESOLVER FUNCTIONS
// ============================================================================

/**
 * Resolve expression tokens for a component in context.
 *
 * Layered resolution:
 * 1. Start with base tokens
 * 2. Apply personality modifiers
 * 3. Apply category-specific adjustments
 * 4. Apply primary/action emphasis if needed
 * 5. Apply editor enhancements if in editor context
 *
 * @param context - The expression resolution context
 * @returns Complete resolved expression tokens
 */
export function resolveExpression(context: ExpressionContext): ExpressionTokens {
  const {
    category,
    personality,
    isEditor = false,
    isPrimary = false,
  } = context;

  // Start with base
  const base: ExpressionTokens = {
    hover: { ...BASE_HOVER },
    focus: { ...BASE_FOCUS },
    press: { ...BASE_PRESS },
    transition: { ...BASE_TRANSITION },
  };

  // Apply personality modifiers
  const personalityMods = PERSONALITY_EXPRESSION_MODIFIERS[personality] ?? {};

  // Apply category expression
  const categoryMods = CATEGORY_EXPRESSION[category] ?? {};

  // Merge layers (personality, then category)
  const merged: ExpressionTokens = {
    hover: {
      ...base.hover,
      ...personalityMods.hover,
      ...categoryMods.hover,
    },
    focus: {
      ...base.focus,
      ...personalityMods.focus,
      ...categoryMods.focus,
    },
    press: {
      ...base.press,
      ...personalityMods.press,
      ...categoryMods.press,
    },
    transition: {
      ...base.transition,
      ...personalityMods.transition,
      ...categoryMods.transition,
    },
  };

  // Enhance for primary/action elements
  if (isPrimary) {
    merged.hover.lift *= 1.25;
    merged.hover.shadowGrow *= 1.1;
    merged.focus.ringOpacity *= 1.2;
    merged.press.depth *= 1.2;
  }

  // Editor-only enhancements (richer feedback)
  if (isEditor) {
    merged.hover.surfaceBrighten *= 1.3;
    merged.hover.borderReveal *= 1.2;
    merged.focus.ringOpacity *= 1.15;
    merged.focus.backgroundClarity *= 1.5;
  }

  return merged;
}

// ============================================================================
// CSS VARIABLE GENERATION
// ============================================================================

/**
 * Generate CSS custom properties from resolved expression tokens.
 *
 * These variables are consumed by component CSS to implement
 * interaction feedback without JS listeners.
 *
 * @param tokens - The resolved expression tokens
 * @returns CSS custom properties object
 */
export function generateExpressionVariables(
  tokens: ExpressionTokens,
): Record<string, string> {
  const { hover, focus, press, transition } = tokens;

  return {
    // Hover expression
    '--expr-hover-lift': `${hover.lift}px`,
    '--expr-hover-shadow-grow': `${hover.shadowGrow}`,
    '--expr-hover-surface-brighten': `${hover.surfaceBrighten}`,
    '--expr-hover-border-reveal': `${hover.borderReveal}`,
    '--expr-hover-scale': `${hover.scale}`,

    // Focus expression
    '--expr-focus-ring-opacity': `${focus.ringOpacity}`,
    '--expr-focus-ring-spread': `${focus.ringSpread}px`,
    '--expr-focus-ring-blur': `${focus.ringBlur}px`,
    '--expr-focus-bg-clarity': `${focus.backgroundClarity}`,
    '--expr-focus-contrast': `${focus.contrastLift}`,

    // Press expression
    '--expr-press-depth': `${press.depth}px`,
    '--expr-press-shadow-collapse': `${press.shadowCollapse}`,
    '--expr-press-surface-darken': `${press.surfaceDarken}`,
    '--expr-press-scale': `${press.scaleCompress}`,

    // Transition softness
    '--expr-transition-hover': `${transition.hoverDuration}ms ${transition.easing}`,
    '--expr-transition-focus': `${transition.focusDuration}ms ${transition.easing}`,
    '--expr-transition-press': `${transition.pressDuration}ms ${transition.easing}`,
    '--expr-transition-easing': transition.easing,
    '--expr-reduced-motion-multiplier': `${transition.reducedMotionMultiplier}`,
  };
}

/**
 * Generate default expression variables for a personality.
 * Used at the root/page level to set baseline expression.
 *
 * @param personality - The layout personality
 * @param isEditor - Whether in editor context
 * @returns CSS custom properties object
 */
export function generatePersonalityExpressionVariables(
  personality: LayoutPersonality,
  isEditor = false,
): Record<string, string> {
  const baseTokens = resolveExpression({
    category: 'section', // Use section as baseline
    personality,
    isEditor,
  });

  return generateExpressionVariables(baseTokens);
}

/**
 * Convenience function to get expression variables for a specific component.
 *
 * @param context - The expression context
 * @returns CSS custom properties object
 */
export function getExpressionVariables(
  context: ExpressionContext,
): Record<string, string> {
  const tokens = resolveExpression(context);
  return generateExpressionVariables(tokens);
}
