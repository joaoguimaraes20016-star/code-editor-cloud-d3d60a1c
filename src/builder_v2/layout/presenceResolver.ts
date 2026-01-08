/**
 * Phase 34: Presence Resolver
 *
 * A pure resolver that computes component presence tokens based on
 * personality and intent context. Presence is the invisible layer that
 * makes components feel designed-by-default.
 *
 * Philosophy:
 * - Presence is not decoration — it's optical refinement
 * - If it feels flashy, it's wrong
 * - Subtle, premium, restrained
 * - No user-facing controls
 * - No prop modification
 *
 * Presence Dimensions:
 * - Elevation: z-depth perception, shadow weight, surface lift
 * - Surface: background treatment, border subtlety, inner glow
 * - Emphasis: visual weight, contrast, attention draw
 *
 * No side effects. Pure functions only.
 * CSS-variable driven. Runtime/editor parity safe.
 */

import type { LayoutPersonality, StepIntent } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Component category for presence resolution.
 * Different categories have different presence characteristics.
 */
export type ComponentCategory =
  | 'heading'
  | 'body'
  | 'input'
  | 'button'
  | 'section'
  | 'container'
  | 'hero';

/**
 * Elevation tokens for z-depth perception.
 * Controls shadow weight and surface lift.
 */
export interface ElevationTokens {
  /** Shadow blur radius (px) */
  shadowBlur: number;
  /** Shadow spread (px) */
  shadowSpread: number;
  /** Shadow Y offset (px) */
  shadowY: number;
  /** Shadow opacity (0-1) */
  shadowOpacity: number;
  /** Accent glow opacity for interactive elements (0-1) */
  accentGlowOpacity: number;
  /** Surface lift on hover (px) */
  hoverLift: number;
}

/**
 * Surface tokens for background treatment.
 * Controls background subtlety and border refinement.
 */
export interface SurfaceTokens {
  /** Background opacity (0-1) */
  backgroundOpacity: number;
  /** Border opacity (0-1) */
  borderOpacity: number;
  /** Inner highlight opacity for depth (0-1) */
  innerHighlightOpacity: number;
  /** Backdrop blur for glass effect (px) */
  backdropBlur: number;
}

/**
 * Emphasis tokens for visual weight.
 * Controls attention draw and contrast.
 */
export interface EmphasisTokens {
  /** Typographic dominance scale (1.0 = baseline) */
  typographicScale: number;
  /** Letter spacing adjustment (em) */
  letterSpacingAdjust: number;
  /** Line height multiplier */
  lineHeightMultiplier: number;
  /** Optical margin compensation (px) - for visual alignment */
  opticalMarginLeft: number;
  /** Font weight adjustment (0 = no change, positive = bolder) */
  fontWeightDelta: number;
  /** Contrast boost (1.0 = no change) */
  contrastBoost: number;
}

/**
 * Complete presence tokens for a component.
 */
export interface PresenceTokens {
  elevation: ElevationTokens;
  surface: SurfaceTokens;
  emphasis: EmphasisTokens;
}

/**
 * Context for presence resolution.
 */
export interface PresenceContext {
  category: ComponentCategory;
  personality: LayoutPersonality;
  intent: StepIntent;
  /** Whether this is a primary/hero element */
  isPrimary?: boolean;
  /** Nesting depth (0 = root level) */
  depth?: number;
}

// ============================================================================
// BASE TOKENS
// ============================================================================

/**
 * Baseline elevation - subtle, grounded.
 */
const BASE_ELEVATION: ElevationTokens = {
  shadowBlur: 8,
  shadowSpread: -2,
  shadowY: 4,
  shadowOpacity: 0.08,
  accentGlowOpacity: 0,
  hoverLift: 1,
};

/**
 * Baseline surface - almost invisible.
 */
const BASE_SURFACE: SurfaceTokens = {
  backgroundOpacity: 0.02,
  borderOpacity: 0.03,
  innerHighlightOpacity: 0,
  backdropBlur: 0,
};

/**
 * Baseline emphasis - neutral.
 */
const BASE_EMPHASIS: EmphasisTokens = {
  typographicScale: 1.0,
  letterSpacingAdjust: 0,
  lineHeightMultiplier: 1.5,
  opticalMarginLeft: 0,
  fontWeightDelta: 0,
  contrastBoost: 1.0,
};

// ============================================================================
// CATEGORY-SPECIFIC PRESENCE
// ============================================================================

/**
 * Heading presence: typographic dominance, optical correction.
 * Headlines should feel confident without screaming.
 */
const HEADING_PRESENCE: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 0, // No shadow on text
    shadowOpacity: 0,
    hoverLift: 0,
  },
  emphasis: {
    typographicScale: 1.0,
    letterSpacingAdjust: -0.015, // Tighter tracking for headlines
    lineHeightMultiplier: 1.2,
    opticalMarginLeft: -0.03, // Optical left alignment (em units)
    fontWeightDelta: 100, // Slightly bolder
    contrastBoost: 1.02,
  },
};

/**
 * Input/form field presence: surface separation, calm focus.
 * Inputs should feel accessible without demanding attention.
 */
const INPUT_PRESENCE: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 6,
    shadowSpread: 0,
    shadowY: 2,
    shadowOpacity: 0.06,
    accentGlowOpacity: 0.08,
    hoverLift: 0.5,
  },
  surface: {
    backgroundOpacity: 0.04,
    borderOpacity: 0.08,
    innerHighlightOpacity: 0.02,
    backdropBlur: 4,
  },
  emphasis: {
    ...BASE_EMPHASIS,
    contrastBoost: 1.0,
  },
};

/**
 * Button/CTA presence: elevation, grounding, confidence.
 * Buttons should feel actionable and trustworthy.
 */
const BUTTON_PRESENCE: Partial<PresenceTokens> = {
  elevation: {
    shadowBlur: 16,
    shadowSpread: -4,
    shadowY: 6,
    shadowOpacity: 0.15,
    accentGlowOpacity: 0.18,
    hoverLift: 2,
  },
  surface: {
    backgroundOpacity: 1.0, // Buttons have solid backgrounds
    borderOpacity: 0,
    innerHighlightOpacity: 0.08,
    backdropBlur: 0,
  },
  emphasis: {
    typographicScale: 1.0,
    letterSpacingAdjust: 0.01,
    lineHeightMultiplier: 1.0,
    opticalMarginLeft: 0,
    fontWeightDelta: 100,
    contrastBoost: 1.0,
  },
};

/**
 * Section/container presence: implicit separation, rhythm.
 * Sections should organize without boxing.
 */
const SECTION_PRESENCE: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 0,
    shadowOpacity: 0,
    hoverLift: 0,
  },
  surface: {
    backgroundOpacity: 0,
    borderOpacity: 0,
    innerHighlightOpacity: 0,
    backdropBlur: 0,
  },
  emphasis: {
    ...BASE_EMPHASIS,
  },
};

/**
 * Hero presence: enhanced elevation, commanding but not loud.
 */
const HERO_PRESENCE: Partial<PresenceTokens> = {
  elevation: {
    shadowBlur: 24,
    shadowSpread: -8,
    shadowY: 12,
    shadowOpacity: 0.12,
    accentGlowOpacity: 0.05,
    hoverLift: 0,
  },
  surface: {
    backgroundOpacity: 0.95,
    borderOpacity: 0.04,
    innerHighlightOpacity: 0.03,
    backdropBlur: 0,
  },
  emphasis: {
    typographicScale: 1.15,
    letterSpacingAdjust: -0.02,
    lineHeightMultiplier: 1.15,
    opticalMarginLeft: -0.02,
    fontWeightDelta: 100,
    contrastBoost: 1.03,
  },
};

/**
 * Category to base presence mapping.
 */
const CATEGORY_PRESENCE: Record<ComponentCategory, Partial<PresenceTokens>> = {
  heading: HEADING_PRESENCE,
  body: {}, // Body uses base presence
  input: INPUT_PRESENCE,
  button: BUTTON_PRESENCE,
  section: SECTION_PRESENCE,
  container: SECTION_PRESENCE,
  hero: HERO_PRESENCE,
};

// ============================================================================
// PERSONALITY MODIFIERS
// ============================================================================

/**
 * Clean personality: restrained, breathable.
 */
const CLEAN_MODIFIERS: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowOpacity: 0.06,
    accentGlowOpacity: 0.12,
  },
  surface: {
    ...BASE_SURFACE,
    backgroundOpacity: 0.015,
    borderOpacity: 0.025,
  },
};

/**
 * Editorial personality: refined, reading-focused.
 */
const EDITORIAL_MODIFIERS: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowOpacity: 0.05,
    accentGlowOpacity: 0.08,
  },
  emphasis: {
    ...BASE_EMPHASIS,
    typographicScale: 1.05,
    letterSpacingAdjust: -0.005,
    lineHeightMultiplier: 1.6,
  },
};

/**
 * Bold personality: confident, impactful.
 */
const BOLD_MODIFIERS: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 12,
    shadowY: 6,
    shadowOpacity: 0.12,
    accentGlowOpacity: 0.22,
    hoverLift: 2,
  },
  emphasis: {
    ...BASE_EMPHASIS,
    typographicScale: 1.08,
    fontWeightDelta: 100,
    contrastBoost: 1.04,
  },
};

/**
 * Dense personality: compact, efficient.
 */
const DENSE_MODIFIERS: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 4,
    shadowY: 2,
    shadowOpacity: 0.04,
    accentGlowOpacity: 0.06,
    hoverLift: 0.5,
  },
  surface: {
    ...BASE_SURFACE,
    backgroundOpacity: 0.01,
    borderOpacity: 0.02,
  },
  emphasis: {
    ...BASE_EMPHASIS,
    typographicScale: 0.95,
    lineHeightMultiplier: 1.4,
  },
};

/**
 * Conversion personality: action-focused, urgent but not desperate.
 */
const CONVERSION_MODIFIERS: Partial<PresenceTokens> = {
  elevation: {
    ...BASE_ELEVATION,
    shadowBlur: 14,
    shadowY: 5,
    shadowOpacity: 0.1,
    accentGlowOpacity: 0.25,
    hoverLift: 2.5,
  },
  emphasis: {
    ...BASE_EMPHASIS,
    typographicScale: 1.02,
    contrastBoost: 1.02,
  },
};

/**
 * Personality to modifiers mapping.
 */
const PERSONALITY_MODIFIERS: Record<LayoutPersonality, Partial<PresenceTokens>> = {
  clean: CLEAN_MODIFIERS,
  editorial: EDITORIAL_MODIFIERS,
  bold: BOLD_MODIFIERS,
  dense: DENSE_MODIFIERS,
  conversion: CONVERSION_MODIFIERS,
};

// ============================================================================
// INTENT MODIFIERS
// ============================================================================

/**
 * Intent-based adjustments for CTA elements.
 * Different intents require different action emphasis.
 */
const INTENT_CTA_MODIFIERS: Record<StepIntent, Partial<ElevationTokens>> = {
  optin: {
    shadowOpacity: 0.18,
    accentGlowOpacity: 0.22,
    hoverLift: 2.5,
  },
  checkout: {
    shadowOpacity: 0.2,
    accentGlowOpacity: 0.28,
    hoverLift: 3,
  },
  content: {
    shadowOpacity: 0.12,
    accentGlowOpacity: 0.15,
    hoverLift: 1.5,
  },
  thank_you: {
    shadowOpacity: 0.08,
    accentGlowOpacity: 0.1,
    hoverLift: 1,
  },
};

// ============================================================================
// RESOLVER
// ============================================================================

/**
 * Deep merge presence tokens with proper typing.
 */
function mergePresence(
  base: PresenceTokens,
  ...overrides: Array<Partial<PresenceTokens>>
): PresenceTokens {
  let result: PresenceTokens = { ...base };

  for (const override of overrides) {
    if (override.elevation) {
      result = {
        ...result,
        elevation: { ...result.elevation, ...override.elevation },
      };
    }
    if (override.surface) {
      result = {
        ...result,
        surface: { ...result.surface, ...override.surface },
      };
    }
    if (override.emphasis) {
      result = {
        ...result,
        emphasis: { ...result.emphasis, ...override.emphasis },
      };
    }
  }

  return result;
}

/**
 * Resolve complete presence tokens for a component.
 *
 * Resolution order (each layer can override previous):
 * 1. Base tokens
 * 2. Category-specific tokens
 * 3. Personality modifiers
 * 4. Intent modifiers (for CTAs only)
 * 5. Primary element boost (if applicable)
 * 6. Depth attenuation (deeper = more subtle)
 *
 * @param context - Presence resolution context
 * @returns Complete presence tokens
 */
export function resolvePresence(context: PresenceContext): PresenceTokens {
  const {
    category,
    personality,
    intent,
    isPrimary = false,
    depth = 0,
  } = context;

  // 1. Start with base tokens
  const baseTokens: PresenceTokens = {
    elevation: { ...BASE_ELEVATION },
    surface: { ...BASE_SURFACE },
    emphasis: { ...BASE_EMPHASIS },
  };

  // 2. Apply category-specific presence
  const categoryTokens = CATEGORY_PRESENCE[category] ?? {};

  // 3. Apply personality modifiers
  const personalityTokens = PERSONALITY_MODIFIERS[personality] ?? {};

  // 4. Merge base layers
  let result = mergePresence(baseTokens, categoryTokens, personalityTokens);

  // 5. Apply intent modifiers for buttons/CTAs
  if (category === 'button') {
    const intentElevation = INTENT_CTA_MODIFIERS[intent];
    if (intentElevation) {
      result = {
        ...result,
        elevation: { ...result.elevation, ...intentElevation },
      };
    }
  }

  // 6. Primary element boost
  if (isPrimary) {
    result = {
      ...result,
      elevation: {
        ...result.elevation,
        shadowOpacity: result.elevation.shadowOpacity * 1.2,
        accentGlowOpacity: result.elevation.accentGlowOpacity * 1.3,
      },
      emphasis: {
        ...result.emphasis,
        typographicScale: result.emphasis.typographicScale * 1.05,
        contrastBoost: result.emphasis.contrastBoost * 1.02,
      },
    };
  }

  // 7. Depth attenuation (deeper elements are more subtle)
  if (depth > 0) {
    const attenuation = Math.pow(0.85, depth);
    result = {
      ...result,
      elevation: {
        ...result.elevation,
        shadowOpacity: result.elevation.shadowOpacity * attenuation,
        accentGlowOpacity: result.elevation.accentGlowOpacity * attenuation,
        hoverLift: result.elevation.hoverLift * attenuation,
      },
      surface: {
        ...result.surface,
        backgroundOpacity: result.surface.backgroundOpacity * attenuation,
        borderOpacity: result.surface.borderOpacity * attenuation,
      },
    };
  }

  return result;
}

/**
 * Convert presence tokens to CSS custom property declarations.
 * These are meant to be applied via style prop or CSS variables.
 *
 * @param tokens - Resolved presence tokens
 * @param prefix - CSS variable prefix (default: '--presence')
 * @returns Record of CSS variable names to values
 */
export function presenceToCSS(
  tokens: PresenceTokens,
  prefix = '--presence',
): Record<string, string> {
  return {
    // Elevation
    [`${prefix}-shadow-blur`]: `${tokens.elevation.shadowBlur}px`,
    [`${prefix}-shadow-spread`]: `${tokens.elevation.shadowSpread}px`,
    [`${prefix}-shadow-y`]: `${tokens.elevation.shadowY}px`,
    [`${prefix}-shadow-opacity`]: `${tokens.elevation.shadowOpacity}`,
    [`${prefix}-accent-glow`]: `${tokens.elevation.accentGlowOpacity}`,
    [`${prefix}-hover-lift`]: `${tokens.elevation.hoverLift}px`,

    // Surface
    [`${prefix}-bg-opacity`]: `${tokens.surface.backgroundOpacity}`,
    [`${prefix}-border-opacity`]: `${tokens.surface.borderOpacity}`,
    [`${prefix}-inner-highlight`]: `${tokens.surface.innerHighlightOpacity}`,
    [`${prefix}-backdrop-blur`]: `${tokens.surface.backdropBlur}px`,

    // Emphasis
    [`${prefix}-type-scale`]: `${tokens.emphasis.typographicScale}`,
    [`${prefix}-letter-spacing`]: `${tokens.emphasis.letterSpacingAdjust}em`,
    [`${prefix}-line-height`]: `${tokens.emphasis.lineHeightMultiplier}`,
    [`${prefix}-optical-margin`]: `${tokens.emphasis.opticalMarginLeft}em`,
    [`${prefix}-font-weight-delta`]: `${tokens.emphasis.fontWeightDelta}`,
    [`${prefix}-contrast`]: `${tokens.emphasis.contrastBoost}`,
  };
}

/**
 * Get a compact CSS string for presence tokens.
 * Useful for inline styles.
 */
export function presenceToCSSString(tokens: PresenceTokens, prefix = '--presence'): string {
  const cssVars = presenceToCSS(tokens, prefix);
  return Object.entries(cssVars)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}
