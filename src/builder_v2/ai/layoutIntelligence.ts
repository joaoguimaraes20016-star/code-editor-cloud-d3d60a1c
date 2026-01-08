/**
 * Layout Intelligence Module
 *
 * Pure heuristics-based layout analysis for Builder V2.
 *
 * Philosophy:
 * - AI should feel like taste, not a feature.
 * - If users notice "AI did this," we failed.
 * - If they think "this feels right," we succeeded.
 *
 * This module does not render anything. It only answers questions like:
 * - "Is this layout unbalanced?"
 * - "Is this CTA too close?"
 * - "Is the hierarchy unclear?"
 *
 * Phase 27: Now personality-aware. Suggestion thresholds and weights adapt
 * to the page's layout personality.
 * 
 * Phase 38: RULE_0 Compliance — Layout Intelligence may NOT produce suggestions
 * that change geometry, spacing, or alignment. Only decorative suggestions
 * (opacity, scale ≤ 1.03, color, visibility) are allowed.
 *
 * No external APIs. No LLM calls. Pure heuristics.
 */

import type { CanvasNode, LayoutPersonality, Page, StepIntent } from '../types';
import { resolveFunnelLayout, type FunnelLayoutMetrics } from '../layout/funnelLayout';
import {
  resolveLayoutPersonality,
  type SuggestionSensitivityTokens,
} from '../layout/personalityResolver';
import { RULE_0 } from '../layout/layoutTokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutSuggestionType =
  | 'spacing'
  | 'alignment'
  | 'hierarchy'
  | 'cta-emphasis'
  | 'readability';

export interface LayoutSuggestion {
  id: string;
  type: LayoutSuggestionType;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  message: string;
  affectedNodeIds: string[];
  recommendation: {
    /** Design token to adjust */
    token?: string;
    /** Numeric change to apply */
    delta?: number;
  };
}

export interface LayoutContext {
  page: Page;
  nodes: CanvasNode[];
  layoutIntent?: StepIntent;
  viewport: 'desktop' | 'mobile';
  /** Phase 27: Personality-aware suggestion sensitivity */
  sensitivity?: SuggestionSensitivityTokens;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum gap (in pixels) between a CTA and adjacent input elements.
 * Breathing room prevents visual crowding around action elements.
 */
const CTA_MIN_GAP = 24;

/**
 * Minimum ratio between headline and body text font sizes.
 * Headlines should be at least 1.15× body text for clear hierarchy.
 */
const HEADLINE_DOMINANCE_RATIO = 1.15;

/**
 * Maximum allowed variance in spacing between stacked nodes (as percentage).
 * Consistent rhythm creates visual harmony.
 */
const RHYTHM_VARIANCE_THRESHOLD = 0.25;

/**
 * Node types considered as CTA (Call-to-Action) elements.
 */
const CTA_TYPES = new Set(['button', 'cta', 'submit']);

/**
 * Node types considered as input elements.
 */
const INPUT_TYPES = new Set(['input', 'textarea', 'select', 'form-field']);

/**
 * Node types that represent text content with headline semantics.
 */
const HEADLINE_TYPES = new Set(['headline', 'heading', 'title', 'hero']);

/**
 * Node types that represent body text content.
 */
const BODY_TEXT_TYPES = new Set(['text', 'paragraph', 'body', 'content']);

// ---------------------------------------------------------------------------
// Node Traversal Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a node tree into a depth-first array of nodes.
 */
function flattenNodes(node: CanvasNode): CanvasNode[] {
  const result: CanvasNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}

/**
 * Get direct children indices and their types for layout analysis.
 */
function analyzeNodeSequence(children: CanvasNode[]): Array<{
  node: CanvasNode;
  index: number;
  isCTA: boolean;
  isInput: boolean;
  isHeadline: boolean;
  isBodyText: boolean;
}> {
  return children.map((node, index) => ({
    node,
    index,
    isCTA: CTA_TYPES.has(node.type) || (node.props.variant === 'primary' && CTA_TYPES.has(node.type)),
    isInput: INPUT_TYPES.has(node.type),
    isHeadline: HEADLINE_TYPES.has(node.type) || node.props.variant === 'headline',
    isBodyText: BODY_TEXT_TYPES.has(node.type),
  }));
}

/**
 * Extract numeric value from props, defaulting to a fallback.
 */
function getNumericProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

/**
 * Generate a unique suggestion ID.
 */
let suggestionCounter = 0;
function generateSuggestionId(type: LayoutSuggestionType): string {
  suggestionCounter += 1;
  return `${type}-${suggestionCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Heuristic A: CTA Breathing Room
// ---------------------------------------------------------------------------

/**
 * If a primary CTA is closer than CTA_MIN_GAP to input elements,
 * suggest spacing increase.
 */
function analyzeCTABreathingRoom(
  context: LayoutContext,
  layout: FunnelLayoutMetrics,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];
  const { page } = context;

  function analyzeContainer(container: CanvasNode): void {
    const sequence = analyzeNodeSequence(container.children);
    const containerGap = getNumericProp(container.props, 'gap', layout.spacing.actionGap);

    for (let i = 0; i < sequence.length; i++) {
      const current = sequence[i];
      if (!current.isCTA) continue;

      // Check previous sibling
      if (i > 0) {
        const prev = sequence[i - 1];
        if (prev.isInput && containerGap < CTA_MIN_GAP) {
          suggestions.push({
            id: generateSuggestionId('cta-emphasis'),
            type: 'cta-emphasis',
            confidence: 0.75,
            message: 'Action button could use more breathing room from form fields.',
            affectedNodeIds: [current.node.id, prev.node.id],
            recommendation: {
              token: '--layout-cta-min-gap',
              delta: CTA_MIN_GAP - containerGap,
            },
          });
        }
      }

      // Check next sibling
      if (i < sequence.length - 1) {
        const next = sequence[i + 1];
        if (next.isInput && containerGap < CTA_MIN_GAP) {
          suggestions.push({
            id: generateSuggestionId('cta-emphasis'),
            type: 'cta-emphasis',
            confidence: 0.7,
            message: 'Consider adding space after the action button.',
            affectedNodeIds: [current.node.id, next.node.id],
            recommendation: {
              token: '--layout-cta-min-gap',
              delta: CTA_MIN_GAP - containerGap,
            },
          });
        }
      }
    }

    // Recurse into children
    for (const child of container.children) {
      if (child.children.length > 0) {
        analyzeContainer(child);
      }
    }
  }

  analyzeContainer(page.canvasRoot);
  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic B: Headline Dominance
// ---------------------------------------------------------------------------

/**
 * If headline font size ≤ body text × 1.15, suggest hierarchy adjustment.
 */
function analyzeHeadlineDominance(
  context: LayoutContext,
  _layout: FunnelLayoutMetrics,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];
  const nodes = flattenNodes(context.page.canvasRoot);

  // Find headline and body text nodes
  const headlineNodes = nodes.filter(
    (n) => HEADLINE_TYPES.has(n.type) || n.props.variant === 'headline'
  );
  const bodyNodes = nodes.filter((n) => BODY_TEXT_TYPES.has(n.type));

  if (headlineNodes.length === 0 || bodyNodes.length === 0) {
    return suggestions;
  }

  // Default font sizes (in pixels) - these represent typical defaults
  const DEFAULT_HEADLINE_SIZE = 32;
  const DEFAULT_BODY_SIZE = 16;

  for (const headline of headlineNodes) {
    const headlineSize = getNumericProp(headline.props, 'fontSize', DEFAULT_HEADLINE_SIZE);

    for (const body of bodyNodes) {
      const bodySize = getNumericProp(body.props, 'fontSize', DEFAULT_BODY_SIZE);
      const ratio = headlineSize / bodySize;

      if (ratio < HEADLINE_DOMINANCE_RATIO) {
        suggestions.push({
          id: generateSuggestionId('hierarchy'),
          type: 'hierarchy',
          confidence: 0.8,
          message: 'Headline could be more prominent relative to body text.',
          affectedNodeIds: [headline.id, body.id],
          recommendation: {
            token: '--headline-font-size',
            delta: Math.ceil(bodySize * HEADLINE_DOMINANCE_RATIO - headlineSize),
          },
        });
      }
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic C: Vertical Rhythm Break
// ---------------------------------------------------------------------------

/**
 * Detect inconsistent spacing deltas between stacked nodes.
 */
function analyzeVerticalRhythm(
  context: LayoutContext,
  layout: FunnelLayoutMetrics,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];

  function analyzeContainer(container: CanvasNode): void {
    if (container.children.length < 3) {
      // Need at least 3 children to detect rhythm breaks
      for (const child of container.children) {
        analyzeContainer(child);
      }
      return;
    }

    const gaps: number[] = [];
    const containerGap = getNumericProp(container.props, 'gap', layout.spacing.blockGap);

    // For simplicity, assume uniform gap from container.
    // In real implementation, this could analyze computed styles.
    for (let i = 0; i < container.children.length - 1; i++) {
      const current = container.children[i];
      const next = container.children[i + 1];

      // Check if either node has custom margin/padding that breaks rhythm
      const currentMargin = getNumericProp(current.props, 'marginBottom', 0);
      const nextMargin = getNumericProp(next.props, 'marginTop', 0);
      const effectiveGap = containerGap + currentMargin + nextMargin;

      gaps.push(effectiveGap);
    }

    if (gaps.length < 2) {
      for (const child of container.children) {
        analyzeContainer(child);
      }
      return;
    }

    // Calculate variance
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((acc, gap) => acc + Math.abs(gap - avgGap), 0) / gaps.length;
    const varianceRatio = avgGap > 0 ? variance / avgGap : 0;

    if (varianceRatio > RHYTHM_VARIANCE_THRESHOLD) {
      // Find the nodes with the most deviant gaps
      const deviations = gaps.map((gap, idx) => ({
        idx,
        deviation: Math.abs(gap - avgGap),
      }));
      deviations.sort((a, b) => b.deviation - a.deviation);

      const worstIdx = deviations[0].idx;
      const affectedIds = [
        container.children[worstIdx].id,
        container.children[worstIdx + 1].id,
      ];

      suggestions.push({
        id: generateSuggestionId('spacing'),
        type: 'spacing',
        confidence: 0.65,
        message: 'Vertical spacing feels inconsistent between elements.',
        affectedNodeIds: affectedIds,
        recommendation: {
          token: '--block-gap',
          delta: Math.round(avgGap - gaps[worstIdx]),
        },
      });
    }

    // Recurse
    for (const child of container.children) {
      analyzeContainer(child);
    }
  }

  analyzeContainer(context.page.canvasRoot);
  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic D: Single-Column Centering
// ---------------------------------------------------------------------------

/**
 * If opt-in intent + multi-column detected, suggest centering.
 */
function analyzeSingleColumnCentering(
  context: LayoutContext,
  layout: FunnelLayoutMetrics,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];

  // Only applies to opt-in intent
  if (layout.intent !== 'optin') {
    return suggestions;
  }

  function detectMultiColumn(node: CanvasNode): boolean {
    const direction = node.props.direction ?? node.props.flexDirection ?? 'column';
    const isRow = direction === 'row' || direction === 'row-reverse';

    if (isRow && node.children.length > 1) {
      return true;
    }

    return node.children.some(detectMultiColumn);
  }

  function findMultiColumnContainers(node: CanvasNode): CanvasNode[] {
    const results: CanvasNode[] = [];
    const direction = node.props.direction ?? node.props.flexDirection ?? 'column';
    const isRow = direction === 'row' || direction === 'row-reverse';

    if (isRow && node.children.length > 1) {
      results.push(node);
    }

    for (const child of node.children) {
      results.push(...findMultiColumnContainers(child));
    }

    return results;
  }

  const multiColumnContainers = findMultiColumnContainers(context.page.canvasRoot);

  if (multiColumnContainers.length > 0) {
    suggestions.push({
      id: generateSuggestionId('alignment'),
      type: 'alignment',
      confidence: 0.7,
      message: 'Opt-in pages typically work better with a single centered column.',
      affectedNodeIds: multiColumnContainers.map((n) => n.id),
      recommendation: {
        token: '--layout-columns',
        delta: 1 - multiColumnContainers.length,
      },
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic E: Visual Weight Imbalance
// ---------------------------------------------------------------------------

/**
 * If bottom-heavy layout, suggest upward redistribution.
 *
 * Weight is estimated by:
 * - Number of nodes
 * - Presence of heavy elements (images, heroes, CTAs)
 */
function analyzeVisualWeightBalance(
  context: LayoutContext,
  _layout: FunnelLayoutMetrics,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];
  const root = context.page.canvasRoot;

  if (root.children.length < 2) {
    return suggestions;
  }

  // Split children into top and bottom halves
  const midpoint = Math.ceil(root.children.length / 2);
  const topHalf = root.children.slice(0, midpoint);
  const bottomHalf = root.children.slice(midpoint);

  // Heavy element types that add visual weight
  const HEAVY_TYPES = new Set(['hero', 'image', 'video', 'card', 'button', 'cta']);

  function calculateWeight(nodes: CanvasNode[]): number {
    let weight = 0;
    for (const node of nodes) {
      // Base weight per node
      weight += 1;

      // Additional weight for heavy elements
      if (HEAVY_TYPES.has(node.type)) {
        weight += 2;
      }

      // Recursive weight from children
      weight += calculateWeight(node.children) * 0.5;
    }
    return weight;
  }

  const topWeight = calculateWeight(topHalf);
  const bottomWeight = calculateWeight(bottomHalf);
  const totalWeight = topWeight + bottomWeight;

  if (totalWeight === 0) {
    return suggestions;
  }

  const bottomRatio = bottomWeight / totalWeight;

  // If bottom is significantly heavier (>65%), suggest rebalancing
  if (bottomRatio > 0.65) {
    const heavyBottomNodes = bottomHalf
      .filter((n) => HEAVY_TYPES.has(n.type))
      .map((n) => n.id);

    suggestions.push({
      id: generateSuggestionId('alignment'),
      type: 'alignment',
      confidence: 0.6,
      message: 'Layout feels bottom-heavy. Consider moving key elements higher.',
      affectedNodeIds:
        heavyBottomNodes.length > 0 ? heavyBottomNodes : [bottomHalf[0]?.id].filter(Boolean),
      recommendation: {
        token: '--visual-balance',
        delta: Math.round((bottomRatio - 0.5) * 100),
      },
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Analyze a page layout and return intelligent suggestions.
 *
 * This is the main entry point for layout intelligence.
 * Returns suggestions that are:
 * - Non-intrusive
 * - Tasteful
 * - Never auto-applied
 *
 * Phase 27: Now personality-aware. Suggestions are weighted and filtered
 * based on the page's layout personality.
 * 
 * Phase 38: RULE_0 Compliance — Suggestions that would change geometry,
 * spacing, or alignment are filtered out. Only decorative suggestions
 * remain (opacity, scale ≤ 1.03, color, visibility).
 */
export function analyzeLayout(context: LayoutContext): LayoutSuggestion[] {
  // Phase 38: If RULE_0 disallows spacing/alignment/geometry, return empty
  // This is the "big switch" that disables layout intelligence geometry changes
  if (!RULE_0.ALLOW_SPACING && !RULE_0.ALLOW_ALIGNMENT && !RULE_0.ALLOW_GEOMETRY) {
    // Phase 38: Return only suggestions that don't affect geometry
    // For now, return empty — all current heuristics affect geometry
    return [];
  }
  
  const layout = resolveFunnelLayout(context.page);
  const sensitivity = context.sensitivity ?? layout.personality.suggestions;
  const allSuggestions: LayoutSuggestion[] = [];

  // Run all heuristics
  allSuggestions.push(...analyzeCTABreathingRoom(context, layout));
  allSuggestions.push(...analyzeHeadlineDominance(context, layout));
  allSuggestions.push(...analyzeVerticalRhythm(context, layout));
  allSuggestions.push(...analyzeSingleColumnCentering(context, layout));
  allSuggestions.push(...analyzeVisualWeightBalance(context, layout));

  // Phase 27: Apply personality-aware confidence adjustments
  const adjustedSuggestions = allSuggestions.map((suggestion) => {
    let adjustedConfidence = suggestion.confidence;

    // Apply personality-specific thresholds and weights
    switch (suggestion.type) {
      case 'spacing':
        // Dense layouts are more tolerant of tight spacing
        if (adjustedConfidence < sensitivity.spacingThreshold) {
          return null; // Filter out below-threshold suggestions
        }
        break;
      case 'hierarchy':
        if (adjustedConfidence < sensitivity.hierarchyThreshold) {
          return null;
        }
        break;
      case 'cta-emphasis':
        // Conversion layouts amplify CTA suggestions
        adjustedConfidence *= sensitivity.ctaWeight;
        if (suggestion.confidence < sensitivity.ctaThreshold) {
          return null;
        }
        break;
      case 'alignment':
        if (adjustedConfidence < sensitivity.alignmentThreshold) {
          return null;
        }
        break;
    }

    return {
      ...suggestion,
      confidence: Math.min(1.0, adjustedConfidence),
    };
  }).filter((s): s is LayoutSuggestion => s !== null);

  // Sort by confidence (highest first)
  adjustedSuggestions.sort((a, b) => b.confidence - a.confidence);

  // Deduplicate by affected nodes (keep highest confidence)
  const seen = new Set<string>();
  const deduped: LayoutSuggestion[] = [];

  for (const suggestion of adjustedSuggestions) {
    const key = suggestion.affectedNodeIds.sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(suggestion);
    }
  }

  return deduped;
}

/**
 * Create a layout context from editor state.
 * Convenience function for integration with editor store.
 *
 * Phase 27: Now includes personality-aware sensitivity tokens.
 */
export function createLayoutContext(
  page: Page,
  viewport: 'desktop' | 'mobile' = 'desktop',
): LayoutContext {
  const personality = resolveLayoutPersonality(page.layoutPersonality);
  
  return {
    page,
    nodes: flattenNodes(page.canvasRoot),
    layoutIntent: page.layoutIntent,
    viewport,
    sensitivity: personality.suggestions,
  };
}

/**
 * Check if suggestions should be recomputed.
 * Returns true for meaningful edits that could affect layout.
 */
export function shouldRecomputeSuggestions(actionType: string): boolean {
  const meaningfulActions = new Set([
    'ADD_NODE',
    'DELETE_NODE',
    'COMMIT_NODE_PROPS',
    'UPDATE_PAGE_PROPS',
    'MOVE_NODE_UP',
    'MOVE_NODE_DOWN',
    'MOVE_NODE_TO_PARENT',
    'HYDRATE_FROM_STORAGE',
  ]);

  return meaningfulActions.has(actionType);
}
