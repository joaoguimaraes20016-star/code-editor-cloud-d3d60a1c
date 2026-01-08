/**
 * Phase 34: Component Presence
 *
 * Maps component types to presence categories and provides utilities
 * for resolving presence in rendering contexts.
 *
 * This module bridges the abstract presence resolver with concrete
 * component definitions. It does NOT modify props or store state.
 *
 * Philosophy:
 * - Presence is resolved at render time, not stored
 * - Components declare their category, not their presence
 * - Rendering applies presence via CSS variables
 * - No inspector controls, no user-facing settings
 *
 * Runtime/editor parity: Same presence resolution in both contexts.
 */

import type { LayoutPersonality, StepIntent } from '../types';
import {
  resolvePresence,
  presenceToCSS,
  type ComponentCategory,
  type PresenceContext,
  type PresenceTokens,
} from './presenceResolver';

// ============================================================================
// COMPONENT TYPE MAPPING
// ============================================================================

/**
 * Map component types to presence categories.
 * Unknown types default to 'body'.
 */
const COMPONENT_CATEGORY_MAP: Record<string, ComponentCategory> = {
  // Headings
  heading: 'heading',
  headline: 'heading',
  title: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',

  // Body text
  text: 'body',
  paragraph: 'body',
  body: 'body',
  content: 'body',

  // Inputs
  input: 'input',
  textarea: 'input',
  select: 'input',
  'form-field': 'input',
  form: 'input',
  'form-group': 'input',

  // Buttons/CTAs
  button: 'button',
  cta: 'button',
  submit: 'button',
  'link-button': 'button',

  // Sections
  section: 'section',
  'content-block': 'section',
  'feature-section': 'section',

  // Containers
  container: 'container',
  stack: 'container',
  row: 'container',
  column: 'container',
  group: 'container',
  card: 'container',

  // Hero
  hero: 'hero',
};

/**
 * Component types that should be treated as primary/hero elements
 * when they appear first in their container.
 */
const PRIMARY_TYPES = new Set(['hero', 'heading', 'headline', 'h1']);

/**
 * Component types that are action-oriented (CTAs).
 */
const ACTION_TYPES = new Set(['button', 'cta', 'submit', 'link-button']);

// ============================================================================
// CATEGORY RESOLUTION
// ============================================================================

/**
 * Get the presence category for a component type.
 *
 * @param componentType - The component's type string
 * @returns The presence category
 */
export function getComponentCategory(componentType: string): ComponentCategory {
  return COMPONENT_CATEGORY_MAP[componentType] ?? 'body';
}

/**
 * Check if a component type is a primary/hero element.
 */
export function isPrimaryType(componentType: string): boolean {
  return PRIMARY_TYPES.has(componentType);
}

/**
 * Check if a component type is action-oriented.
 */
export function isActionType(componentType: string): boolean {
  return ACTION_TYPES.has(componentType);
}

// ============================================================================
// PRESENCE RESOLUTION FOR COMPONENTS
// ============================================================================

/**
 * Context for resolving component presence.
 */
export interface ComponentPresenceContext {
  /** Component type string */
  componentType: string;
  /** Layout personality (from page) */
  personality: LayoutPersonality;
  /** Step intent (from page) */
  intent: StepIntent;
  /** Whether this is the first child in its container */
  isFirstChild?: boolean;
  /** Nesting depth (0 = root level) */
  depth?: number;
  /** Optional variant from props (e.g., 'primary', 'secondary') */
  variant?: string;
}

/**
 * Resolve presence tokens for a component.
 *
 * @param context - Component presence context
 * @returns Resolved presence tokens
 */
export function resolveComponentPresence(
  context: ComponentPresenceContext
): PresenceTokens {
  const {
    componentType,
    personality,
    intent,
    isFirstChild = false,
    depth = 0,
    variant,
  } = context;

  const category = getComponentCategory(componentType);

  // Determine if this should be treated as primary
  // Primary if: explicitly a primary type, or first child of a primary type, or variant is 'primary'
  const isPrimary =
    isPrimaryType(componentType) ||
    (isFirstChild && category === 'heading') ||
    variant === 'primary';

  const presenceContext: PresenceContext = {
    category,
    personality,
    intent,
    isPrimary,
    depth,
  };

  return resolvePresence(presenceContext);
}

/**
 * Get CSS variables for component presence.
 * Returns a style object that can be spread onto a component.
 *
 * @param context - Component presence context
 * @returns CSS custom properties object
 */
export function getComponentPresenceStyles(
  context: ComponentPresenceContext
): Record<string, string> {
  const tokens = resolveComponentPresence(context);
  return presenceToCSS(tokens);
}

// ============================================================================
// RENDER-TIME UTILITIES
// ============================================================================

/**
 * Create a presence style object for a component at render time.
 * This is the primary API for applying presence in components.
 *
 * @param componentType - The component's type
 * @param personality - Layout personality from page context
 * @param intent - Step intent from page context
 * @param options - Additional options (depth, isFirstChild, variant)
 * @returns Style object with CSS custom properties
 */
export function createPresenceStyle(
  componentType: string,
  personality: LayoutPersonality,
  intent: StepIntent,
  options: {
    depth?: number;
    isFirstChild?: boolean;
    variant?: string;
  } = {}
): React.CSSProperties {
  const cssVars = getComponentPresenceStyles({
    componentType,
    personality,
    intent,
    ...options,
  });

  // Convert to React CSSProperties format
  return cssVars as unknown as React.CSSProperties;
}

/**
 * Merge presence styles with existing component styles.
 * Presence styles are applied first, allowing explicit styles to override.
 *
 * @param presenceStyle - Presence CSS variables
 * @param componentStyle - Explicit component styles
 * @returns Merged style object
 */
export function mergePresenceWithStyle(
  presenceStyle: React.CSSProperties,
  componentStyle?: React.CSSProperties
): React.CSSProperties {
  if (!componentStyle) {
    return presenceStyle;
  }
  return { ...presenceStyle, ...componentStyle };
}

// ============================================================================
// CATEGORY-SPECIFIC HELPERS
// ============================================================================

/**
 * Get heading-specific presence adjustments.
 * Adds optical corrections for different heading levels.
 */
export function getHeadingPresence(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  personality: LayoutPersonality,
  intent: StepIntent
): React.CSSProperties {
  const basePresence = createPresenceStyle(`h${level}`, personality, intent, {
    isFirstChild: level === 1,
  });

  // Level-based scale adjustments
  const levelScale: Record<number, number> = {
    1: 1.0,
    2: 0.85,
    3: 0.72,
    4: 0.62,
    5: 0.54,
    6: 0.48,
  };

  const scale = levelScale[level] ?? 0.48;

  return {
    ...basePresence,
    '--presence-type-scale': `${scale}`,
    '--presence-optical-margin': `${-0.03 * scale}em`,
  } as React.CSSProperties;
}

/**
 * Get input-specific presence with focus state consideration.
 */
export function getInputPresence(
  personality: LayoutPersonality,
  intent: StepIntent,
  isFocused = false
): React.CSSProperties {
  const basePresence = createPresenceStyle('input', personality, intent);

  if (isFocused) {
    return {
      ...basePresence,
      '--presence-accent-glow': '0.15',
      '--presence-border-opacity': '0.25',
    } as React.CSSProperties;
  }

  return basePresence;
}

/**
 * Get button-specific presence with variant consideration.
 */
export function getButtonPresence(
  personality: LayoutPersonality,
  intent: StepIntent,
  variant: 'primary' | 'secondary' | 'ghost' = 'primary'
): React.CSSProperties {
  const basePresence = createPresenceStyle('button', personality, intent, {
    variant,
  });

  // Variant adjustments
  if (variant === 'secondary') {
    return {
      ...basePresence,
      '--presence-shadow-opacity': '0.08',
      '--presence-accent-glow': '0.1',
      '--presence-bg-opacity': '0.1',
    } as React.CSSProperties;
  }

  if (variant === 'ghost') {
    return {
      ...basePresence,
      '--presence-shadow-opacity': '0',
      '--presence-accent-glow': '0.05',
      '--presence-bg-opacity': '0',
      '--presence-border-opacity': '0.1',
    } as React.CSSProperties;
  }

  return basePresence;
}

/**
 * Get section-specific presence for rhythm and separation.
 */
export function getSectionPresence(
  personality: LayoutPersonality,
  intent: StepIntent,
  isHero = false
): React.CSSProperties {
  const componentType = isHero ? 'hero' : 'section';
  return createPresenceStyle(componentType, personality, intent);
}
