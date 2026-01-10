/**
 * AI Layer Index
 *
 * Phase 25 — Silent Assistant Layer
 * Phase 26 — Suggestion Surfacing & One-Click Taste
 * Phase 29 — Guided Composition & Next-Best-Action
 * Phase 30 — AI Builder Assistant (Silent Structural Intelligence)
 *
 * This module provides AI-powered layout intelligence without exposing an AI UI.
 * The goal is to make Builder V2 feel smarter without being intrusive.
 *
 * Philosophy:
 * - AI should feel like taste, not a feature.
 * - If users notice "AI did this," we failed.
 * - If they think "this feels right," we succeeded.
 */

export {
  analyzeLayout,
  createLayoutContext,
  shouldRecomputeSuggestions,
  type LayoutContext,
  type LayoutSuggestion,
  type LayoutSuggestionType,
} from './layoutIntelligence';

export {
  applySuggestion,
  getSuggestionTypeLabel,
  getSuggestionIcon,
  type ApplyResult,
} from './suggestionApply';

// Phase 29: Composition Intelligence
export {
  analyzeComposition,
  createCompositionContext,
  isNodeInAffectedArea,
  clearSuggestionsForNode,
  shouldRecomputeComposition,
  mergeWithLayoutSuggestions,
  type CompositionSuggestion,
  type CompositionContext,
  type CompositionHeuristicId,
} from './compositionIntelligence';

// Phase 30: Structural Intelligence (AI Builder Assistant)
export {
  analyzeStructure,
  shouldRunStructuralAnalysis,
  applyPersonalitySuggestion,
  applyStructuralTransform,
  getTransformDescription,
  type AISuggestion,
  type StructuralInference,
  type StructuralTransformDirective,
  type SectionRole,
} from './structuralIntelligence';

// Phase 31: Template Intelligence & Structural Memory
export {
  deriveFingerprint,
  findTemplateMatch,
  computeSimilarity,
  analyzeTemplateMatch,
  shouldRunTemplateAnalysis,
  applyTemplateSpacing,
  generateTemplateSuggestion,
  getTemplateById,
  type StructuralFingerprint,
  type TemplatePattern,
  type TemplateMatch,
  type TemplateDifference,
  type TemplateSuggestion,
} from './templateIntelligence';

// Phase 32: Template Application & Soft Normalization
export {
  applyTemplate,
  previewTemplateApplication,
  describeTemplateChanges,
  isTemplateApplied,
  type TemplateApplicationResult,
} from './applyTemplate';
