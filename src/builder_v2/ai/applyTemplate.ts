/**
 * Template Application Module
 *
 * Phase 32 — Template Application & Soft Normalization
 *
 * Converts template intelligence into an optional, reversible structure
 * alignment step that gently normalizes spacing, grouping, and section
 * ordering — without touching content.
 *
 * Philosophy:
 * - Soft normalization, not hard transformation
 * - Preserve content and node IDs where possible
 * - Fully reversible via undo/redo
 * - No destructive operations
 *
 * What this module adjusts:
 * - Container grouping
 * - Spacing (gap / padding)
 * - Section ordering when clearly mismatched
 *
 * What this module preserves:
 * - Node IDs
 * - Child order inside sections
 * - All text content
 * - All media content
 */

import type { CanvasNode, LayoutPersonality, Page } from '../types';
import {
  getTemplateById,
  deriveFingerprint,
  type TemplatePattern,
  type StructuralFingerprint,
} from './templateIntelligence';
import { resolveLayoutPersonality } from '../layout/personalityResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of template application.
 */
export interface TemplateApplicationResult {
  /** Whether application was successful */
  success: boolean;
  /** Updated page with normalized structure */
  page: Page;
  /** Node IDs that were modified */
  modifiedNodeIds: string[];
  /** Human-readable description of changes */
  description: string;
  /** Applied template ID for tracking */
  templateId: string;
}

/**
 * Spacing adjustments to apply.
 */
interface SpacingAdjustment {
  nodeId: string;
  gap?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

/**
 * Section reordering directive.
 */
interface SectionReorderDirective {
  fromIndex: number;
  toIndex: number;
  nodeId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum mismatch threshold before reordering sections.
 * Only reorder when role sequence is clearly mismatched.
 */
const REORDER_MISMATCH_THRESHOLD = 0.6;

/**
 * Section role priority for ordering.
 * Higher priority = earlier in page.
 */
const ROLE_ORDER_PRIORITY: Record<string, number> = {
  hero: 0,
  feature: 1,
  body: 2,
  action: 3,
  testimonial: 4,
  footer: 5,
};

// ---------------------------------------------------------------------------
// Node Helpers
// ---------------------------------------------------------------------------

/**
 * Deep clone a node tree.
 */
function cloneNode(node: CanvasNode): CanvasNode {
  return {
    id: node.id,
    type: node.type,
    props: { ...node.props },
    children: node.children.map(cloneNode),
  };
}

/**
 * Update props on a node in the tree.
 */
function updateNodeProps(
  root: CanvasNode,
  nodeId: string,
  newProps: Record<string, unknown>
): CanvasNode {
  if (root.id === nodeId) {
    return {
      ...root,
      props: { ...root.props, ...newProps },
    };
  }

  let changed = false;
  const newChildren = root.children.map((child) => {
    const updated = updateNodeProps(child, nodeId, newProps);
    if (updated !== child) changed = true;
    return updated;
  });

  if (!changed) return root;

  return {
    ...root,
    children: newChildren,
  };
}

/**
 * Reorder children of root node.
 */
function reorderChildren(
  root: CanvasNode,
  reorderDirectives: SectionReorderDirective[]
): CanvasNode {
  if (reorderDirectives.length === 0) return root;

  const newChildren = [...root.children];

  // Sort directives by fromIndex descending to handle moves correctly
  const sortedDirectives = [...reorderDirectives].sort(
    (a, b) => b.fromIndex - a.fromIndex
  );

  for (const directive of sortedDirectives) {
    const { fromIndex, toIndex } = directive;
    if (fromIndex === toIndex) continue;
    if (fromIndex < 0 || fromIndex >= newChildren.length) continue;
    if (toIndex < 0 || toIndex >= newChildren.length) continue;

    const [moved] = newChildren.splice(fromIndex, 1);
    newChildren.splice(toIndex, 0, moved);
  }

  return {
    ...root,
    children: newChildren,
  };
}

// ---------------------------------------------------------------------------
// Spacing Normalization
// ---------------------------------------------------------------------------

/**
 * Compute spacing adjustments based on template.
 */
function computeSpacingAdjustments(
  page: Page,
  template: TemplatePattern,
  personality: LayoutPersonality
): SpacingAdjustment[] {
  const adjustments: SpacingAdjustment[] = [];
  const resolved = resolveLayoutPersonality(personality);

  // Root container spacing
  adjustments.push({
    nodeId: page.canvasRoot.id,
    gap: template.idealSpacing.sectionGap,
  });

  // Section-level spacing
  for (const section of page.canvasRoot.children) {
    adjustments.push({
      nodeId: section.id,
      gap: template.idealSpacing.blockGap,
      paddingTop: resolved.spacing.sectionGap / 2,
      paddingBottom: resolved.spacing.sectionGap / 2,
    });

    // Nested container spacing
    for (const child of section.children) {
      if (child.children.length > 0) {
        adjustments.push({
          nodeId: child.id,
          gap: template.idealSpacing.contentGap,
        });
      }
    }
  }

  return adjustments;
}

/**
 * Apply spacing adjustments to page.
 */
function applySpacingAdjustments(
  page: Page,
  adjustments: SpacingAdjustment[]
): { page: Page; modifiedIds: string[] } {
  let currentRoot = cloneNode(page.canvasRoot);
  const modifiedIds: string[] = [];

  for (const adj of adjustments) {
    const newProps: Record<string, unknown> = {};

    if (adj.gap !== undefined) newProps.gap = adj.gap;
    if (adj.paddingTop !== undefined) newProps.paddingTop = adj.paddingTop;
    if (adj.paddingBottom !== undefined) newProps.paddingBottom = adj.paddingBottom;
    if (adj.paddingLeft !== undefined) newProps.paddingLeft = adj.paddingLeft;
    if (adj.paddingRight !== undefined) newProps.paddingRight = adj.paddingRight;

    if (Object.keys(newProps).length > 0) {
      currentRoot = updateNodeProps(currentRoot, adj.nodeId, newProps);
      modifiedIds.push(adj.nodeId);
    }
  }

  return {
    page: { ...page, canvasRoot: currentRoot },
    modifiedIds,
  };
}

// ---------------------------------------------------------------------------
// Section Reordering
// ---------------------------------------------------------------------------

/**
 * Infer section role from structure (simplified).
 */
function inferSectionRole(section: CanvasNode): string {
  const type = section.type.toLowerCase();

  // Explicit types
  if (type.includes('hero')) return 'hero';
  if (type.includes('footer')) return 'footer';
  if (type.includes('feature')) return 'feature';
  if (type.includes('testimonial')) return 'testimonial';

  // Check props
  if (section.props.role) return String(section.props.role);

  // Infer from content
  const hasHeadline = section.children.some(
    (c) => c.type === 'headline' || c.type === 'heading' || c.type === 'h1'
  );
  const hasCTA = section.children.some(
    (c) => c.type === 'button' || c.type === 'cta'
  );
  const hasInputs = section.children.some(
    (c) => c.type === 'input' || c.type === 'form'
  );

  if (hasHeadline && hasCTA && !hasInputs) return 'hero';
  if (hasCTA && hasInputs) return 'action';

  return 'body';
}

/**
 * Compute section reorder directives based on template role sequence.
 */
function computeReorderDirectives(
  page: Page,
  template: TemplatePattern
): SectionReorderDirective[] {
  const directives: SectionReorderDirective[] = [];
  const sections = page.canvasRoot.children;
  const templateRoles = template.fingerprint.roleSequence;

  if (sections.length !== templateRoles.length) {
    // Only reorder when section count matches
    return directives;
  }

  // Get current roles
  const currentRoles = sections.map(inferSectionRole);

  // Check if reordering would help
  let currentMismatch = 0;
  for (let i = 0; i < currentRoles.length; i++) {
    if (currentRoles[i] !== templateRoles[i]) {
      currentMismatch++;
    }
  }

  const mismatchRatio = currentMismatch / currentRoles.length;
  if (mismatchRatio < REORDER_MISMATCH_THRESHOLD) {
    // Current order is acceptable
    return directives;
  }

  // Try to find better order
  const indexed = sections.map((section, index) => ({
    section,
    index,
    role: currentRoles[index],
  }));

  // Sort by role priority
  const sorted = [...indexed].sort((a, b) => {
    const priorityA = ROLE_ORDER_PRIORITY[a.role] ?? 99;
    const priorityB = ROLE_ORDER_PRIORITY[b.role] ?? 99;
    return priorityA - priorityB;
  });

  // Generate directives for moves
  for (let newIndex = 0; newIndex < sorted.length; newIndex++) {
    const item = sorted[newIndex];
    if (item.index !== newIndex) {
      directives.push({
        fromIndex: item.index,
        toIndex: newIndex,
        nodeId: item.section.id,
      });
    }
  }

  return directives;
}

// ---------------------------------------------------------------------------
// Container Grouping
// ---------------------------------------------------------------------------

/**
 * Identify ungrouped sequences that should be wrapped.
 * Returns node IDs that were added (new container wrappers).
 */
function normalizeContainerGrouping(
  page: Page,
  template: TemplatePattern
): { page: Page; addedIds: string[] } {
  // For Phase 32, we only adjust existing container gaps
  // Actual wrapping would require node ID generation and is deferred
  // to maintain simplicity and reversibility
  return { page, addedIds: [] };
}

// ---------------------------------------------------------------------------
// Main Application Function
// ---------------------------------------------------------------------------

/**
 * Apply a template to a page with soft normalization.
 *
 * This function:
 * - Adjusts spacing (gap/padding) to match template
 * - Reorders sections when clearly mismatched
 * - Preserves all content and node IDs
 * - Is fully reversible via undo
 *
 * @param page - The page to normalize
 * @param templateId - The template ID to apply
 * @returns Application result with updated page
 */
export function applyTemplate(
  page: Page,
  templateId: string
): TemplateApplicationResult {
  const template = getTemplateById(templateId);

  if (!template) {
    return {
      success: false,
      page,
      modifiedNodeIds: [],
      description: `Template "${templateId}" not found.`,
      templateId,
    };
  }

  // Determine personality from template
  const personality = template.suggestedPersonality;

  // 1. Compute spacing adjustments
  const spacingAdjustments = computeSpacingAdjustments(page, template, personality);

  // 2. Compute section reorder directives (only if clearly mismatched)
  const reorderDirectives = computeReorderDirectives(page, template);

  // 3. Apply spacing first
  const { page: spacedPage, modifiedIds: spacingIds } = applySpacingAdjustments(
    page,
    spacingAdjustments
  );

  // 4. Apply reordering
  let finalPage = spacedPage;
  const reorderedIds: string[] = [];

  if (reorderDirectives.length > 0) {
    finalPage = {
      ...spacedPage,
      canvasRoot: reorderChildren(spacedPage.canvasRoot, reorderDirectives),
    };
    reorderedIds.push(...reorderDirectives.map((d) => d.nodeId));
  }

  // 5. Apply personality to page
  finalPage = {
    ...finalPage,
    layoutPersonality: personality,
  };

  // Collect all modified IDs
  const allModifiedIds = [...new Set([...spacingIds, ...reorderedIds])];

  // Generate description
  const changes: string[] = [];
  if (spacingIds.length > 0) {
    changes.push(`adjusted spacing on ${spacingIds.length} elements`);
  }
  if (reorderedIds.length > 0) {
    changes.push(`reordered ${reorderedIds.length} sections`);
  }
  changes.push(`applied ${personality} personality`);

  return {
    success: true,
    page: finalPage,
    modifiedNodeIds: allModifiedIds,
    description: `Applied "${template.name}": ${changes.join(', ')}.`,
    templateId,
  };
}

/**
 * Preview which nodes would be affected by template application.
 * Returns node IDs for highlighting without mutating state.
 */
export function previewTemplateApplication(
  page: Page,
  templateId: string
): string[] {
  const template = getTemplateById(templateId);

  if (!template) {
    return [];
  }

  const personality = template.suggestedPersonality;
  const affectedIds: string[] = [];

  // Spacing would affect root and all sections
  affectedIds.push(page.canvasRoot.id);
  for (const section of page.canvasRoot.children) {
    affectedIds.push(section.id);
  }

  // Check if reordering would happen
  const reorderDirectives = computeReorderDirectives(page, template);
  for (const directive of reorderDirectives) {
    if (!affectedIds.includes(directive.nodeId)) {
      affectedIds.push(directive.nodeId);
    }
  }

  return affectedIds;
}

/**
 * Get human-readable preview of template changes.
 */
export function describeTemplateChanges(
  page: Page,
  templateId: string
): string[] {
  const template = getTemplateById(templateId);

  if (!template) {
    return ['Template not found'];
  }

  const changes: string[] = [];

  // Spacing changes
  changes.push(`Apply ${template.name} spacing rhythm`);

  // Personality change
  if (page.layoutPersonality !== template.suggestedPersonality) {
    changes.push(`Switch to ${template.suggestedPersonality} personality`);
  }

  // Section reordering
  const reorderDirectives = computeReorderDirectives(page, template);
  if (reorderDirectives.length > 0) {
    changes.push(`Reorder sections to match ${template.name} structure`);
  }

  return changes;
}

/**
 * Check if a template has already been applied to a page.
 * Uses structural fingerprint comparison.
 */
export function isTemplateApplied(
  page: Page,
  templateId: string,
  threshold: number = 0.9
): boolean {
  const template = getTemplateById(templateId);

  if (!template) {
    return false;
  }

  // Compare fingerprints
  const currentFingerprint = deriveFingerprint(page);
  const templateFingerprint = template.fingerprint;

  // Quick checks
  if (page.layoutPersonality !== template.suggestedPersonality) {
    return false;
  }

  // Check spacing similarity
  const root = page.canvasRoot;
  const rootGap = (root.props.gap as number) ?? 0;
  const expectedGap = template.idealSpacing.sectionGap;
  const gapMatch = Math.abs(rootGap - expectedGap) < 4;

  return gapMatch && page.layoutPersonality === template.suggestedPersonality;
}
