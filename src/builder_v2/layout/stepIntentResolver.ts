/**
 * Phase 37: Step Intent Resolver
 *
 * A pure function that infers step intent from multiple signals:
 * - Step/page metadata (explicit intent, page type)
 * - Component composition (CTAs, forms, hero presence)
 * - Funnel position (first, middle, last)
 * - Template intelligence hints
 *
 * Philosophy:
 * - Intent drives behavior across canvas, inspector, layout, and preview
 * - Steps should *feel* intentional, not generic
 * - No schema changes, no persistence — pure inference
 * - Stable output for identical inputs (deterministic)
 *
 * Output: A stable StepIntent enum that orchestrates rendering behavior.
 */

import type { CanvasNode, Page, PageType, StepIntent, LayoutPersonality } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Signals available for intent inference.
 */
export interface IntentSignals {
  /** Explicit layoutIntent if set */
  explicitIntent?: StepIntent;
  /** Page type for fallback inference */
  pageType: PageType;
  /** Layout personality for contextual tuning */
  personality?: LayoutPersonality;
  /** Canvas root for component composition analysis */
  canvasRoot?: CanvasNode;
  /** Position in funnel (0-indexed, -1 if unknown) */
  funnelPosition?: number;
  /** Total pages in funnel (-1 if unknown) */
  totalPages?: number;
  /** Template match hint from template intelligence */
  templateHint?: StepIntent;
  /** Mode context: editor, preview, or runtime */
  mode?: 'editor' | 'preview' | 'runtime';
}

/**
 * Resolved intent result with confidence and orchestration hints.
 */
export interface ResolvedStepIntent {
  /** The primary resolved intent */
  intent: StepIntent;
  /** Confidence in the inference (0.0 to 1.0) */
  confidence: number;
  /** Source of the inference for debugging */
  source: 'explicit' | 'pageType' | 'composition' | 'position' | 'template' | 'fallback';
  /** CSS variable prefix for intent-scoped styles */
  cssVarPrefix: string;
  /** Orchestration hints for downstream consumers */
  orchestration: IntentOrchestration;
}

/**
 * Orchestration hints that control rendering behavior.
 * These drive CSS variable injection without hardcoding styles.
 */
export interface IntentOrchestration {
  /** Focus bias: where the user's eye should be drawn */
  focusBias: 'top' | 'center' | 'bottom' | 'action';
  /** Spacing rhythm: tighter for conversion, looser for content */
  spacingRhythm: 'tight' | 'normal' | 'relaxed';
  /** CTA emphasis level */
  ctaEmphasis: 'subtle' | 'normal' | 'prominent';
  /** Inspector section ordering priority */
  inspectorPriority: Array<'content' | 'layout' | 'style'>;
  /** Whether to show composition guides in editor */
  showCompositionGuides: boolean;
  /** Motion intensity for transitions */
  motionIntensity: 'reduced' | 'normal' | 'enhanced';
  /** Hero presence expectation */
  heroExpected: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Node types considered as CTA elements.
 */
const CTA_TYPES = new Set(['button', 'cta', 'submit', 'link-button']);

/**
 * Node types considered as form input elements.
 */
const INPUT_TYPES = new Set(['input', 'textarea', 'select', 'form-field', 'form', 'form-group']);

/**
 * Node types considered as hero elements.
 */
const HERO_TYPES = new Set(['hero', 'hero-section', 'banner']);

/**
 * Node types considered as headline elements.
 */
const HEADLINE_TYPES = new Set(['headline', 'heading', 'title', 'h1', 'h2', 'h3']);

/**
 * Node types considered as scheduling/calendar elements.
 */
const SCHEDULE_TYPES = new Set(['calendar', 'calendly', 'schedule', 'booking', 'embed']);

/**
 * Page type to intent mapping (baseline).
 */
const PAGE_TYPE_INTENT_MAP: Record<PageType, StepIntent> = {
  landing: 'content',
  optin: 'optin',
  appointment: 'checkout',
  thank_you: 'thank_you',
};

/**
 * Intent-specific orchestration configurations.
 */
const INTENT_ORCHESTRATION: Record<StepIntent, IntentOrchestration> = {
  optin: {
    focusBias: 'action',
    spacingRhythm: 'tight',
    ctaEmphasis: 'prominent',
    inspectorPriority: ['content', 'style', 'layout'],
    showCompositionGuides: true,
    motionIntensity: 'normal',
    heroExpected: false,
  },
  content: {
    focusBias: 'top',
    spacingRhythm: 'relaxed',
    ctaEmphasis: 'subtle',
    inspectorPriority: ['content', 'layout', 'style'],
    showCompositionGuides: true,
    motionIntensity: 'normal',
    heroExpected: true,
  },
  checkout: {
    focusBias: 'center',
    spacingRhythm: 'normal',
    ctaEmphasis: 'prominent',
    inspectorPriority: ['content', 'style', 'layout'],
    showCompositionGuides: true,
    motionIntensity: 'reduced',
    heroExpected: false,
  },
  thank_you: {
    focusBias: 'center',
    spacingRhythm: 'relaxed',
    ctaEmphasis: 'subtle',
    inspectorPriority: ['content', 'style', 'layout'],
    showCompositionGuides: false,
    motionIntensity: 'enhanced',
    heroExpected: false,
  },
};

/**
 * Intent confidence weights for different inference sources.
 */
const CONFIDENCE_WEIGHTS = {
  explicit: 1.0,
  template: 0.85,
  composition: 0.75,
  position: 0.6,
  pageType: 0.5,
  fallback: 0.3,
};

// ============================================================================
// COMPOSITION ANALYSIS
// ============================================================================

interface CompositionMetrics {
  ctaCount: number;
  inputCount: number;
  heroPresent: boolean;
  headlineCount: number;
  schedulePresent: boolean;
  totalNodes: number;
  depth: number;
}

/**
 * Analyzes the component composition of a canvas tree.
 */
function analyzeComposition(node: CanvasNode | undefined): CompositionMetrics {
  const metrics: CompositionMetrics = {
    ctaCount: 0,
    inputCount: 0,
    heroPresent: false,
    headlineCount: 0,
    schedulePresent: false,
    totalNodes: 0,
    depth: 0,
  };

  if (!node) {
    return metrics;
  }

  function traverse(n: CanvasNode, currentDepth: number): void {
    metrics.totalNodes++;
    metrics.depth = Math.max(metrics.depth, currentDepth);

    const nodeType = n.type.toLowerCase();

    if (CTA_TYPES.has(nodeType)) {
      metrics.ctaCount++;
    }
    if (INPUT_TYPES.has(nodeType)) {
      metrics.inputCount++;
    }
    if (HERO_TYPES.has(nodeType)) {
      metrics.heroPresent = true;
    }
    if (HEADLINE_TYPES.has(nodeType)) {
      metrics.headlineCount++;
    }
    if (SCHEDULE_TYPES.has(nodeType)) {
      metrics.schedulePresent = true;
    }

    for (const child of n.children) {
      traverse(child, currentDepth + 1);
    }
  }

  traverse(node, 0);
  return metrics;
}

/**
 * Infers intent from component composition.
 */
function inferFromComposition(metrics: CompositionMetrics): StepIntent | null {
  // Strong signal: scheduling component present
  if (metrics.schedulePresent) {
    return 'checkout';
  }

  // Strong signal: form-heavy with inputs
  if (metrics.inputCount >= 2 || (metrics.inputCount >= 1 && metrics.ctaCount >= 1)) {
    return 'optin';
  }

  // Thank you pages typically have minimal interaction
  if (metrics.totalNodes > 0 && metrics.ctaCount === 0 && metrics.inputCount === 0) {
    // Small, simple structure suggests thank you
    if (metrics.totalNodes < 10 && metrics.depth < 4) {
      return 'thank_you';
    }
  }

  // Hero presence with headlines suggests content-focused
  if (metrics.heroPresent || metrics.headlineCount >= 2) {
    return 'content';
  }

  return null;
}

// ============================================================================
// POSITION ANALYSIS
// ============================================================================

/**
 * Infers intent from funnel position.
 */
function inferFromPosition(position: number, total: number): StepIntent | null {
  if (position < 0 || total <= 0) {
    return null;
  }

  const normalizedPosition = position / (total - 1 || 1);

  // First page is typically content/landing
  if (position === 0) {
    return 'content';
  }

  // Last page is typically thank you
  if (position === total - 1 && total > 1) {
    return 'thank_you';
  }

  // Middle pages lean toward optin/collection
  if (normalizedPosition > 0.3 && normalizedPosition < 0.7) {
    return 'optin';
  }

  // Near-end pages lean toward checkout/scheduling
  if (normalizedPosition >= 0.7) {
    return 'checkout';
  }

  return null;
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolves step intent from multiple signals.
 * 
 * Priority order:
 * 1. Explicit intent (if set by user)
 * 2. Template intelligence hint
 * 3. Component composition analysis
 * 4. Funnel position inference
 * 5. Page type fallback
 * 6. Default fallback
 */
export function resolveStepIntent(signals: IntentSignals): ResolvedStepIntent {
  // Priority 1: Explicit intent
  if (signals.explicitIntent) {
    return createResult(
      signals.explicitIntent,
      CONFIDENCE_WEIGHTS.explicit,
      'explicit'
    );
  }

  // Priority 2: Template hint
  if (signals.templateHint) {
    return createResult(
      signals.templateHint,
      CONFIDENCE_WEIGHTS.template,
      'template'
    );
  }

  // Priority 3: Composition analysis
  const metrics = analyzeComposition(signals.canvasRoot);
  const compositionIntent = inferFromComposition(metrics);
  if (compositionIntent) {
    return createResult(
      compositionIntent,
      CONFIDENCE_WEIGHTS.composition,
      'composition'
    );
  }

  // Priority 4: Position analysis
  if (signals.funnelPosition !== undefined && signals.totalPages !== undefined) {
    const positionIntent = inferFromPosition(signals.funnelPosition, signals.totalPages);
    if (positionIntent) {
      return createResult(
        positionIntent,
        CONFIDENCE_WEIGHTS.position,
        'position'
      );
    }
  }

  // Priority 5: Page type fallback
  const pageTypeIntent = PAGE_TYPE_INTENT_MAP[signals.pageType];
  if (pageTypeIntent) {
    return createResult(
      pageTypeIntent,
      CONFIDENCE_WEIGHTS.pageType,
      'pageType'
    );
  }

  // Priority 6: Default fallback
  return createResult('content', CONFIDENCE_WEIGHTS.fallback, 'fallback');
}

/**
 * Creates a resolved intent result with orchestration hints.
 */
function createResult(
  intent: StepIntent,
  confidence: number,
  source: ResolvedStepIntent['source']
): ResolvedStepIntent {
  return {
    intent,
    confidence,
    source,
    cssVarPrefix: `--step-intent-${intent}`,
    orchestration: INTENT_ORCHESTRATION[intent],
  };
}

// ============================================================================
// CSS VARIABLE GENERATION
// ============================================================================

/**
 * Generates CSS variables for intent-driven orchestration.
 * 
 * Phase 38: RULE_0 compliance — these variables are DECORATIVE ONLY.
 * They may control emphasis (opacity, scale ≤ 1.03, color) but NOT:
 * - Layout geometry
 * - Spacing units
 * - Alignment rules
 * - Viewport framing
 */
export function generateIntentVariables(
  resolved: ResolvedStepIntent,
  mode: 'editor' | 'preview' | 'runtime' = 'editor'
): Record<string, string> {
  const { intent, orchestration } = resolved;
  const isRuntime = mode === 'runtime';

  // Focus bias positioning — DECORATIVE (affects visual emphasis, not geometry)
  const focusBiasMap: Record<typeof orchestration.focusBias, string> = {
    top: '-5%',
    center: '0%',
    bottom: '5%',
    action: '8%',
  };

  // Phase 38: Spacing rhythm multipliers DISABLED for geometry
  // These are preserved for decorative opacity/emphasis only
  // All actual spacing uses LOCKED values from layoutTokens.ts
  const spacingMap: Record<typeof orchestration.spacingRhythm, string> = {
    tight: '1',    // LOCKED: no rhythm adjustment
    normal: '1',   // LOCKED: no rhythm adjustment
    relaxed: '1',  // LOCKED: no rhythm adjustment
  };

  // CTA emphasis scales — DECORATIVE (scale ≤ 1.03 per RULE_0)
  const ctaEmphasisMap: Record<typeof orchestration.ctaEmphasis, string> = {
    subtle: '0.97',
    normal: '1',
    prominent: '1.03',  // RULE_0: max scale is 1.03
  };

  // Motion intensity (reduced in runtime for calmer experience) — DECORATIVE
  const motionMap: Record<typeof orchestration.motionIntensity, string> = {
    reduced: isRuntime ? '0.6' : '0.7',
    normal: isRuntime ? '0.85' : '1',
    enhanced: isRuntime ? '1' : '1.2',
  };

  return {
    '--step-intent': intent,
    '--step-intent-focus-bias': focusBiasMap[orchestration.focusBias],
    // Phase 38: Spacing rhythm LOCKED to 1 (RULE_0)
    '--step-intent-spacing-rhythm': spacingMap[orchestration.spacingRhythm],
    '--step-intent-cta-emphasis': ctaEmphasisMap[orchestration.ctaEmphasis],
    '--step-intent-motion-intensity': motionMap[orchestration.motionIntensity],
    '--step-intent-hero-expected': orchestration.heroExpected ? '1' : '0',
    '--step-intent-show-guides': orchestration.showCompositionGuides ? '1' : '0',
    // Phase 38: Gap scale vars LOCKED to 1 (RULE_0 — no geometry changes)
    '--step-intent-block-gap-scale': '1',
    '--step-intent-action-gap-scale': '1',
    '--step-intent-content-gap-scale': '1',
  };
}

/**
 * Resolves intent from a Page object (convenience wrapper).
 */
export function resolvePageIntent(page: Page, options?: {
  funnelPosition?: number;
  totalPages?: number;
  templateHint?: StepIntent;
  mode?: 'editor' | 'preview' | 'runtime';
}): ResolvedStepIntent {
  return resolveStepIntent({
    explicitIntent: page.layoutIntent,
    pageType: page.type,
    personality: page.layoutPersonality,
    canvasRoot: page.canvasRoot,
    funnelPosition: options?.funnelPosition,
    totalPages: options?.totalPages,
    templateHint: options?.templateHint,
    mode: options?.mode,
  });
}

// ============================================================================
// INSPECTOR SECTION ORDERING
// ============================================================================

/**
 * Returns the ordered section IDs based on step intent.
 * Sections are not removed, only reordered for relevance.
 */
export function getInspectorSectionOrder(intent: StepIntent): Array<'content' | 'layout' | 'style'> {
  return INTENT_ORCHESTRATION[intent].inspectorPriority;
}

/**
 * Returns section collapse hints based on step intent.
 * Returns which sections should start collapsed (but not hidden).
 */
export function getInspectorCollapseHints(intent: StepIntent): Record<string, boolean> {
  // For optin/checkout, style is less immediately important
  // For content, layout might be secondary to content itself
  switch (intent) {
    case 'optin':
      return { content: false, layout: false, style: true };
    case 'checkout':
      return { content: false, layout: true, style: true };
    case 'content':
      return { content: false, layout: false, style: false };
    case 'thank_you':
      return { content: false, layout: true, style: false };
    default:
      return { content: false, layout: false, style: false };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Type guard for valid StepIntent values.
 */
export function isValidStepIntent(value: unknown): value is StepIntent {
  return (
    typeof value === 'string' &&
    ['optin', 'content', 'checkout', 'thank_you'].includes(value)
  );
}
