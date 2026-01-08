/**
 * Suggestion Apply Handlers
 *
 * Phase 26 — Suggestion Surfacing & One-Click Taste
 *
 * This module provides handlers to apply layout suggestions.
 * Each handler makes minimal, reversible changes using existing tokens.
 *
 * Design Philosophy:
 * - Suggestions should feel rare, accurate, and respectful
 * - The system should feel like a senior designer offering help
 * - Calm > clever
 * - Taste > automation
 */

import type { CanvasNode, Page } from '../types';
import type { LayoutSuggestion } from './layoutIntelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplyResult {
  success: boolean;
  /** Node IDs that were modified */
  modifiedNodeIds: string[];
  /** Props changes to apply (nodeId -> partialProps) */
  propsChanges: Map<string, Record<string, unknown>>;
  /** Human-readable description of what was applied */
  description: string;
}

// ---------------------------------------------------------------------------
// Node Helpers
// ---------------------------------------------------------------------------

/**
 * Find a node by ID in the tree.
 */
function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) {
    return node;
  }
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Find the parent of a node.
 */
function findParentNode(root: CanvasNode, targetId: string): CanvasNode | null {
  for (const child of root.children) {
    if (child.id === targetId) {
      return root;
    }
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Get numeric prop value with fallback.
 */
function getNumericProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Apply Handlers by Suggestion Type
// ---------------------------------------------------------------------------

/**
 * Apply spacing suggestion - adjusts gap between elements.
 */
function applySpacingSuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  const { affectedNodeIds, recommendation } = suggestion;
  const propsChanges = new Map<string, Record<string, unknown>>();

  if (affectedNodeIds.length < 2 || !recommendation.delta) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Unable to determine spacing adjustment.',
    };
  }

  // Find common parent of affected nodes
  const firstNode = findNodeById(page.canvasRoot, affectedNodeIds[0]);
  if (!firstNode) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Affected node not found.',
    };
  }

  const parent = findParentNode(page.canvasRoot, affectedNodeIds[0]);
  if (!parent) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Parent container not found.',
    };
  }

  // Adjust the parent's gap
  const currentGap = getNumericProp(parent.props, 'gap', 12);
  const newGap = Math.max(8, currentGap + recommendation.delta);

  propsChanges.set(parent.id, { gap: newGap });

  return {
    success: true,
    modifiedNodeIds: [parent.id],
    propsChanges,
    description: `Adjusted spacing to ${newGap}px.`,
  };
}

/**
 * Apply CTA emphasis suggestion - increases breathing room around CTAs.
 */
function applyCTAEmphasisSuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  const { affectedNodeIds, recommendation } = suggestion;
  const propsChanges = new Map<string, Record<string, unknown>>();

  if (affectedNodeIds.length === 0) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'No affected elements found.',
    };
  }

  // Find the parent container of the CTA
  const parent = findParentNode(page.canvasRoot, affectedNodeIds[0]);
  if (!parent) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Parent container not found.',
    };
  }

  // Increase gap to provide breathing room
  const currentGap = getNumericProp(parent.props, 'gap', 12);
  const delta = recommendation.delta ?? 8;
  const newGap = Math.max(16, currentGap + delta);

  propsChanges.set(parent.id, { gap: newGap });

  return {
    success: true,
    modifiedNodeIds: [parent.id, ...affectedNodeIds],
    propsChanges,
    description: `Added breathing room around action button.`,
  };
}

/**
 * Apply hierarchy suggestion - adjusts font sizes for better visual hierarchy.
 */
function applyHierarchySuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  const { affectedNodeIds, recommendation } = suggestion;
  const propsChanges = new Map<string, Record<string, unknown>>();

  if (affectedNodeIds.length === 0 || !recommendation.delta) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Unable to determine hierarchy adjustment.',
    };
  }

  // The first affected node should be the headline
  const headlineId = affectedNodeIds[0];
  const headlineNode = findNodeById(page.canvasRoot, headlineId);

  if (!headlineNode) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'Headline element not found.',
    };
  }

  // Increase headline font size
  const currentSize = getNumericProp(headlineNode.props, 'fontSize', 24);
  const newSize = currentSize + recommendation.delta;

  propsChanges.set(headlineId, { fontSize: newSize });

  return {
    success: true,
    modifiedNodeIds: [headlineId],
    propsChanges,
    description: `Increased headline prominence.`,
  };
}

/**
 * Apply alignment suggestion - adjusts layout direction or alignment.
 */
function applyAlignmentSuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  const { affectedNodeIds, recommendation } = suggestion;
  const propsChanges = new Map<string, Record<string, unknown>>();

  if (affectedNodeIds.length === 0) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'No elements to align.',
    };
  }

  // Check if this is a single-column centering suggestion
  const isCenteringSuggestion = recommendation.token === '--layout-columns';

  if (isCenteringSuggestion) {
    // Change multi-column containers to single column
    for (const nodeId of affectedNodeIds) {
      const node = findNodeById(page.canvasRoot, nodeId);
      if (node) {
        propsChanges.set(nodeId, {
          direction: 'column',
          alignItems: 'center',
        });
      }
    }

    return {
      success: propsChanges.size > 0,
      modifiedNodeIds: affectedNodeIds,
      propsChanges,
      description: `Centered layout for better focus.`,
    };
  }

  // Visual weight rebalancing - move heavier elements up
  // This is a more complex operation, so we'll just adjust the first container
  const firstNodeId = affectedNodeIds[0];
  const parent = findParentNode(page.canvasRoot, firstNodeId);

  if (parent) {
    // Add slight negative margin to lift content visually
    propsChanges.set(parent.id, {
      paddingTop: getNumericProp(parent.props, 'paddingTop', 0) + 8,
    });

    return {
      success: true,
      modifiedNodeIds: [parent.id],
      propsChanges,
      description: `Adjusted visual balance.`,
    };
  }

  return {
    success: false,
    modifiedNodeIds: [],
    propsChanges,
    description: 'Unable to adjust alignment.',
  };
}

/**
 * Apply readability suggestion - adjusts typography for better readability.
 */
function applyReadabilitySuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  const { affectedNodeIds, recommendation } = suggestion;
  const propsChanges = new Map<string, Record<string, unknown>>();

  if (affectedNodeIds.length === 0) {
    return {
      success: false,
      modifiedNodeIds: [],
      propsChanges,
      description: 'No elements to adjust.',
    };
  }

  // Adjust line height or letter spacing for better readability
  for (const nodeId of affectedNodeIds) {
    const node = findNodeById(page.canvasRoot, nodeId);
    if (node) {
      const currentLineHeight = getNumericProp(node.props, 'lineHeight', 1.5);
      propsChanges.set(nodeId, {
        lineHeight: Math.min(2, currentLineHeight + 0.1),
      });
    }
  }

  return {
    success: propsChanges.size > 0,
    modifiedNodeIds: affectedNodeIds,
    propsChanges,
    description: `Improved text readability.`,
  };
}

// ---------------------------------------------------------------------------
// Main Apply Function
// ---------------------------------------------------------------------------

/**
 * Apply a layout suggestion to the page.
 * Returns changes that should be dispatched through the editor store.
 */
export function applySuggestion(
  page: Page,
  suggestion: LayoutSuggestion,
): ApplyResult {
  switch (suggestion.type) {
    case 'spacing':
      return applySpacingSuggestion(page, suggestion);
    case 'cta-emphasis':
      return applyCTAEmphasisSuggestion(page, suggestion);
    case 'hierarchy':
      return applyHierarchySuggestion(page, suggestion);
    case 'alignment':
      return applyAlignmentSuggestion(page, suggestion);
    case 'readability':
      return applyReadabilitySuggestion(page, suggestion);
    default:
      return {
        success: false,
        modifiedNodeIds: [],
        propsChanges: new Map(),
        description: 'Unknown suggestion type.',
      };
  }
}

/**
 * Get a human-readable label for a suggestion type.
 * Uses calm, design-oriented language - no AI/warning terminology.
 */
export function getSuggestionTypeLabel(type: LayoutSuggestion['type']): string {
  const labels: Record<LayoutSuggestion['type'], string> = {
    spacing: 'Spacing',
    alignment: 'Balance',
    hierarchy: 'Hierarchy',
    'cta-emphasis': 'Emphasis',
    readability: 'Readability',
  };
  return labels[type] ?? 'Layout';
}

/**
 * Get an icon hint for suggestion type (for future icon use).
 */
export function getSuggestionIcon(type: LayoutSuggestion['type']): string {
  const icons: Record<LayoutSuggestion['type'], string> = {
    spacing: '↕',
    alignment: '⊡',
    hierarchy: '△',
    'cta-emphasis': '◉',
    readability: '¶',
  };
  return icons[type] ?? '○';
}
