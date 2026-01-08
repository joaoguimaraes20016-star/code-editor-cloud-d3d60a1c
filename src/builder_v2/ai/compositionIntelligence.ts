/**
 * Composition Intelligence Module
 *
 * Phase 29 — Guided Composition & Next-Best-Action
 *
 * Pure heuristics for detecting structural composition patterns and suggesting
 * the next best structural action to reduce "blank canvas paralysis".
 *
 * Philosophy:
 * - Guide without instructing
 * - Make the editor feel collaborative
 * - Preserve full user control
 * - Never auto-apply; always suggest
 *
 * This module does not render anything. It only answers questions like:
 * - "Is this section missing a CTA?"
 * - "Is this text stack ungrouped?"
 * - "Is the action too close to the headline?"
 * - "Does this section lack closure spacing?"
 *
 * Personality-aware: Suggestion thresholds adapt to layout personality.
 *
 * No external APIs. No LLM calls. Pure heuristics.
 */

import type { CanvasNode, LayoutPersonality, Page } from '../types';
import { resolveFunnelLayout, type FunnelLayoutMetrics } from '../layout/funnelLayout';
import {
  resolveLayoutPersonality,
  type SuggestionSensitivityTokens,
} from '../layout/personalityResolver';
import type { LayoutSuggestion, LayoutSuggestionType } from './layoutIntelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Composition-specific suggestion type.
 * Extends base LayoutSuggestion with composition category.
 */
export interface CompositionSuggestion extends LayoutSuggestion {
  category: 'composition';
}

/**
 * Composition heuristic identifiers.
 */
export type CompositionHeuristicId =
  | 'section-missing-cta'
  | 'text-stack-ungrouped'
  | 'action-too-close-to-headline'
  | 'section-without-closure';

/**
 * Context for composition analysis.
 */
export interface CompositionContext {
  page: Page;
  nodes: CanvasNode[];
  viewport: 'desktop' | 'mobile';
  /** Personality-aware sensitivity tokens */
  sensitivity: SuggestionSensitivityTokens;
  /** Layout personality for threshold adjustments */
  personality: LayoutPersonality;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Node types considered as CTA (Call-to-Action) elements.
 */
const CTA_TYPES = new Set(['button', 'cta', 'submit', 'link-button']);

/**
 * Node types considered as text content.
 */
const TEXT_TYPES = new Set(['text', 'paragraph', 'body', 'content']);

/**
 * Node types considered as headlines.
 */
const HEADLINE_TYPES = new Set(['headline', 'heading', 'title', 'hero-headline', 'h1', 'h2']);

/**
 * Node types considered as section containers.
 */
const SECTION_TYPES = new Set(['section', 'container', 'hero', 'content-block', 'feature-section']);

/**
 * Node types that typically group content logically.
 */
const GROUPING_TYPES = new Set(['container', 'stack', 'row', 'column', 'group', 'card']);

/**
 * Minimum consecutive text nodes before suggesting grouping.
 */
const TEXT_STACK_MIN_CONSECUTIVE = 3;

/**
 * Minimum spacing (in layout units) expected between action and headline.
 */
const ACTION_HEADLINE_MIN_GAP_FACTOR = 1.5;

/**
 * Minimum closure spacing expected at section bottom (as ratio of section gap).
 */
const CLOSURE_SPACING_RATIO = 0.75;

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

let compositionSuggestionCounter = 0;

function generateCompositionSuggestionId(heuristic: CompositionHeuristicId): string {
  compositionSuggestionCounter += 1;
  return `composition-${heuristic}-${compositionSuggestionCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Node Helpers
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
 * Check if a node is a CTA element.
 */
function isCTANode(node: CanvasNode): boolean {
  return (
    CTA_TYPES.has(node.type) ||
    node.props.variant === 'primary' ||
    node.props.role === 'cta'
  );
}

/**
 * Check if a node is a headline element.
 */
function isHeadlineNode(node: CanvasNode): boolean {
  return (
    HEADLINE_TYPES.has(node.type) ||
    node.props.variant === 'headline' ||
    node.props.role === 'heading'
  );
}

/**
 * Check if a node is a text element.
 */
function isTextNode(node: CanvasNode): boolean {
  return (
    TEXT_TYPES.has(node.type) ||
    node.props.variant === 'body' ||
    node.props.variant === 'caption'
  );
}

/**
 * Check if a node is a section container.
 */
function isSectionNode(node: CanvasNode): boolean {
  return (
    SECTION_TYPES.has(node.type) ||
    node.props.role === 'section' ||
    node.props.isSection === true
  );
}

/**
 * Check if a node is a grouping container.
 */
function isGroupingNode(node: CanvasNode): boolean {
  return GROUPING_TYPES.has(node.type);
}

/**
 * Get numeric prop value with fallback.
 */
function getNumericProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

/**
 * Check if a section contains any CTA elements.
 */
function sectionContainsCTA(section: CanvasNode): boolean {
  return flattenNodes(section).some(isCTANode);
}

/**
 * Find all section-level containers in the tree.
 */
function findSections(root: CanvasNode): CanvasNode[] {
  const sections: CanvasNode[] = [];
  
  function traverse(node: CanvasNode, depth: number): void {
    // Consider root-level children as implicit sections
    if (depth === 1 || isSectionNode(node)) {
      sections.push(node);
    }
    
    // Only traverse into non-section nodes
    if (!isSectionNode(node) || depth === 0) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }
  
  traverse(root, 0);
  return sections;
}

// ---------------------------------------------------------------------------
// Heuristic A: Section Missing CTA
// ---------------------------------------------------------------------------

/**
 * Detect sections that appear to need a CTA but don't have one.
 * 
 * Applies primarily to conversion-focused sections that have headlines
 * and body content but no action element.
 */
function analyzeSectionMissingCTA(
  context: CompositionContext,
  layout: FunnelLayoutMetrics,
): CompositionSuggestion[] {
  const suggestions: CompositionSuggestion[] = [];
  const sections = findSections(context.page.canvasRoot);
  
  for (const section of sections) {
    const flatChildren = flattenNodes(section);
    const hasHeadline = flatChildren.some(isHeadlineNode);
    const hasText = flatChildren.some(isTextNode);
    const hasCTA = flatChildren.some(isCTANode);
    
    // Section has headline and text but no CTA - likely needs one
    if (hasHeadline && hasText && !hasCTA) {
      // Calculate confidence based on content structure
      let confidence = 0.5;
      
      // More text content = higher confidence it needs a CTA
      const textCount = flatChildren.filter(isTextNode).length;
      confidence += Math.min(0.2, textCount * 0.05);
      
      // Hero sections almost always need CTAs
      if (section.type === 'hero') {
        confidence += 0.25;
      }
      
      // Check for conversion-focused intents
      if (layout.intent === 'optin' || layout.intent === 'checkout') {
        confidence += 0.15;
      }
      
      suggestions.push({
        id: generateCompositionSuggestionId('section-missing-cta'),
        type: 'cta-emphasis' as LayoutSuggestionType,
        category: 'composition',
        confidence: Math.min(1.0, confidence),
        message: 'This section could benefit from a call-to-action.',
        affectedNodeIds: [section.id],
        recommendation: {
          token: '--composition-cta-needed',
        },
      });
    }
  }
  
  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic B: Text Stack Without Grouping
// ---------------------------------------------------------------------------

/**
 * Detect consecutive text elements that should be grouped together.
 * 
 * Multiple text nodes at the same level without a grouping container
 * can feel disconnected and harder to maintain.
 */
function analyzeTextStackUngrouped(
  context: CompositionContext,
  _layout: FunnelLayoutMetrics,
): CompositionSuggestion[] {
  const suggestions: CompositionSuggestion[] = [];
  
  function analyzeContainer(container: CanvasNode): void {
    let consecutiveTextNodes: CanvasNode[] = [];
    
    for (const child of container.children) {
      if (isTextNode(child) || isHeadlineNode(child)) {
        consecutiveTextNodes.push(child);
      } else {
        // Check if we had a stack worth suggesting
        if (consecutiveTextNodes.length >= TEXT_STACK_MIN_CONSECUTIVE) {
          // Verify they're not already in a meaningful group
          const allSiblings = container.children.length === consecutiveTextNodes.length;
          const parentIsGroup = isGroupingNode(container) && container.type !== 'container';
          
          if (!allSiblings && !parentIsGroup) {
            const confidence = Math.min(
              0.9,
              0.5 + (consecutiveTextNodes.length - TEXT_STACK_MIN_CONSECUTIVE) * 0.1
            );
            
            suggestions.push({
              id: generateCompositionSuggestionId('text-stack-ungrouped'),
              type: 'hierarchy' as LayoutSuggestionType,
              category: 'composition',
              confidence,
              message: 'These text elements could be grouped together for better structure.',
              affectedNodeIds: consecutiveTextNodes.map((n) => n.id),
              recommendation: {
                token: '--composition-group-text',
              },
            });
          }
        }
        consecutiveTextNodes = [];
      }
      
      // Recurse into non-text children
      if (!isTextNode(child) && child.children.length > 0) {
        analyzeContainer(child);
      }
    }
    
    // Check trailing text stack
    if (consecutiveTextNodes.length >= TEXT_STACK_MIN_CONSECUTIVE) {
      const allSiblings = container.children.length === consecutiveTextNodes.length;
      const parentIsGroup = isGroupingNode(container) && container.type !== 'container';
      
      if (!allSiblings && !parentIsGroup) {
        const confidence = Math.min(
          0.9,
          0.5 + (consecutiveTextNodes.length - TEXT_STACK_MIN_CONSECUTIVE) * 0.1
        );
        
        suggestions.push({
          id: generateCompositionSuggestionId('text-stack-ungrouped'),
          type: 'hierarchy' as LayoutSuggestionType,
          category: 'composition',
          confidence,
          message: 'These text elements could be grouped together for better structure.',
          affectedNodeIds: consecutiveTextNodes.map((n) => n.id),
          recommendation: {
            token: '--composition-group-text',
          },
        });
      }
    }
  }
  
  analyzeContainer(context.page.canvasRoot);
  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic C: Action Too Close to Headline
// ---------------------------------------------------------------------------

/**
 * Detect when a CTA button is placed immediately after a headline
 * without sufficient visual/content separation.
 * 
 * CTAs that follow headlines directly can feel rushed and reduce
 * the impact of both elements.
 */
function analyzeActionTooCloseToHeadline(
  context: CompositionContext,
  layout: FunnelLayoutMetrics,
): CompositionSuggestion[] {
  const suggestions: CompositionSuggestion[] = [];
  
  function analyzeContainer(container: CanvasNode): void {
    const children = container.children;
    
    for (let i = 0; i < children.length - 1; i++) {
      const current = children[i];
      const next = children[i + 1];
      
      // Check for headline immediately followed by CTA
      if (isHeadlineNode(current) && isCTANode(next)) {
        const containerGap = getNumericProp(container.props, 'gap', layout.spacing.blockGap);
        const expectedMinGap = layout.spacing.actionGap * ACTION_HEADLINE_MIN_GAP_FACTOR;
        
        // If gap is less than expected, suggest adding content or spacing
        if (containerGap < expectedMinGap) {
          let confidence = 0.6;
          
          // Higher confidence for smaller gaps
          if (containerGap < layout.spacing.contentGap) {
            confidence += 0.2;
          }
          
          // Lower confidence in dense personality
          if (context.personality === 'dense') {
            confidence -= 0.2;
          }
          
          suggestions.push({
            id: generateCompositionSuggestionId('action-too-close-to-headline'),
            type: 'spacing' as LayoutSuggestionType,
            category: 'composition',
            confidence: Math.max(0.3, Math.min(0.9, confidence)),
            message: 'Consider adding supporting content between headline and action.',
            affectedNodeIds: [current.id, next.id],
            recommendation: {
              token: '--composition-headline-action-gap',
              delta: expectedMinGap - containerGap,
            },
          });
        }
      }
    }
    
    // Recurse
    for (const child of children) {
      if (child.children.length > 0) {
        analyzeContainer(child);
      }
    }
  }
  
  analyzeContainer(context.page.canvasRoot);
  return suggestions;
}

// ---------------------------------------------------------------------------
// Heuristic D: Section Without Closure Spacing
// ---------------------------------------------------------------------------

/**
 * Detect sections that end abruptly without proper visual closure.
 * 
 * Sections should have breathing room at the bottom to create clear
 * visual separation between content areas.
 */
function analyzeSectionWithoutClosure(
  context: CompositionContext,
  layout: FunnelLayoutMetrics,
): CompositionSuggestion[] {
  const suggestions: CompositionSuggestion[] = [];
  const root = context.page.canvasRoot;
  
  // Only analyze sections that are direct children of root
  const topLevelSections = root.children.filter(
    (child) => child.children.length > 0 && (isSectionNode(child) || child.children.length >= 2)
  );
  
  for (let i = 0; i < topLevelSections.length - 1; i++) {
    const section = topLevelSections[i];
    const expectedClosure = layout.spacing.stepGap * CLOSURE_SPACING_RATIO;
    
    // Check if section has padding/margin at bottom
    const paddingBottom = getNumericProp(section.props, 'paddingBottom', 0);
    const marginBottom = getNumericProp(section.props, 'marginBottom', 0);
    const totalBottomSpace = paddingBottom + marginBottom;
    
    // Also check the container gap between sections
    const rootGap = getNumericProp(root.props, 'gap', layout.spacing.stepGap);
    const effectiveClosure = totalBottomSpace + rootGap;
    
    if (effectiveClosure < expectedClosure) {
      let confidence = 0.5;
      
      // More content in section = higher confidence it needs closure
      const childCount = flattenNodes(section).length;
      confidence += Math.min(0.2, childCount * 0.02);
      
      // Higher confidence for editorial personality
      if (context.personality === 'editorial') {
        confidence += 0.15;
      }
      
      // Lower confidence for dense personality
      if (context.personality === 'dense') {
        confidence -= 0.25;
      }
      
      suggestions.push({
        id: generateCompositionSuggestionId('section-without-closure'),
        type: 'spacing' as LayoutSuggestionType,
        category: 'composition',
        confidence: Math.max(0.3, Math.min(0.85, confidence)),
        message: 'This section could use more breathing room at the end.',
        affectedNodeIds: [section.id],
        recommendation: {
          token: '--composition-section-closure',
          delta: Math.ceil(expectedClosure - effectiveClosure),
        },
      });
    }
  }
  
  return suggestions;
}

// ---------------------------------------------------------------------------
// Personality-Aware Threshold Adjustment
// ---------------------------------------------------------------------------

/**
 * Adjust suggestion confidence based on layout personality.
 * 
 * - dense → fewer suggestions (higher thresholds)
 * - conversion → CTA-first bias (boost CTA suggestions)
 * - editorial → hierarchy-first bias (boost structure suggestions)
 */
function applyPersonalityAdjustments(
  suggestions: CompositionSuggestion[],
  context: CompositionContext,
): CompositionSuggestion[] {
  const { personality, sensitivity } = context;
  
  return suggestions.map((suggestion) => {
    let adjustedConfidence = suggestion.confidence;
    
    switch (personality) {
      case 'dense':
        // Dense layouts should receive fewer suggestions
        adjustedConfidence *= 0.75;
        break;
        
      case 'conversion':
        // Conversion layouts prioritize CTA suggestions
        if (suggestion.type === 'cta-emphasis') {
          adjustedConfidence *= sensitivity.ctaWeight;
        } else {
          adjustedConfidence *= 0.85;
        }
        break;
        
      case 'editorial':
        // Editorial layouts prioritize hierarchy/structure suggestions
        if (suggestion.type === 'hierarchy' || suggestion.type === 'spacing') {
          adjustedConfidence *= 1.15;
        }
        break;
        
      case 'bold':
        // Bold layouts are more tolerant of tight spacing
        if (suggestion.type === 'spacing') {
          adjustedConfidence *= 0.9;
        }
        break;
        
      case 'clean':
      default:
        // Clean personality uses baseline thresholds
        break;
    }
    
    // Apply suggestion-type-specific thresholds
    let threshold = 0.4; // base threshold
    
    switch (suggestion.type) {
      case 'spacing':
        threshold = sensitivity.spacingThreshold;
        break;
      case 'hierarchy':
        threshold = sensitivity.hierarchyThreshold;
        break;
      case 'cta-emphasis':
        threshold = sensitivity.ctaThreshold;
        break;
      case 'alignment':
        threshold = sensitivity.alignmentThreshold;
        break;
    }
    
    // Filter out below-threshold suggestions
    if (adjustedConfidence < threshold) {
      return null;
    }
    
    return {
      ...suggestion,
      confidence: Math.min(1.0, adjustedConfidence),
    };
  }).filter((s): s is CompositionSuggestion => s !== null);
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Analyze page composition and return structural suggestions.
 *
 * This is the main entry point for composition intelligence.
 * Returns suggestions that:
 * - Reduce blank canvas paralysis
 * - Guide without instructing
 * - Are never auto-applied
 * - Are limited to 1-2 active at a time
 *
 * @param page - The page to analyze
 * @param viewport - Current viewport (desktop/mobile)
 * @returns Array of composition suggestions, limited to top 2
 */
export function analyzeComposition(
  page: Page,
  viewport: 'desktop' | 'mobile' = 'desktop',
): CompositionSuggestion[] {
  const layout = resolveFunnelLayout(page);
  const personality = page.layoutPersonality ?? 'clean';
  const resolvedPersonality = resolveLayoutPersonality(personality);
  
  const context: CompositionContext = {
    page,
    nodes: flattenNodes(page.canvasRoot),
    viewport,
    sensitivity: resolvedPersonality.suggestions,
    personality,
  };
  
  const allSuggestions: CompositionSuggestion[] = [];
  
  // Run all heuristics
  allSuggestions.push(...analyzeSectionMissingCTA(context, layout));
  allSuggestions.push(...analyzeTextStackUngrouped(context, layout));
  allSuggestions.push(...analyzeActionTooCloseToHeadline(context, layout));
  allSuggestions.push(...analyzeSectionWithoutClosure(context, layout));
  
  // Apply personality-aware adjustments and filter
  const adjustedSuggestions = applyPersonalityAdjustments(allSuggestions, context);
  
  // Sort by confidence (highest first)
  adjustedSuggestions.sort((a, b) => b.confidence - a.confidence);
  
  // Deduplicate by affected nodes (keep highest confidence)
  const seen = new Set<string>();
  const deduped: CompositionSuggestion[] = [];
  
  for (const suggestion of adjustedSuggestions) {
    const key = suggestion.affectedNodeIds.sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(suggestion);
    }
  }
  
  // Limit to max 2 active suggestions (Phase 29 requirement)
  return deduped.slice(0, 2);
}

/**
 * Create a composition context from page data.
 * Convenience function for external integration.
 */
export function createCompositionContext(
  page: Page,
  viewport: 'desktop' | 'mobile' = 'desktop',
): CompositionContext {
  const personality = page.layoutPersonality ?? 'clean';
  const resolvedPersonality = resolveLayoutPersonality(personality);
  
  return {
    page,
    nodes: flattenNodes(page.canvasRoot),
    viewport,
    sensitivity: resolvedPersonality.suggestions,
    personality,
  };
}

/**
 * Check if a node ID is in the affected area of any active suggestion.
 * Used to clear suggestions when the user manually edits the affected area.
 * Works with both LayoutSuggestion and CompositionSuggestion.
 */
export function isNodeInAffectedArea(
  nodeId: string,
  suggestions: LayoutSuggestion[],
): boolean {
  return suggestions.some((s) => s.affectedNodeIds.includes(nodeId));
}

/**
 * Filter out suggestions that affect a specific node.
 * Call this when the user manually edits a node to clear related suggestions.
 * Works with both LayoutSuggestion and CompositionSuggestion.
 */
export function clearSuggestionsForNode<T extends LayoutSuggestion>(
  nodeId: string,
  suggestions: T[],
): T[] {
  return suggestions.filter((s) => !s.affectedNodeIds.includes(nodeId));
}

/**
 * Check if composition suggestions should be recomputed.
 * Returns true for meaningful structural edits.
 */
export function shouldRecomputeComposition(actionType: string): boolean {
  const meaningfulActions = new Set([
    'ADD_NODE',
    'DELETE_NODE',
    'MOVE_NODE_UP',
    'MOVE_NODE_DOWN',
    'MOVE_NODE_TO_PARENT',
    'HYDRATE_FROM_STORAGE',
    'UPDATE_PAGE_PROPS',
  ]);
  
  return meaningfulActions.has(actionType);
}

/**
 * Merge composition suggestions with layout suggestions.
 * Composition suggestions are given slightly lower priority to avoid
 * overwhelming the user with suggestions.
 */
export function mergeWithLayoutSuggestions(
  layoutSuggestions: LayoutSuggestion[],
  compositionSuggestions: CompositionSuggestion[],
  maxTotal: number = 3,
): LayoutSuggestion[] {
  // Layout suggestions first (higher priority)
  const merged: LayoutSuggestion[] = [...layoutSuggestions];
  
  // Add composition suggestions up to max total
  for (const cs of compositionSuggestions) {
    if (merged.length >= maxTotal) {
      break;
    }
    
    // Check if we already have a suggestion for the same nodes
    const hasOverlap = merged.some((ls) =>
      ls.affectedNodeIds.some((id) => cs.affectedNodeIds.includes(id))
    );
    
    if (!hasOverlap) {
      merged.push(cs);
    }
  }
  
  return merged;
}
