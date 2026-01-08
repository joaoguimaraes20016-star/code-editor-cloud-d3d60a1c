/**
 * Phase 28: Component Creation Helpers
 *
 * Pure functions that apply "taste" defaults at component creation time.
 * These helpers encode design intent without affecting existing documents.
 *
 * Invariants:
 * - Applied ONLY at creation time, never on paste/hydration/undo
 * - Never retroactively modifies existing nodes
 * - Pure functions with no side effects
 * - Personality-aware but no branching inside components
 *
 * Philosophy:
 * - New components should feel "pre-designed" and intentional
 * - Defaults vary subtly by layout personality
 * - Respects Framer/Perspective behavior patterns
 * - Removes need for manual wrapping/grouping
 */

import type { CanvasNode, LayoutPersonality } from '../types';
import {
  resolveLayoutPersonality,
  type ResolvedPersonality,
} from '../layout/personalityResolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context provided to intentDefaults function.
 */
export interface IntentDefaultsContext {
  /** The resolved layout personality for the current page */
  personality: LayoutPersonality;
  /** The resolved personality configuration with all tokens */
  resolved: ResolvedPersonality;
  /** The type of the parent node (if any) */
  parentType?: string;
  /** The types of adjacent siblings (before/after) */
  adjacentTypes?: {
    before?: string;
    after?: string;
  };
}

/**
 * Result from intentDefaults function.
 * Partial props that will be merged with defaultProps.
 */
export type IntentDefaultsResult = Partial<CanvasNode['props']>;

/**
 * Function signature for component intent defaults.
 */
export type IntentDefaultsFunction = (ctx: IntentDefaultsContext) => IntentDefaultsResult;

/**
 * Auto-structure directive returned from creation helpers.
 */
export interface AutoStructureDirective {
  /** Whether to wrap the node in a container */
  wrapInContainer?: boolean;
  /** Container props if wrapping */
  containerProps?: Record<string, unknown>;
  /** Whether to auto-group with adjacent nodes of same type */
  autoGroup?: boolean;
  /** Minimum spacing from adjacent blocks */
  ensureSpacing?: number;
}

/**
 * Complete creation result with node and optional structure directives.
 */
export interface ComponentCreationResult {
  /** The created node with applied defaults */
  node: CanvasNode;
  /** Optional structure directives for smart composition */
  structure?: AutoStructureDirective;
}

// ============================================================================
// PERSONALITY-AWARE DEFAULTS
// ============================================================================

/**
 * Get gap value based on personality for containers.
 */
export function getPersonalityGap(resolved: ResolvedPersonality): number {
  return resolved.spacing.contentGap;
}

/**
 * Get block gap for spacing between blocks.
 */
export function getPersonalityBlockGap(resolved: ResolvedPersonality): number {
  return resolved.spacing.blockGap;
}

/**
 * Get action gap for CTA spacing.
 */
export function getPersonalityActionGap(resolved: ResolvedPersonality): number {
  return resolved.spacing.actionGap;
}

/**
 * Get section gap for major sections.
 */
export function getPersonalitySectionGap(resolved: ResolvedPersonality): number {
  return resolved.spacing.sectionGap;
}

// ============================================================================
// COMPONENT-SPECIFIC INTENT DEFAULTS
// ============================================================================

/**
 * Container intent defaults.
 * Adjusts gap based on personality.
 */
export function containerIntentDefaults(ctx: IntentDefaultsContext): IntentDefaultsResult {
  const gap = getPersonalityGap(ctx.resolved);
  return { gap };
}

/**
 * Hero intent defaults.
 * Adjusts colors and padding based on personality.
 */
export function heroIntentDefaults(ctx: IntentDefaultsContext): IntentDefaultsResult {
  const { personality, resolved } = ctx;
  
  // Base hero colors by personality
  const bgColors: Record<LayoutPersonality, string> = {
    clean: '#1f2937',
    editorial: '#0f172a',
    bold: '#111827',
    dense: '#1e293b',
    conversion: '#18181b',
  };

  return {
    backgroundColor: bgColors[personality],
    // Hero padding inherits from personality
    paddingMultiplier: resolved.hero.paddingMultiplier,
  };
}

/**
 * Button (CTA) intent defaults.
 * Adjusts prominence based on personality.
 */
export function buttonIntentDefaults(ctx: IntentDefaultsContext): IntentDefaultsResult {
  // Button defaults adjust based on personality CTA emphasis
  // No visual changes needed for base props - CSS handles prominence
  return {};
}

/**
 * Text intent defaults.
 * Placeholder - text inherits from personality typography scale.
 */
export function textIntentDefaults(_ctx: IntentDefaultsContext): IntentDefaultsResult {
  // Text defaults are personality-neutral at prop level
  // Typography scale is handled via CSS variables
  return {};
}

// ============================================================================
// AUTO-STRUCTURE RULES
// ============================================================================

/**
 * Determine auto-structure directives for a component type.
 * These rules live in creation helpers, not UI.
 */
export function getAutoStructureDirective(
  type: string,
  ctx: IntentDefaultsContext,
): AutoStructureDirective | undefined {
  const { resolved, parentType, adjacentTypes } = ctx;

  switch (type) {
    case 'hero':
      // Hero components auto-wrap inner children in a container
      // if they don't have a container parent
      if (parentType !== 'container' && parentType !== 'hero') {
        return {
          wrapInContainer: true,
          containerProps: {
            gap: getPersonalityBlockGap(resolved),
          },
        };
      }
      return undefined;

    case 'button':
      // CTAs ensure spacing from adjacent blocks
      return {
        ensureSpacing: getPersonalityActionGap(resolved),
      };

    case 'text':
      // Text stacks can auto-group if sequential
      if (adjacentTypes?.before === 'text' || adjacentTypes?.after === 'text') {
        return {
          autoGroup: true,
        };
      }
      return undefined;

    default:
      return undefined;
  }
}

// ============================================================================
// MAIN CREATION HELPERS
// ============================================================================

/**
 * Intent defaults registry.
 * Maps component types to their intent defaults functions.
 */
const INTENT_DEFAULTS_REGISTRY: Record<string, IntentDefaultsFunction> = {
  container: containerIntentDefaults,
  hero: heroIntentDefaults,
  button: buttonIntentDefaults,
  text: textIntentDefaults,
};

/**
 * Apply intent defaults to a node's props.
 *
 * This function is ONLY called at creation time.
 * It should NEVER be called on paste, hydration, or undo/redo.
 *
 * @param type - The component type
 * @param baseProps - The base props from defaultProps
 * @param personality - The current page's layout personality
 * @param parentType - Optional parent node type
 * @returns Props with intent defaults applied
 */
export function applyIntentDefaults(
  type: string,
  baseProps: Record<string, unknown>,
  personality: LayoutPersonality = 'clean',
  parentType?: string,
  adjacentTypes?: { before?: string; after?: string },
): Record<string, unknown> {
  const intentFn = INTENT_DEFAULTS_REGISTRY[type];
  
  if (!intentFn) {
    return baseProps;
  }

  const resolved = resolveLayoutPersonality(personality);
  const ctx: IntentDefaultsContext = {
    personality,
    resolved,
    parentType,
    adjacentTypes,
  };

  const intentProps = intentFn(ctx);
  
  // Merge intent props over base props
  return {
    ...baseProps,
    ...intentProps,
  };
}

/**
 * Check if a component type has intent defaults.
 */
export function hasIntentDefaults(type: string): boolean {
  return type in INTENT_DEFAULTS_REGISTRY;
}

/**
 * Get auto-structure directive for a node being created.
 *
 * @param type - The component type
 * @param personality - The current page's layout personality
 * @param parentType - Optional parent node type
 * @param adjacentTypes - Optional adjacent sibling types
 * @returns Auto-structure directive or undefined
 */
export function getCreationStructureDirective(
  type: string,
  personality: LayoutPersonality = 'clean',
  parentType?: string,
  adjacentTypes?: { before?: string; after?: string },
): AutoStructureDirective | undefined {
  const resolved = resolveLayoutPersonality(personality);
  const ctx: IntentDefaultsContext = {
    personality,
    resolved,
    parentType,
    adjacentTypes,
  };

  return getAutoStructureDirective(type, ctx);
}

/**
 * Create a node with full intent defaults and structure awareness.
 *
 * This is the primary entry point for node creation with Phase 28 features.
 *
 * @param id - The node ID
 * @param type - The component type
 * @param baseProps - The base props from ComponentDefinition.defaultProps
 * @param personality - The current page's layout personality
 * @param parentType - Optional parent node type
 * @returns ComponentCreationResult with node and optional structure
 */
export function createNodeWithIntent(
  id: string,
  type: string,
  baseProps: Record<string, unknown>,
  personality: LayoutPersonality = 'clean',
  parentType?: string,
  adjacentTypes?: { before?: string; after?: string },
): ComponentCreationResult {
  const props = applyIntentDefaults(type, baseProps, personality, parentType, adjacentTypes);
  const structure = getCreationStructureDirective(type, personality, parentType, adjacentTypes);

  const node: CanvasNode = {
    id,
    type,
    props,
    children: [],
  };

  return {
    node,
    structure,
  };
}
