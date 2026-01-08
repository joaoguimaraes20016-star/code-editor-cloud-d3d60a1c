/**
 * Template Intelligence Module
 *
 * Phase 31 — Template Intelligence & Structural Memory
 *
 * Pure heuristics for recognizing, matching, and adapting structural patterns
 * without exposing a template UI. This module enables the editor to improve
 * defaults through memory, not configuration.
 *
 * Philosophy:
 * - Recognize recurring structural patterns
 * - Adapt known patterns to new contexts
 * - Improve defaults through memory
 * - Preserve full user authorship
 *
 * This module answers questions like:
 * - "What structural pattern does this page follow?"
 * - "Is this similar to a known template?"
 * - "How should we adapt this structure?"
 *
 * No persistence. No UI. Pure inference.
 */

import type { CanvasNode, LayoutPersonality, Page, StepIntent } from '../types';
import type { LayoutSuggestion, LayoutSuggestionType } from './layoutIntelligence';
import type { CompositionSuggestion } from './compositionIntelligence';
import type { SectionRole } from './structuralIntelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structural fingerprint encoding a page's layout pattern.
 * Content-agnostic — focuses on hierarchy, spacing, and roles.
 */
export interface StructuralFingerprint {
  /** Unique hash derived from structural properties */
  hash: string;
  /** Number of top-level sections */
  sectionCount: number;
  /** Encoded section role sequence */
  roleSequence: SectionRole[];
  /** Normalized spacing ratios between sections */
  spacingRatios: number[];
  /** Depth distribution of the node tree */
  depthProfile: number[];
  /** Node type distribution (normalized counts) */
  typeDistribution: Map<string, number>;
  /** CTA position indices (normalized 0-1) */
  ctaPositions: number[];
  /** Headline position indices (normalized 0-1) */
  headlinePositions: number[];
  /** Inferred personality from structure */
  inferredPersonality: LayoutPersonality;
  /** Inferred intent from structure */
  inferredIntent: StepIntent;
}

/**
 * Known template pattern for matching.
 */
export interface TemplatePattern {
  /** Pattern identifier */
  id: string;
  /** Human-readable name (internal only) */
  name: string;
  /** Reference fingerprint */
  fingerprint: StructuralFingerprint;
  /** Ideal spacing values */
  idealSpacing: {
    sectionGap: number;
    blockGap: number;
    contentGap: number;
  };
  /** Suggested personality */
  suggestedPersonality: LayoutPersonality;
}

/**
 * Template match result.
 */
export interface TemplateMatch {
  /** Matched template pattern */
  template: TemplatePattern;
  /** Similarity score (0.0 to 1.0) */
  similarity: number;
  /** Specific differences detected */
  differences: TemplateDifference[];
}

/**
 * Detected difference from template.
 */
export interface TemplateDifference {
  type: 'spacing' | 'role' | 'structure' | 'personality';
  description: string;
  nodeIds?: string[];
  suggestion?: string;
}

/**
 * Template-aware suggestion extending CompositionSuggestion.
 * Phase 32: Extended with canApply and applyLabel for actionable suggestions.
 */
export interface TemplateSuggestion extends CompositionSuggestion {
  source: 'template';
  /** Matched template ID */
  templateId: string;
  /** Similarity score that triggered this suggestion */
  matchScore: number;
  /** Phase 32: Whether this suggestion can be applied directly */
  canApply: boolean;
  /** Phase 32: Label for the apply action button */
  applyLabel: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum similarity threshold for template matching.
 */
const SIMILARITY_THRESHOLD = 0.72;

/**
 * Node types considered as CTA elements.
 */
const CTA_TYPES = new Set(['button', 'cta', 'submit', 'link-button']);

/**
 * Node types considered as headlines.
 */
const HEADLINE_TYPES = new Set(['headline', 'heading', 'title', 'hero-headline', 'h1', 'h2', 'h3']);

/**
 * Node types considered as form inputs.
 */
const INPUT_TYPES = new Set(['input', 'textarea', 'select', 'form-field', 'form']);

/**
 * Node types that indicate hero sections.
 */
const HERO_TYPES = new Set(['hero', 'hero-section', 'banner']);

/**
 * Section role inference weights.
 */
const ROLE_WEIGHTS: Record<SectionRole, number> = {
  hero: 3,
  body: 1,
  action: 2,
  footer: 1,
  feature: 1.5,
  testimonial: 1.5,
};

// ---------------------------------------------------------------------------
// In-Memory Template Store
// ---------------------------------------------------------------------------

/**
 * In-memory store for known template patterns.
 * Populated with common funnel patterns.
 */
const KNOWN_TEMPLATES: TemplatePattern[] = [
  // Opt-in Template: Hero + Form + CTA
  {
    id: 'optin-standard',
    name: 'Standard Opt-in',
    fingerprint: {
      hash: 'optin-hero-form-cta',
      sectionCount: 2,
      roleSequence: ['hero', 'action'],
      spacingRatios: [1.0],
      depthProfile: [1, 2, 3],
      typeDistribution: new Map([
        ['hero', 0.2],
        ['headline', 0.15],
        ['text', 0.25],
        ['input', 0.2],
        ['button', 0.1],
        ['container', 0.1],
      ]),
      ctaPositions: [0.85],
      headlinePositions: [0.1],
      inferredPersonality: 'conversion',
      inferredIntent: 'optin',
    },
    idealSpacing: {
      sectionGap: 36,
      blockGap: 24,
      contentGap: 14,
    },
    suggestedPersonality: 'conversion',
  },
  // Content Page Template: Hero + Body sections + Footer
  {
    id: 'content-editorial',
    name: 'Editorial Content',
    fingerprint: {
      hash: 'content-hero-body-footer',
      sectionCount: 4,
      roleSequence: ['hero', 'body', 'body', 'footer'],
      spacingRatios: [1.0, 1.2, 1.0],
      depthProfile: [1, 2, 2, 3],
      typeDistribution: new Map([
        ['hero', 0.1],
        ['headline', 0.2],
        ['text', 0.4],
        ['image', 0.15],
        ['container', 0.15],
      ]),
      ctaPositions: [0.15, 0.9],
      headlinePositions: [0.05, 0.25, 0.5],
      inferredPersonality: 'editorial',
      inferredIntent: 'content',
    },
    idealSpacing: {
      sectionGap: 56,
      blockGap: 36,
      contentGap: 20,
    },
    suggestedPersonality: 'editorial',
  },
  // Landing Page Template: Hero + Features + CTA + Footer
  {
    id: 'landing-conversion',
    name: 'Conversion Landing',
    fingerprint: {
      hash: 'landing-hero-features-cta',
      sectionCount: 4,
      roleSequence: ['hero', 'feature', 'action', 'footer'],
      spacingRatios: [1.0, 0.9, 1.1],
      depthProfile: [1, 2, 3, 2],
      typeDistribution: new Map([
        ['hero', 0.15],
        ['headline', 0.15],
        ['text', 0.25],
        ['button', 0.15],
        ['image', 0.1],
        ['container', 0.2],
      ]),
      ctaPositions: [0.2, 0.7],
      headlinePositions: [0.1, 0.35, 0.6],
      inferredPersonality: 'bold',
      inferredIntent: 'content',
    },
    idealSpacing: {
      sectionGap: 48,
      blockGap: 32,
      contentGap: 16,
    },
    suggestedPersonality: 'bold',
  },
  // Checkout Template: Form-heavy + Single CTA
  {
    id: 'checkout-compact',
    name: 'Compact Checkout',
    fingerprint: {
      hash: 'checkout-form-action',
      sectionCount: 2,
      roleSequence: ['body', 'action'],
      spacingRatios: [1.0],
      depthProfile: [1, 2, 3, 3],
      typeDistribution: new Map([
        ['headline', 0.1],
        ['text', 0.15],
        ['input', 0.35],
        ['button', 0.1],
        ['container', 0.3],
      ]),
      ctaPositions: [0.9],
      headlinePositions: [0.05],
      inferredPersonality: 'clean',
      inferredIntent: 'checkout',
    },
    idealSpacing: {
      sectionGap: 32,
      blockGap: 24,
      contentGap: 12,
    },
    suggestedPersonality: 'clean',
  },
  // Thank You Template: Simple confirmation
  {
    id: 'thankyou-simple',
    name: 'Simple Thank You',
    fingerprint: {
      hash: 'thankyou-confirm',
      sectionCount: 1,
      roleSequence: ['hero'],
      spacingRatios: [],
      depthProfile: [1, 2],
      typeDistribution: new Map([
        ['headline', 0.3],
        ['text', 0.5],
        ['button', 0.1],
        ['container', 0.1],
      ]),
      ctaPositions: [0.8],
      headlinePositions: [0.15],
      inferredPersonality: 'clean',
      inferredIntent: 'thank_you',
    },
    idealSpacing: {
      sectionGap: 40,
      blockGap: 28,
      contentGap: 16,
    },
    suggestedPersonality: 'clean',
  },
];

// ---------------------------------------------------------------------------
// Node Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a node tree into depth-first array with depth info.
 */
function flattenWithDepth(node: CanvasNode, depth: number = 0): Array<{ node: CanvasNode; depth: number }> {
  const result: Array<{ node: CanvasNode; depth: number }> = [{ node, depth }];
  for (const child of node.children) {
    result.push(...flattenWithDepth(child, depth + 1));
  }
  return result;
}

/**
 * Get numeric prop value with fallback.
 */
function getNumericProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

/**
 * Check if node is CTA type.
 */
function isCTANode(node: CanvasNode): boolean {
  return CTA_TYPES.has(node.type) || node.props.variant === 'primary' || node.props.role === 'cta';
}

/**
 * Check if node is headline type.
 */
function isHeadlineNode(node: CanvasNode): boolean {
  return HEADLINE_TYPES.has(node.type) || node.props.variant === 'headline';
}

/**
 * Check if node is hero section.
 */
function isHeroSection(node: CanvasNode): boolean {
  return HERO_TYPES.has(node.type) || node.props.role === 'hero';
}

/**
 * Check if node is form input.
 */
function isInputNode(node: CanvasNode): boolean {
  return INPUT_TYPES.has(node.type);
}

// ---------------------------------------------------------------------------
// Fingerprint Generation
// ---------------------------------------------------------------------------

/**
 * Derive a structural fingerprint from a page.
 * Content-agnostic — normalizes for content differences.
 */
export function deriveFingerprint(page: Page): StructuralFingerprint {
  const root = page.canvasRoot;
  const flatNodes = flattenWithDepth(root);
  const totalNodes = flatNodes.length;
  
  // Section count and role sequence
  const sections = root.children;
  const sectionCount = sections.length;
  const roleSequence = sections.map((section) => inferSectionRole(section));
  
  // Spacing ratios (normalized)
  const spacingRatios = computeSpacingRatios(sections);
  
  // Depth profile
  const depthProfile = computeDepthProfile(flatNodes);
  
  // Type distribution (normalized)
  const typeDistribution = computeTypeDistribution(flatNodes);
  
  // CTA and headline positions (normalized 0-1)
  const ctaPositions = computeElementPositions(flatNodes, isCTANode);
  const headlinePositions = computeElementPositions(flatNodes, isHeadlineNode);
  
  // Infer personality and intent
  const inferredPersonality = inferPersonalityFromStructure(
    typeDistribution,
    spacingRatios,
    sectionCount
  );
  const inferredIntent = inferIntentFromStructure(
    typeDistribution,
    roleSequence,
    ctaPositions
  );
  
  // Generate hash from key structural properties
  const hash = generateStructuralHash(
    sectionCount,
    roleSequence,
    inferredIntent
  );
  
  return {
    hash,
    sectionCount,
    roleSequence,
    spacingRatios,
    depthProfile,
    typeDistribution,
    ctaPositions,
    headlinePositions,
    inferredPersonality,
    inferredIntent,
  };
}

/**
 * Infer section role from structure.
 */
function inferSectionRole(section: CanvasNode): SectionRole {
  const flatNodes = flattenWithDepth(section);
  const nodes = flatNodes.map((f) => f.node);
  
  // Explicit hero type
  if (isHeroSection(section)) {
    return 'hero';
  }
  
  // CTA-heavy = action
  const ctaCount = nodes.filter(isCTANode).length;
  const inputCount = nodes.filter(isInputNode).length;
  const textCount = nodes.filter((n) => n.type === 'text' || n.type === 'paragraph').length;
  
  if (ctaCount >= 2 || (ctaCount === 1 && textCount === 0)) {
    return 'action';
  }
  
  // Form-heavy with headline = hero
  if (inputCount >= 2 && nodes.some(isHeadlineNode)) {
    return 'hero';
  }
  
  // Has images/media = feature
  const hasMedia = nodes.some((n) => n.type === 'image' || n.type === 'video');
  if (hasMedia && textCount > 0) {
    return 'feature';
  }
  
  // Default to body
  return 'body';
}

/**
 * Compute normalized spacing ratios between sections.
 */
function computeSpacingRatios(sections: CanvasNode[]): number[] {
  if (sections.length < 2) return [];
  
  const gaps: number[] = [];
  for (const section of sections) {
    const gap = getNumericProp(section.props, 'gap', 16);
    gaps.push(gap);
  }
  
  // Normalize to average = 1.0
  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  if (avgGap === 0) return gaps.map(() => 1.0);
  
  return gaps.slice(0, -1).map((g) => g / avgGap);
}

/**
 * Compute depth profile (count of nodes at each depth level).
 */
function computeDepthProfile(flatNodes: Array<{ node: CanvasNode; depth: number }>): number[] {
  const depthCounts = new Map<number, number>();
  let maxDepth = 0;
  
  for (const { depth } of flatNodes) {
    depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
    maxDepth = Math.max(maxDepth, depth);
  }
  
  const profile: number[] = [];
  for (let d = 0; d <= maxDepth; d++) {
    profile.push(depthCounts.get(d) ?? 0);
  }
  
  return profile;
}

/**
 * Compute normalized type distribution.
 */
function computeTypeDistribution(
  flatNodes: Array<{ node: CanvasNode; depth: number }>
): Map<string, number> {
  const typeCounts = new Map<string, number>();
  const total = flatNodes.length;
  
  for (const { node } of flatNodes) {
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
  }
  
  // Normalize to fractions
  const distribution = new Map<string, number>();
  for (const [type, count] of typeCounts) {
    distribution.set(type, count / total);
  }
  
  return distribution;
}

/**
 * Compute normalized positions of elements matching predicate.
 */
function computeElementPositions(
  flatNodes: Array<{ node: CanvasNode; depth: number }>,
  predicate: (node: CanvasNode) => boolean
): number[] {
  const total = flatNodes.length;
  if (total === 0) return [];
  
  const positions: number[] = [];
  for (let i = 0; i < flatNodes.length; i++) {
    if (predicate(flatNodes[i].node)) {
      positions.push(i / total);
    }
  }
  
  return positions;
}

/**
 * Infer personality from structural properties.
 */
function inferPersonalityFromStructure(
  typeDistribution: Map<string, number>,
  spacingRatios: number[],
  sectionCount: number
): LayoutPersonality {
  const ctaRatio = typeDistribution.get('button') ?? 0;
  const inputRatio = typeDistribution.get('input') ?? 0;
  const textRatio = typeDistribution.get('text') ?? 0;
  
  // High CTA + inputs = conversion
  if (ctaRatio > 0.1 && inputRatio > 0.15) {
    return 'conversion';
  }
  
  // High text ratio = editorial
  if (textRatio > 0.35 && sectionCount > 2) {
    return 'editorial';
  }
  
  // Few sections, high CTA = bold
  if (sectionCount <= 2 && ctaRatio > 0.1) {
    return 'bold';
  }
  
  // Many sections, tight spacing = dense
  const avgRatio = spacingRatios.length > 0
    ? spacingRatios.reduce((s, r) => s + r, 0) / spacingRatios.length
    : 1.0;
  if (sectionCount > 4 && avgRatio < 0.9) {
    return 'dense';
  }
  
  return 'clean';
}

/**
 * Infer intent from structural properties.
 */
function inferIntentFromStructure(
  typeDistribution: Map<string, number>,
  roleSequence: SectionRole[],
  ctaPositions: number[]
): StepIntent {
  const inputRatio = typeDistribution.get('input') ?? 0;
  const ctaRatio = typeDistribution.get('button') ?? 0;
  const hasHero = roleSequence.includes('hero');
  
  // High inputs + single late CTA = optin
  if (inputRatio > 0.15 && ctaPositions.length === 1 && ctaPositions[0] > 0.7) {
    return 'optin';
  }
  
  // High inputs = checkout
  if (inputRatio > 0.25) {
    return 'checkout';
  }
  
  // Single section, no inputs, low CTA = thank_you
  if (roleSequence.length <= 1 && inputRatio === 0 && ctaRatio < 0.15) {
    return 'thank_you';
  }
  
  return 'content';
}

/**
 * Generate structural hash from key properties.
 */
function generateStructuralHash(
  sectionCount: number,
  roleSequence: SectionRole[],
  intent: StepIntent
): string {
  const roleStr = roleSequence.slice(0, 4).join('-');
  return `${intent}-${sectionCount}-${roleStr}`;
}

// ---------------------------------------------------------------------------
// Template Matching
// ---------------------------------------------------------------------------

/**
 * Compare two fingerprints and compute similarity score.
 */
export function computeSimilarity(
  a: StructuralFingerprint,
  b: StructuralFingerprint
): number {
  let score = 0;
  let weights = 0;
  
  // Section count similarity (weight: 2)
  const sectionDiff = Math.abs(a.sectionCount - b.sectionCount);
  const sectionSim = Math.max(0, 1 - sectionDiff / 4);
  score += sectionSim * 2;
  weights += 2;
  
  // Role sequence similarity (weight: 3)
  const roleSim = computeSequenceSimilarity(a.roleSequence, b.roleSequence);
  score += roleSim * 3;
  weights += 3;
  
  // Intent match (weight: 2)
  const intentSim = a.inferredIntent === b.inferredIntent ? 1 : 0.5;
  score += intentSim * 2;
  weights += 2;
  
  // Personality match (weight: 1)
  const personalitySim = a.inferredPersonality === b.inferredPersonality ? 1 : 0.6;
  score += personalitySim * 1;
  weights += 1;
  
  // Type distribution similarity (weight: 2)
  const typeSim = computeDistributionSimilarity(a.typeDistribution, b.typeDistribution);
  score += typeSim * 2;
  weights += 2;
  
  // CTA position similarity (weight: 1.5)
  const ctaSim = computePositionSimilarity(a.ctaPositions, b.ctaPositions);
  score += ctaSim * 1.5;
  weights += 1.5;
  
  // Depth profile similarity (weight: 1)
  const depthSim = computeArraySimilarity(a.depthProfile, b.depthProfile);
  score += depthSim * 1;
  weights += 1;
  
  return score / weights;
}

/**
 * Compute similarity between two role sequences.
 */
function computeSequenceSimilarity(a: SectionRole[], b: SectionRole[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const maxLen = Math.max(a.length, b.length);
  let matches = 0;
  let weightedMatches = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < maxLen; i++) {
    const roleA = a[i];
    const roleB = b[i];
    const weight = ROLE_WEIGHTS[roleA] ?? 1;
    
    if (roleA === roleB) {
      matches++;
      weightedMatches += weight;
    }
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedMatches / totalWeight : 0;
}

/**
 * Compute similarity between two type distributions.
 */
function computeDistributionSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  const allTypes = new Set([...a.keys(), ...b.keys()]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const type of allTypes) {
    const valA = a.get(type) ?? 0;
    const valB = b.get(type) ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Compute similarity between position arrays.
 */
function computePositionSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0.5;
  
  // Compare count and average positions
  const countRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  
  const avgA = a.reduce((s, p) => s + p, 0) / a.length;
  const avgB = b.reduce((s, p) => s + p, 0) / b.length;
  const posSim = 1 - Math.abs(avgA - avgB);
  
  return (countRatio + posSim) / 2;
}

/**
 * Compute similarity between numeric arrays.
 */
function computeArraySimilarity(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0.5;
  
  const maxLen = Math.max(a.length, b.length);
  let diffSum = 0;
  let maxVal = 1;
  
  for (let i = 0; i < maxLen; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    diffSum += Math.abs(valA - valB);
    maxVal = Math.max(maxVal, valA, valB);
  }
  
  return Math.max(0, 1 - diffSum / (maxLen * maxVal));
}

/**
 * Find best matching template for a fingerprint.
 */
export function findTemplateMatch(
  fingerprint: StructuralFingerprint,
  threshold: number = SIMILARITY_THRESHOLD
): TemplateMatch | null {
  let bestMatch: TemplateMatch | null = null;
  let bestScore = 0;
  
  for (const template of KNOWN_TEMPLATES) {
    const similarity = computeSimilarity(fingerprint, template.fingerprint);
    
    if (similarity >= threshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = {
        template,
        similarity,
        differences: detectDifferences(fingerprint, template),
      };
    }
  }
  
  return bestMatch;
}

/**
 * Detect specific differences from template.
 */
function detectDifferences(
  fingerprint: StructuralFingerprint,
  template: TemplatePattern
): TemplateDifference[] {
  const differences: TemplateDifference[] = [];
  const refFp = template.fingerprint;
  
  // Spacing differences
  const avgSpacing = fingerprint.spacingRatios.length > 0
    ? fingerprint.spacingRatios.reduce((s, r) => s + r, 0) / fingerprint.spacingRatios.length
    : 1.0;
  const refAvgSpacing = refFp.spacingRatios.length > 0
    ? refFp.spacingRatios.reduce((s, r) => s + r, 0) / refFp.spacingRatios.length
    : 1.0;
  
  if (Math.abs(avgSpacing - refAvgSpacing) > 0.2) {
    differences.push({
      type: 'spacing',
      description: 'Spacing rhythm differs from template',
      suggestion: `Apply ${template.name} spacing`,
    });
  }
  
  // Role sequence differences
  const roleMatch = computeSequenceSimilarity(fingerprint.roleSequence, refFp.roleSequence);
  if (roleMatch < 0.8) {
    differences.push({
      type: 'role',
      description: 'Section roles differ from template pattern',
      suggestion: 'Promote sections based on template',
    });
  }
  
  // Personality mismatch
  if (fingerprint.inferredPersonality !== template.suggestedPersonality) {
    differences.push({
      type: 'personality',
      description: `Structure suggests ${template.suggestedPersonality} personality`,
      suggestion: `Apply ${template.suggestedPersonality} personality`,
    });
  }
  
  return differences;
}

// ---------------------------------------------------------------------------
// Template-Aware Suggestions
// ---------------------------------------------------------------------------

let templateSuggestionCounter = 0;

function generateTemplateSuggestionId(templateId: string): string {
  templateSuggestionCounter += 1;
  return `template-${templateId}-${templateSuggestionCounter}-${Date.now()}`;
}

/**
 * Generate template-aware suggestion from match.
 * Returns at most 1 suggestion (Phase 31 requirement).
 * Phase 32: Now includes canApply and applyLabel for actionable suggestions.
 */
export function generateTemplateSuggestion(
  page: Page,
  match: TemplateMatch
): TemplateSuggestion | null {
  if (match.differences.length === 0) {
    return null;
  }
  
  // Prioritize differences
  const priorityOrder: TemplateDifference['type'][] = ['spacing', 'personality', 'role', 'structure'];
  const sortedDiffs = [...match.differences].sort(
    (a, b) => priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type)
  );
  
  const topDiff = sortedDiffs[0];
  
  // Generate suggestion based on difference type
  let suggestionType: LayoutSuggestionType = 'spacing';
  let message = topDiff.suggestion ?? 'Apply template pattern';
  
  switch (topDiff.type) {
    case 'spacing':
      suggestionType = 'spacing';
      message = `Apply ${match.template.name} spacing rhythm.`;
      break;
    case 'personality':
      suggestionType = 'hierarchy';
      message = `This structure matches ${match.template.name}. Consider ${match.template.suggestedPersonality} personality.`;
      break;
    case 'role':
      suggestionType = 'hierarchy';
      message = `Normalize structure to ${match.template.name} pattern.`;
      break;
    case 'structure':
      suggestionType = 'alignment';
      message = `Structure could align with ${match.template.name} template.`;
      break;
  }
  
  return {
    id: generateTemplateSuggestionId(match.template.id),
    type: suggestionType,
    category: 'composition',
    source: 'template',
    confidence: match.similarity,
    templateId: match.template.id,
    matchScore: match.similarity,
    // Phase 32: Actionable template suggestions
    canApply: true,
    applyLabel: `Apply ${match.template.name}`,
    message,
    affectedNodeIds: topDiff.nodeIds ?? [page.canvasRoot.id],
    recommendation: {
      token: `--template-${topDiff.type}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Analyze page for template matches and generate suggestion.
 *
 * This is the main entry point for template intelligence.
 * Called on hydration, duplication, paste operations.
 * Returns at most 1 suggestion (Phase 31 requirement).
 */
export function analyzeTemplateMatch(
  page: Page
): { fingerprint: StructuralFingerprint; suggestion: TemplateSuggestion | null } {
  // Derive fingerprint
  const fingerprint = deriveFingerprint(page);
  
  // Find best match
  const match = findTemplateMatch(fingerprint);
  
  // Generate suggestion if match found
  const suggestion = match ? generateTemplateSuggestion(page, match) : null;
  
  return { fingerprint, suggestion };
}

/**
 * Check if template analysis should run.
 */
export function shouldRunTemplateAnalysis(actionType: string): boolean {
  const triggerActions = new Set([
    'HYDRATE_FROM_STORAGE',
    'DUPLICATE_PAGE',
    'IMPORT_PAGE',
    'PASTE_NODES',
  ]);
  
  return triggerActions.has(actionType);
}

/**
 * Apply template spacing to page.
 * Returns node IDs and their new props.
 */
export function applyTemplateSpacing(
  page: Page,
  templateId: string
): Map<string, Record<string, unknown>> {
  const changes = new Map<string, Record<string, unknown>>();
  
  const template = KNOWN_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return changes;
  
  // Apply ideal spacing to root container
  changes.set(page.canvasRoot.id, {
    gap: template.idealSpacing.sectionGap,
  });
  
  // Apply block gap to sections
  for (const section of page.canvasRoot.children) {
    changes.set(section.id, {
      gap: template.idealSpacing.blockGap,
    });
  }
  
  return changes;
}

/**
 * Get template by ID.
 */
export function getTemplateById(templateId: string): TemplatePattern | undefined {
  return KNOWN_TEMPLATES.find((t) => t.id === templateId);
}
