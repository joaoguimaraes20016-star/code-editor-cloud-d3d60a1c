/**
 * Builder V2 Module Exports
 *
 * This is the main entry point for the Builder V2 editor.
 */

// Original single-document editor (preserved for backward compatibility)
export { EditorShell } from './EditorShell';
export { EditorProvider, useEditorStore } from './state/editorStore';
export type { EditorStoreContextValue } from './state/editorStore';

// Phase 13: Multi-document editor
export { MultiDocEditorShell } from './MultiDocEditorShell';
export { MultiDocumentProvider, useMultiDocumentStore } from './state/multiDocStore';
export type { MultiDocumentStoreContextValue } from './state/multiDocStore';

// Document types
export type {
  EditorDocument,
  EditorDocumentIndex,
  DocumentIndexEntry,
  // Phase 14: Published snapshot type
  PublishedDocumentSnapshot,
} from './state/documentTypes';

// Phase 14: Publishing helpers
export {
  createPublishedSnapshot,
  isDocumentPublished,
  getPublishedSnapshot,
} from './state/documentTypes';

// Canvas types
export type { CanvasNode, Page, PageType, EditorState, RuntimeState, LayoutPersonality } from './types';

// Canvas components
export { PreviewCanvas } from './canvas/PreviewCanvas';
export { renderTree } from './canvas/renderNode';
export type { RenderOptions } from './canvas/renderNode';

// Document Switcher UI component
export { DocumentSwitcher } from './components/DocumentSwitcher';

// Phase 27: Layout Personality System
export {
  resolveLayoutPersonality,
  getPersonalityVariables,
  generatePersonalityVariables,
  getPersonalityOptions,
  getPersonalityDisplayName,
  isValidPersonality,
  DEFAULT_PERSONALITY,
} from './layout/personalityResolver';
export type {
  ResolvedPersonality,
  SpacingRhythmTokens,
  TypographyScaleTokens,
  CTAEmphasisTokens,
  HeroPresenceTokens,
  MotionIntensityTokens,
  SuggestionSensitivityTokens,
} from './layout/personalityResolver';

// Phase 28: Component Creation Helpers
export {
  applyIntentDefaults,
  createNodeWithIntent,
  getCreationStructureDirective,
  hasIntentDefaults,
  getPersonalityGap,
  getPersonalityBlockGap,
  getPersonalityActionGap,
  getPersonalitySectionGap,
} from './registry/creationHelpers';
export type {
  IntentDefaultsContext,
  IntentDefaultsResult,
  IntentDefaultsFunction,
  AutoStructureDirective,
  ComponentCreationResult,
} from './registry/creationHelpers';

// Phase 37: Step Intent Resolver
export {
  resolveStepIntent,
  resolvePageIntent,
  generateIntentVariables,
  getInspectorSectionOrder,
  getInspectorCollapseHints,
  isValidStepIntent,
} from './layout/stepIntentResolver';
export type {
  IntentSignals,
  ResolvedStepIntent,
  IntentOrchestration,
} from './layout/stepIntentResolver';

// Phase 38: Visual Parity Lock — Layout Tokens
export {
  SPACING,
  HERO,
  CTA,
  MEDIA,
  VIEWPORT,
  INTERACTIVITY_MODE,
  RULE_0,
} from './layout/layoutTokens';
export type { InteractivityMode } from './layout/layoutTokens';
