/**
 * Structural Intelligence Module
 *
 * Phase 30 — AI Builder Assistant (Silent Structural Intelligence)
 *
 * Pure heuristics for inferring user intent from page structure and suggesting
 * higher-level structural improvements. No chat, no text generation, no auto-apply.
 *
 * Philosophy:
 * - Feel like Framer / Perspective, not Copilot
 * - Infer intent, don't generate content
 * - Stay invisible unless useful
 * - Preserve full user authorship
 *
 * This module answers questions like:
 * - "What is the user trying to build?" (funnel intent)
 * - "What role does this section play?" (hero, body, action, footer)
 * - "What personality would fit this structure?" (layout personality)
 * - "How confident is the hierarchy?" (hierarchy confidence)
 *
 * No external APIs. No LLM calls. Pure structural analysis.
 */

import type { CanvasNode, LayoutPersonality, Page, PageType, StepIntent } from '../types';
import { resolveFunnelLayout } from '../layout/funnelLayout';
import { resolveLayoutPersonality } from '../layout/personalityResolver';
import type { LayoutSuggestion, LayoutSuggestionType } from './layoutIntelligence';
import type { CompositionSuggestion } from './compositionIntelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * AI-powered suggestion that extends composition suggestions.
 * Source is always 'ai' to distinguish from heuristic-based suggestions.
 */
export interface AISuggestion extends CompositionSuggestion {
  source: 'ai';
  /** Confidence score from structural analysis (0.0 to 1.0) */
  confidence: number;
  /** Structural transformation directive */
  transformDirective?: StructuralTransformDirective;
}

/**
 * High-level structural transformation directives.
 */
export type StructuralTransformDirective =
  | 'apply-conversion-personality'
  | 'apply-editorial-personality'
  | 'apply-bold-personality'
  | 'apply-clean-personality'
  | 'normalize-section-spacing'
  | 'promote-to-hero'
  | 'group-into-semantic-container'
  | 'add-visual-hierarchy'
  | 'improve-cta-prominence';

/**
 * Inferred section role in page structure.
 */
export type SectionRole = 'hero' | 'body' | 'action' | 'footer' | 'feature' | 'testimonial';

/**
 * Structural inference result for a page.
 */
export interface StructuralInference {
  /** Inferred funnel intent */
  funnelIntent: StepIntent;
  /** Confidence in funnel intent inference (0.0 to 1.0) */
  funnelIntentConfidence: number;
  /** Inferred section roles */
  sectionRoles: Map<string, SectionRole>;
  /** Likely layout personality */
  likelyPersonality: LayoutPersonality;
  /** Confidence in personality inference (0.0 to 1.0) */
  personalityConfidence: number;
  /** Overall hierarchy confidence score (0.0 to 1.0) */
  hierarchyConfidence: number;
  /** Suggested structural improvements */
  suggestions: AISuggestion[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Node types considered as CTA elements.
 */
const CTA_TYPES = new Set(['button', 'cta', 'submit', 'link-button']);

/**
 * Node types considered as form input elements.
 */
const INPUT_TYPES = new Set(['input', 'textarea', 'select', 'form-field', 'form', 'form-group']);

/**
 * Node types considered as headlines.
 */
const HEADLINE_TYPES = new Set(['headline', 'heading', 'title', 'hero-headline', 'h1', 'h2', 'h3']);

/**
 * Node types considered as text content.
 */
const TEXT_TYPES = new Set(['text', 'paragraph', 'body', 'content', 'caption']);

/**
 * Node types considered as media elements.
 */
const MEDIA_TYPES = new Set(['image', 'video', 'embed', 'media']);

/**
 * Node types that indicate hero sections.
 */
const HERO_TYPES = new Set(['hero', 'hero-section', 'banner']);

/**
 * Minimum confidence threshold for AI suggestions.
 */
const AI_SUGGESTION_THRESHOLD = 0.55;

/**
 * Maximum AI suggestions per inference (Phase 30 requirement).
 */
const MAX_AI_SUGGESTIONS = 2;

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
  return CTA_TYPES.has(node.type) || node.props.variant === 'primary' || node.props.role === 'cta';
}

/**
 * Check if a node is an input element.
 */
function isInputNode(node: CanvasNode): boolean {
  return INPUT_TYPES.has(node.type) || node.props.type === 'input' || node.props.role === 'form';
}

/**
 * Check if a node is a headline element.
 */
function isHeadlineNode(node: CanvasNode): boolean {
  return HEADLINE_TYPES.has(node.type) || node.props.variant === 'headline';
}

/**
 * Check if a node is a text element.
 */
function isTextNode(node: CanvasNode): boolean {
  return TEXT_TYPES.has(node.type) || node.props.variant === 'body';
}

/**
 * Check if a node is a media element.
 */
function isMediaNode(node: CanvasNode): boolean {
  return MEDIA_TYPES.has(node.type);
}

/**
 * Check if a node is a hero section.
 */
function isHeroSection(node: CanvasNode): boolean {
  return HERO_TYPES.has(node.type) || node.props.role === 'hero' || node.props.isHero === true;
}

/**
 * Get numeric prop value with fallback.
 */
function getNumericProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Inference: Funnel Intent
// ---------------------------------------------------------------------------

/**
 * Infer funnel intent from page structure.
 *
 * Analysis criteria:
 * - Presence of forms → optin/checkout
 * - CTA density → conversion-focused
 * - Text-to-action ratio → content vs action
 * - Hero presence → landing/content
 */
function inferFunnelIntent(page: Page): { intent: StepIntent; confidence: number } {
  const allNodes = flattenNodes(page.canvasRoot);
  
  // Count structural elements
  const ctaCount = allNodes.filter(isCTANode).length;
  const inputCount = allNodes.filter(isInputNode).length;
  const headlineCount = allNodes.filter(isHeadlineNode).length;
  const textCount = allNodes.filter(isTextNode).length;
  const hasHero = allNodes.some(isHeroSection);
  
  // If page type is already set, use it as strong signal
  if (page.type) {
    const typeIntentMap: Record<PageType, StepIntent> = {
      landing: 'content',
      optin: 'optin',
      appointment: 'checkout',
      thank_you: 'thank_you',
    };
    return { intent: typeIntentMap[page.type], confidence: 0.9 };
  }
  
  // If explicit layoutIntent is set, trust it
  if (page.layoutIntent) {
    return { intent: page.layoutIntent, confidence: 0.95 };
  }
  
  // Infer from structure
  let confidence = 0.5;
  
  // Strong opt-in signals: forms + single CTA
  if (inputCount >= 2 && ctaCount === 1) {
    return { intent: 'optin', confidence: 0.85 };
  }
  
  // Checkout signals: multiple inputs + prominent CTA
  if (inputCount >= 3 && ctaCount >= 1) {
    return { intent: 'checkout', confidence: 0.75 };
  }
  
  // Thank you signals: low action density, confirmation language
  if (ctaCount <= 1 && inputCount === 0 && textCount > 0) {
    confidence = 0.6;
    return { intent: 'thank_you', confidence };
  }
  
  // Content signals: high text ratio, hero presence
  if (hasHero && textCount > ctaCount * 2) {
    confidence = 0.7;
    return { intent: 'content', confidence };
  }
  
  // Default to content for ambiguous cases
  return { intent: 'content', confidence: 0.5 };
}

// ---------------------------------------------------------------------------
// Inference: Section Roles
// ---------------------------------------------------------------------------

/**
 * Infer the role of each section in the page.
 *
 * Roles:
 * - hero: Top section with headline + CTA
 * - body: Content-focused sections
 * - action: CTA-focused sections
 * - footer: Bottom sections with meta content
 * - feature: Sections highlighting features/benefits
 * - testimonial: Social proof sections
 */
function inferSectionRoles(page: Page): Map<string, SectionRole> {
  const roles = new Map<string, SectionRole>();
  const root = page.canvasRoot;
  
  // Only analyze direct children as sections
  const sections = root.children;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const flatNodes = flattenNodes(section);
    
    // Explicit hero type
    if (isHeroSection(section)) {
      roles.set(section.id, 'hero');
      continue;
    }
    
    // First section with headline + CTA = hero
    if (i === 0) {
      const hasHeadline = flatNodes.some(isHeadlineNode);
      const hasCTA = flatNodes.some(isCTANode);
      if (hasHeadline && hasCTA) {
        roles.set(section.id, 'hero');
        continue;
      }
    }
    
    // CTA-heavy sections = action
    const ctaCount = flatNodes.filter(isCTANode).length;
    const textCount = flatNodes.filter(isTextNode).length;
    if (ctaCount >= 2 || (ctaCount === 1 && textCount === 0)) {
      roles.set(section.id, 'action');
      continue;
    }
    
    // Last section = footer
    if (i === sections.length - 1 && textCount < 3) {
      roles.set(section.id, 'footer');
      continue;
    }
    
    // Media + text = feature
    const hasMedia = flatNodes.some(isMediaNode);
    if (hasMedia && textCount > 0) {
      roles.set(section.id, 'feature');
      continue;
    }
    
    // Default to body
    roles.set(section.id, 'body');
  }
  
  return roles;
}

// ---------------------------------------------------------------------------
// Inference: Layout Personality
// ---------------------------------------------------------------------------

/**
 * Infer likely layout personality from structure.
 *
 * Analysis criteria:
 * - Spacing density → dense vs clean
 * - CTA prominence → conversion vs editorial
 * - Headline scale → bold vs clean
 * - Content density → dense vs editorial
 */
function inferLayoutPersonality(page: Page): { personality: LayoutPersonality; confidence: number } {
  // If already set, return with high confidence
  if (page.layoutPersonality) {
    return { personality: page.layoutPersonality, confidence: 0.95 };
  }
  
  const layout = resolveFunnelLayout(page);
  const allNodes = flattenNodes(page.canvasRoot);
  
  // Count elements
  const ctaCount = allNodes.filter(isCTANode).length;
  const inputCount = allNodes.filter(isInputNode).length;
  const textCount = allNodes.filter(isTextNode).length;
  const headlineCount = allNodes.filter(isHeadlineNode).length;
  const totalNodes = allNodes.length;
  
  // Analyze spacing patterns
  const avgGap = calculateAverageGap(page.canvasRoot);
  const spacingDensity = avgGap < 20 ? 'dense' : avgGap > 35 ? 'spacious' : 'moderate';
  
  // CTA density
  const ctaDensity = totalNodes > 0 ? ctaCount / totalNodes : 0;
  
  // Content-to-CTA ratio
  const contentRatio = ctaCount > 0 ? textCount / ctaCount : textCount;
  
  let confidence = 0.5;
  
  // Conversion signals: high CTA density, forms present
  if (ctaDensity > 0.15 && inputCount > 0) {
    confidence = 0.75;
    return { personality: 'conversion', confidence };
  }
  
  // Editorial signals: high content ratio, spacious layout
  if (contentRatio > 4 && spacingDensity === 'spacious') {
    confidence = 0.7;
    return { personality: 'editorial', confidence };
  }
  
  // Dense signals: compact spacing, high node count
  if (spacingDensity === 'dense' && totalNodes > 15) {
    confidence = 0.65;
    return { personality: 'dense', confidence };
  }
  
  // Bold signals: hero present, large headlines
  const hasHero = allNodes.some(isHeroSection);
  if (hasHero && headlineCount > 0) {
    confidence = 0.6;
    return { personality: 'bold', confidence };
  }
  
  // Default to clean
  return { personality: 'clean', confidence: 0.55 };
}

/**
 * Calculate average gap across containers in the tree.
 */
function calculateAverageGap(root: CanvasNode): number {
  const gaps: number[] = [];
  
  function traverse(node: CanvasNode): void {
    if (node.children.length > 0) {
      const gap = getNumericProp(node.props, 'gap', 16);
      gaps.push(gap);
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  traverse(root);
  
  if (gaps.length === 0) return 16;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

// ---------------------------------------------------------------------------
// Inference: Hierarchy Confidence
// ---------------------------------------------------------------------------

/**
 * Calculate hierarchy confidence score.
 *
 * High confidence when:
 * - Clear headline → body → CTA flow
 * - Consistent spacing rhythm
 * - Logical section progression
 */
function calculateHierarchyConfidence(page: Page, sectionRoles: Map<string, SectionRole>): number {
  const allNodes = flattenNodes(page.canvasRoot);
  const sections = page.canvasRoot.children;
  
  let score = 0.5; // baseline
  
  // Has clear hero section
  const hasHero = Array.from(sectionRoles.values()).includes('hero');
  if (hasHero) score += 0.15;
  
  // Logical section progression (hero → body → action)
  const roleSequence = sections.map((s) => sectionRoles.get(s.id));
  if (roleSequence[0] === 'hero') score += 0.1;
  
  // Has headlines in sections
  const headlineCount = allNodes.filter(isHeadlineNode).length;
  const sectionCount = sections.length;
  if (headlineCount >= sectionCount * 0.5) score += 0.1;
  
  // Spacing consistency
  const gaps = sections.map((s) => getNumericProp(s.props, 'gap', 16));
  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + Math.abs(g - avgGap), 0) / gaps.length;
  const varianceRatio = avgGap > 0 ? variance / avgGap : 1;
  if (varianceRatio < 0.3) score += 0.15;
  
  return Math.min(1.0, score);
}

// ---------------------------------------------------------------------------
// AI Suggestion Generation
// ---------------------------------------------------------------------------

let aiSuggestionCounter = 0;

function generateAISuggestionId(directive: StructuralTransformDirective): string {
  aiSuggestionCounter += 1;
  return `ai-${directive}-${aiSuggestionCounter}-${Date.now()}`;
}

/**
 * Generate AI-powered structural suggestions.
 *
 * Max 2 suggestions per inference (Phase 30 requirement).
 */
function generateAISuggestions(
  page: Page,
  inference: Omit<StructuralInference, 'suggestions'>,
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  
  // Suggestion 1: Personality mismatch
  if (inference.personalityConfidence > 0.7 && page.layoutPersonality !== inference.likelyPersonality) {
    const confidence = inference.personalityConfidence;
    
    suggestions.push({
      id: generateAISuggestionId(`apply-${inference.likelyPersonality}-personality` as StructuralTransformDirective),
      type: 'hierarchy' as LayoutSuggestionType,
      category: 'composition',
      source: 'ai',
      confidence,
      message: `This structure would benefit from ${inference.likelyPersonality} personality.`,
      affectedNodeIds: [page.canvasRoot.id],
      recommendation: {
        token: '--layout-personality',
      },
      transformDirective: `apply-${inference.likelyPersonality}-personality` as StructuralTransformDirective,
    });
  }
  
  // Suggestion 2: Hierarchy improvement
  if (inference.hierarchyConfidence < 0.6) {
    const allNodes = flattenNodes(page.canvasRoot);
    const hasHeadlines = allNodes.some(isHeadlineNode);
    
    if (!hasHeadlines) {
      suggestions.push({
        id: generateAISuggestionId('add-visual-hierarchy'),
        type: 'hierarchy' as LayoutSuggestionType,
        category: 'composition',
        source: 'ai',
        confidence: 0.7,
        message: 'Adding headlines would improve visual hierarchy.',
        affectedNodeIds: page.canvasRoot.children.slice(0, 2).map((c) => c.id),
        recommendation: {
          token: '--hierarchy-improvement',
        },
        transformDirective: 'add-visual-hierarchy',
      });
    }
  }
  
  // Suggestion 3: Promote to hero
  const sectionRoles = inference.sectionRoles;
  const hasHero = Array.from(sectionRoles.values()).includes('hero');
  if (!hasHero && page.canvasRoot.children.length > 0) {
    const firstSection = page.canvasRoot.children[0];
    const flatNodes = flattenNodes(firstSection);
    const hasHeadline = flatNodes.some(isHeadlineNode);
    const hasCTA = flatNodes.some(isCTANode);
    
    if (hasHeadline && hasCTA) {
      suggestions.push({
        id: generateAISuggestionId('promote-to-hero'),
        type: 'cta-emphasis' as LayoutSuggestionType,
        category: 'composition',
        source: 'ai',
        confidence: 0.65,
        message: 'This section could be promoted to a hero section.',
        affectedNodeIds: [firstSection.id],
        recommendation: {
          token: '--promote-hero',
        },
        transformDirective: 'promote-to-hero',
      });
    }
  }
  
  // Suggestion 4: Normalize spacing
  const avgGap = calculateAverageGap(page.canvasRoot);
  const sections = page.canvasRoot.children;
  const gaps = sections.map((s) => getNumericProp(s.props, 'gap', 16));
  const variance = gaps.reduce((sum, g) => sum + Math.abs(g - avgGap), 0) / gaps.length;
  const varianceRatio = avgGap > 0 ? variance / avgGap : 0;
  
  if (varianceRatio > 0.4 && sections.length > 2) {
    suggestions.push({
      id: generateAISuggestionId('normalize-section-spacing'),
      type: 'spacing' as LayoutSuggestionType,
      category: 'composition',
      source: 'ai',
      confidence: 0.6,
      message: 'Normalizing section spacing would improve rhythm.',
      affectedNodeIds: sections.map((s) => s.id),
      recommendation: {
        token: '--normalize-spacing',
        delta: Math.round(avgGap),
      },
      transformDirective: 'normalize-section-spacing',
    });
  }
  
  // Suggestion 5: Improve CTA prominence (conversion-focused pages)
  if (inference.funnelIntent === 'optin' || inference.funnelIntent === 'checkout') {
    const allNodes = flattenNodes(page.canvasRoot);
    const ctaNodes = allNodes.filter(isCTANode);
    
    if (ctaNodes.length === 1) {
      // Single CTA should be prominent
      const personality = resolveLayoutPersonality(page.layoutPersonality ?? 'clean');
      const cta = ctaNodes[0];
      const expectedGap = personality.cta.minGap;
      
      suggestions.push({
        id: generateAISuggestionId('improve-cta-prominence'),
        type: 'cta-emphasis' as LayoutSuggestionType,
        category: 'composition',
        source: 'ai',
        confidence: 0.7,
        message: 'CTA could be more prominent for better conversions.',
        affectedNodeIds: [cta.id],
        recommendation: {
          token: '--cta-prominence',
          delta: expectedGap,
        },
        transformDirective: 'improve-cta-prominence',
      });
    }
  }
  
  // Filter by confidence threshold and limit to max 2
  return suggestions
    .filter((s) => s.confidence >= AI_SUGGESTION_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_AI_SUGGESTIONS);
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Perform full structural inference on a page.
 *
 * This is the main entry point for AI-powered structural analysis.
 * Called on:
 * - Page duplication
 * - Funnel import
 * - Paste / hydrate from legacy
 *
 * Returns at most 2 AI suggestions (Phase 30 requirement).
 */
export function analyzeStructure(page: Page): StructuralInference {
  // Infer funnel intent
  const { intent: funnelIntent, confidence: funnelIntentConfidence } = inferFunnelIntent(page);
  
  // Infer section roles
  const sectionRoles = inferSectionRoles(page);
  
  // Infer likely personality
  const { personality: likelyPersonality, confidence: personalityConfidence } =
    inferLayoutPersonality(page);
  
  // Calculate hierarchy confidence
  const hierarchyConfidence = calculateHierarchyConfidence(page, sectionRoles);
  
  // Generate AI suggestions
  const baseInference = {
    funnelIntent,
    funnelIntentConfidence,
    sectionRoles,
    likelyPersonality,
    personalityConfidence,
    hierarchyConfidence,
  };
  
  const suggestions = generateAISuggestions(page, baseInference);
  
  return {
    ...baseInference,
    suggestions,
  };
}

/**
 * Check if structural analysis should run.
 *
 * Run on:
 * - Page duplication
 * - Import/hydration
 * - Paste operations
 *
 * Don't run on:
 * - Every edit (too expensive)
 * - Small structural changes
 */
export function shouldRunStructuralAnalysis(actionType: string): boolean {
  const triggerActions = new Set([
    'HYDRATE_FROM_STORAGE',
    'DUPLICATE_PAGE',
    'IMPORT_PAGE',
    'PASTE_NODES',
  ]);
  
  return triggerActions.has(actionType);
}

/**
 * Apply personality from AI suggestion to page.
 *
 * This is a helper for the suggestion apply system.
 */
export function applyPersonalitySuggestion(
  page: Page,
  suggestion: AISuggestion,
): Partial<Page> {
  if (!suggestion.transformDirective?.startsWith('apply-')) {
    return {};
  }
  
  const personalityMatch = suggestion.transformDirective.match(/apply-(.+)-personality/);
  if (!personalityMatch) {
    return {};
  }
  
  const personality = personalityMatch[1] as LayoutPersonality;
  
  return {
    layoutPersonality: personality,
  };
}

/**
 * Apply structural transformation from AI suggestion.
 *
 * Returns node IDs that should be updated and their new props.
 */
export function applyStructuralTransform(
  page: Page,
  suggestion: AISuggestion,
): Map<string, Record<string, unknown>> {
  const changes = new Map<string, Record<string, unknown>>();
  
  if (!suggestion.transformDirective) {
    return changes;
  }
  
  switch (suggestion.transformDirective) {
    case 'normalize-section-spacing':
      if (suggestion.recommendation.delta) {
        const normalizedGap = suggestion.recommendation.delta;
        for (const nodeId of suggestion.affectedNodeIds) {
          changes.set(nodeId, { gap: normalizedGap });
        }
      }
      break;
      
    case 'promote-to-hero':
      // Change type to hero
      for (const nodeId of suggestion.affectedNodeIds) {
        changes.set(nodeId, { type: 'hero' });
      }
      break;
      
    case 'improve-cta-prominence':
      // Increase CTA weight and gap
      for (const nodeId of suggestion.affectedNodeIds) {
        changes.set(nodeId, {
          variant: 'primary',
          fontWeight: 700,
        });
      }
      break;
      
    default:
      // No direct node changes for personality or hierarchy suggestions
      break;
  }
  
  return changes;
}

/**
 * Get human-readable description of structural transformation.
 */
export function getTransformDescription(directive: StructuralTransformDirective): string {
  const descriptions: Record<StructuralTransformDirective, string> = {
    'apply-conversion-personality': 'Applied conversion-focused personality',
    'apply-editorial-personality': 'Applied editorial personality',
    'apply-bold-personality': 'Applied bold personality',
    'apply-clean-personality': 'Applied clean personality',
    'normalize-section-spacing': 'Normalized section spacing',
    'promote-to-hero': 'Promoted section to hero',
    'group-into-semantic-container': 'Grouped elements into container',
    'add-visual-hierarchy': 'Improved visual hierarchy',
    'improve-cta-prominence': 'Improved CTA prominence',
  };
  
  return descriptions[directive] ?? 'Applied structural transformation';
}
