/**
 * Phase 27: Layout Personality Resolver
 *
 * A pure resolver that encodes design intent without hardcoding styles.
 * This module transforms a layout personality into structured tokens that
 * control spacing rhythm, typography scale, CTA emphasis, motion intensity,
 * and AI suggestion sensitivity.
 *
 * Philosophy:
 * - Personalities are opinionated but flexible taste layers
 * - No DOM access, no side effects - pure functions only
 * - CSS variable driven - no inline styles, no magic numbers
 * - Defaults feel composed, not empty
 *
 * Personalities:
 * - clean: Minimal, breathable, generous whitespace (default)
 * - editorial: Magazine-like, strong hierarchy, reading-focused
 * - bold: High impact, attention-grabbing, confident spacing
 * - dense: Information-rich, compact, efficient use of space
 * - conversion: CTA-focused, urgency-driven, action-optimized
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Available layout personality presets.
 */
export type LayoutPersonality = 'clean' | 'editorial' | 'bold' | 'dense' | 'conversion';

/**
 * Spacing rhythm tokens for vertical composition.
 */
export interface SpacingRhythmTokens {
  /** Gap between major sections/steps */
  sectionGap: number;
  /** Gap between content blocks */
  blockGap: number;
  /** Gap between inline content elements */
  contentGap: number;
  /** Gap around action elements (CTAs, buttons) */
  actionGap: number;
  /** Multiplier for overall rhythm (1.0 = baseline) */
  rhythmMultiplier: number;
}

/**
 * Typography scale tokens for hierarchy.
 */
export interface TypographyScaleTokens {
  /** Scale ratio for headlines (relative to base) */
  headlineScale: number;
  /** Scale ratio for body text */
  bodyScale: number;
  /** Line height multiplier for readability */
  lineHeightMultiplier: number;
  /** Letter spacing adjustment (em units) */
  letterSpacingAdjust: number;
}

/**
 * CTA (Call-to-Action) emphasis tokens.
 */
export interface CTAEmphasisTokens {
  /** Visual weight (boldness) of CTA elements */
  weight: number;
  /** Minimum breathing room around CTAs (px) */
  minGap: number;
  /** Scale factor for CTA prominence */
  prominenceScale: number;
}

/**
 * Hero section presence tokens.
 */
export interface HeroPresenceTokens {
  /** Padding multiplier for hero sections */
  paddingMultiplier: number;
  /** Emphasis factor for hero headlines */
  headlineEmphasis: number;
}

/**
 * Motion intensity tokens for animations.
 */
export interface MotionIntensityTokens {
  /** Duration multiplier (1.0 = normal speed) */
  durationMultiplier: number;
  /** Easing curve aggressiveness (0-1) */
  easingIntensity: number;
  /** Whether to enable staggered animations */
  staggerEnabled: boolean;
  /** Stagger delay between elements (ms) */
  staggerDelay: number;
}

/**
 * AI suggestion sensitivity tokens.
 */
export interface SuggestionSensitivityTokens {
  /** Threshold for spacing suggestions (lower = more sensitive) */
  spacingThreshold: number;
  /** Threshold for hierarchy suggestions */
  hierarchyThreshold: number;
  /** Threshold for CTA emphasis suggestions */
  ctaThreshold: number;
  /** Threshold for alignment suggestions */
  alignmentThreshold: number;
  /** Weight multiplier for CTA-related suggestions */
  ctaWeight: number;
}

/**
 * Complete resolved personality configuration.
 */
export interface ResolvedPersonality {
  personality: LayoutPersonality;
  spacing: SpacingRhythmTokens;
  typography: TypographyScaleTokens;
  cta: CTAEmphasisTokens;
  hero: HeroPresenceTokens;
  motion: MotionIntensityTokens;
  suggestions: SuggestionSensitivityTokens;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default personality when none is specified.
 */
export const DEFAULT_PERSONALITY: LayoutPersonality = 'clean';

/**
 * Base spacing values (pixels) - the foundation for all personalities.
 */
const BASE_SPACING: SpacingRhythmTokens = {
  sectionGap: 40,
  blockGap: 28,
  contentGap: 16,
  actionGap: 28,
  rhythmMultiplier: 1.0,
};

/**
 * Base typography values.
 */
const BASE_TYPOGRAPHY: TypographyScaleTokens = {
  headlineScale: 1.0,
  bodyScale: 1.0,
  lineHeightMultiplier: 1.5,
  letterSpacingAdjust: 0,
};

/**
 * Base CTA emphasis values.
 */
const BASE_CTA: CTAEmphasisTokens = {
  weight: 600,
  minGap: 24,
  prominenceScale: 1.0,
};

/**
 * Base hero presence values.
 */
const BASE_HERO: HeroPresenceTokens = {
  paddingMultiplier: 1.0,
  headlineEmphasis: 1.0,
};

/**
 * Base motion values.
 */
const BASE_MOTION: MotionIntensityTokens = {
  durationMultiplier: 1.0,
  easingIntensity: 0.5,
  staggerEnabled: true,
  staggerDelay: 50,
};

/**
 * Base suggestion sensitivity values.
 */
const BASE_SUGGESTIONS: SuggestionSensitivityTokens = {
  spacingThreshold: 0.25,
  hierarchyThreshold: 0.15,
  ctaThreshold: 0.20,
  alignmentThreshold: 0.30,
  ctaWeight: 1.0,
};

// ============================================================================
// PERSONALITY DEFINITIONS
// ============================================================================

/**
 * Clean personality: Minimal, breathable, generous whitespace.
 * The default - feels intentional without being opinionated.
 */
const CLEAN_OVERRIDES: Partial<ResolvedPersonality> = {
  spacing: {
    ...BASE_SPACING,
    sectionGap: 44,
    blockGap: 32,
    contentGap: 18,
    actionGap: 32,
    rhythmMultiplier: 1.05,
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    lineHeightMultiplier: 1.6,
  },
  motion: {
    ...BASE_MOTION,
    durationMultiplier: 1.1,
    easingIntensity: 0.4,
  },
};

/**
 * Editorial personality: Magazine-like, strong hierarchy, reading-focused.
 * Emphasizes content consumption and clear typographic hierarchy.
 */
const EDITORIAL_OVERRIDES: Partial<ResolvedPersonality> = {
  spacing: {
    ...BASE_SPACING,
    sectionGap: 56,
    blockGap: 36,
    contentGap: 20,
    actionGap: 28,
    rhythmMultiplier: 1.15,
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    headlineScale: 1.25,
    bodyScale: 1.05,
    lineHeightMultiplier: 1.7,
    letterSpacingAdjust: -0.01,
  },
  hero: {
    paddingMultiplier: 1.2,
    headlineEmphasis: 1.3,
  },
  motion: {
    ...BASE_MOTION,
    durationMultiplier: 1.2,
    easingIntensity: 0.35,
    staggerDelay: 80,
  },
  suggestions: {
    ...BASE_SUGGESTIONS,
    hierarchyThreshold: 0.10,
    spacingThreshold: 0.20,
  },
};

/**
 * Bold personality: High impact, attention-grabbing, confident spacing.
 * For pages that need to make a strong first impression.
 */
const BOLD_OVERRIDES: Partial<ResolvedPersonality> = {
  spacing: {
    ...BASE_SPACING,
    sectionGap: 48,
    blockGap: 32,
    contentGap: 16,
    actionGap: 36,
    rhythmMultiplier: 1.1,
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    headlineScale: 1.35,
    bodyScale: 1.0,
    lineHeightMultiplier: 1.45,
    letterSpacingAdjust: 0.02,
  },
  cta: {
    weight: 700,
    minGap: 28,
    prominenceScale: 1.15,
  },
  hero: {
    paddingMultiplier: 1.15,
    headlineEmphasis: 1.4,
  },
  motion: {
    ...BASE_MOTION,
    durationMultiplier: 0.9,
    easingIntensity: 0.65,
    staggerDelay: 40,
  },
};

/**
 * Dense personality: Information-rich, compact, efficient use of space.
 * For content-heavy pages where users expect to scan a lot of information.
 */
const DENSE_OVERRIDES: Partial<ResolvedPersonality> = {
  spacing: {
    ...BASE_SPACING,
    sectionGap: 28,
    blockGap: 20,
    contentGap: 12,
    actionGap: 20,
    rhythmMultiplier: 0.85,
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    headlineScale: 0.95,
    bodyScale: 0.95,
    lineHeightMultiplier: 1.4,
    letterSpacingAdjust: 0,
  },
  cta: {
    weight: 600,
    minGap: 16,
    prominenceScale: 0.95,
  },
  hero: {
    paddingMultiplier: 0.85,
    headlineEmphasis: 0.9,
  },
  motion: {
    ...BASE_MOTION,
    durationMultiplier: 0.8,
    easingIntensity: 0.55,
    staggerEnabled: false,
    staggerDelay: 30,
  },
  suggestions: {
    ...BASE_SUGGESTIONS,
    spacingThreshold: 0.35,
    hierarchyThreshold: 0.25,
    alignmentThreshold: 0.40,
  },
};

/**
 * Conversion personality: CTA-focused, urgency-driven, action-optimized.
 * For landing pages and funnels where the primary goal is user action.
 */
const CONVERSION_OVERRIDES: Partial<ResolvedPersonality> = {
  spacing: {
    ...BASE_SPACING,
    sectionGap: 36,
    blockGap: 24,
    contentGap: 14,
    actionGap: 36,
    rhythmMultiplier: 0.95,
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    headlineScale: 1.15,
    bodyScale: 1.0,
    lineHeightMultiplier: 1.5,
  },
  cta: {
    weight: 700,
    minGap: 32,
    prominenceScale: 1.25,
  },
  hero: {
    paddingMultiplier: 1.0,
    headlineEmphasis: 1.2,
  },
  motion: {
    ...BASE_MOTION,
    durationMultiplier: 0.85,
    easingIntensity: 0.6,
    staggerDelay: 35,
  },
  suggestions: {
    ...BASE_SUGGESTIONS,
    ctaThreshold: 0.10,
    ctaWeight: 1.5,
    spacingThreshold: 0.30,
  },
};

/**
 * Personality override lookup table.
 */
const PERSONALITY_OVERRIDES: Record<LayoutPersonality, Partial<ResolvedPersonality>> = {
  clean: CLEAN_OVERRIDES,
  editorial: EDITORIAL_OVERRIDES,
  bold: BOLD_OVERRIDES,
  dense: DENSE_OVERRIDES,
  conversion: CONVERSION_OVERRIDES,
};

// ============================================================================
// RESOLVER FUNCTIONS
// ============================================================================

/**
 * Resolve a layout personality into a complete configuration.
 *
 * This is a pure function with no side effects.
 * It merges personality-specific overrides with base values.
 *
 * @param personality - The layout personality to resolve
 * @returns Complete resolved personality configuration
 */
export function resolveLayoutPersonality(
  personality: LayoutPersonality = DEFAULT_PERSONALITY,
): ResolvedPersonality {
  const overrides = PERSONALITY_OVERRIDES[personality] ?? PERSONALITY_OVERRIDES.clean;

  return {
    personality,
    spacing: {
      ...BASE_SPACING,
      ...overrides.spacing,
    },
    typography: {
      ...BASE_TYPOGRAPHY,
      ...overrides.typography,
    },
    cta: {
      ...BASE_CTA,
      ...overrides.cta,
    },
    hero: {
      ...BASE_HERO,
      ...overrides.hero,
    },
    motion: {
      ...BASE_MOTION,
      ...overrides.motion,
    },
    suggestions: {
      ...BASE_SUGGESTIONS,
      ...overrides.suggestions,
    },
  };
}

/**
 * Check if a string is a valid layout personality.
 *
 * @param value - The value to check
 * @returns True if value is a valid LayoutPersonality
 */
export function isValidPersonality(value: unknown): value is LayoutPersonality {
  return (
    typeof value === 'string' &&
    ['clean', 'editorial', 'bold', 'dense', 'conversion'].includes(value)
  );
}

/**
 * Get display name for a personality (for UI).
 *
 * @param personality - The personality to get display name for
 * @returns Human-readable display name
 */
export function getPersonalityDisplayName(personality: LayoutPersonality): string {
  const names: Record<LayoutPersonality, string> = {
    clean: 'Clean',
    editorial: 'Editorial',
    bold: 'Bold',
    dense: 'Dense',
    conversion: 'Conversion',
  };
  return names[personality] ?? 'Clean';
}

/**
 * Get all available personalities for UI selection.
 *
 * @returns Array of personality options with value and label
 */
export function getPersonalityOptions(): Array<{ value: LayoutPersonality; label: string }> {
  return [
    { value: 'clean', label: 'Clean' },
    { value: 'editorial', label: 'Editorial' },
    { value: 'bold', label: 'Bold' },
    { value: 'dense', label: 'Dense' },
    { value: 'conversion', label: 'Conversion' },
  ];
}

// ============================================================================
// CSS VARIABLE GENERATION
// ============================================================================

/**
 * Generate CSS custom properties from a resolved personality.
 *
 * Phase 38: RULE_0 compliance — these variables are DECORATIVE ONLY.
 * They may control emphasis (opacity, scale ≤ 1.03, color) but NOT:
 * - Layout geometry
 * - Spacing units (use LOCKED values from layoutTokens.ts)
 * - Alignment rules
 * - Viewport framing
 *
 * @param resolved - The resolved personality configuration
 * @returns CSS custom properties object
 */
export function generatePersonalityVariables(
  resolved: ResolvedPersonality,
): Record<string, string> {
  const { typography, cta, hero, motion } = resolved;

  // Phase 38: Cap scale values to RULE_0 max of 1.03
  const clampScale = (scale: number) => Math.min(scale, 1.03);

  return {
    // Phase 38: Spacing rhythm vars DISABLED for geometry (RULE_0)
    // These are set to locked values; actual spacing comes from layoutTokens.ts
    '--builder-spacing-section': '64px',  // LOCKED
    '--builder-spacing-block': '24px',    // LOCKED
    '--builder-spacing-content': '12px',  // LOCKED
    '--builder-spacing-action': '32px',   // LOCKED
    '--builder-rhythm-multiplier': '1',   // LOCKED (no rhythm adjustment)

    // Typography scale — DECORATIVE (capped to RULE_0 max scale)
    '--builder-headline-scale': `${clampScale(typography.headlineScale)}`,
    '--builder-body-scale': `${clampScale(typography.bodyScale)}`,
    '--builder-line-height': `${typography.lineHeightMultiplier}`,
    '--builder-letter-spacing': `${typography.letterSpacingAdjust}em`,

    // CTA emphasis — DECORATIVE (prominence capped to RULE_0 max scale)
    '--builder-cta-weight': `${cta.weight}`,
    '--builder-cta-min-gap': '32px',      // LOCKED (use CTA_GAP from layoutTokens)
    '--builder-cta-prominence': `${clampScale(cta.prominenceScale)}`,

    // Hero presence — DECORATIVE (emphasis capped to RULE_0 max scale)
    '--builder-hero-padding': '1',        // LOCKED (no padding adjustment)
    '--builder-hero-emphasis': `${clampScale(hero.headlineEmphasis)}`,

    // Motion intensity — DECORATIVE (allowed per RULE_0)
    '--builder-motion-duration': `${motion.durationMultiplier}`,
    '--builder-motion-easing-intensity': `${motion.easingIntensity}`,
    '--builder-motion-stagger': motion.staggerEnabled ? `${motion.staggerDelay}ms` : '0ms',
  };
}

/**
 * Convenience function to resolve and generate variables in one call.
 *
 * @param personality - The layout personality to resolve
 * @returns CSS custom properties object
 */
export function getPersonalityVariables(
  personality: LayoutPersonality = DEFAULT_PERSONALITY,
): Record<string, string> {
  const resolved = resolveLayoutPersonality(personality);
  return generatePersonalityVariables(resolved);
}
