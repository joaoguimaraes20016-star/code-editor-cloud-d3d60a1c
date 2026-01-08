export const editorModes = ['structure', 'canvas', 'preview'] as const;

export type EditorMode = (typeof editorModes)[number];

/**
 * Phase 33: Guided Modes & Progressive Disclosure
 *
 * Framer/Perspective-style authoring modes that progressively reveal complexity
 * and guide user intent without changing data models, runtime behavior, or editor capabilities.
 *
 * - Build: Structure-focused, tree visible, spacing guides, structure/template suggestions
 * - Refine: Layout/style-focused, tree faded, composition guides, layout suggestions
 * - Convert: CTA-focused, tree minimized, action zones emphasized, conversion suggestions
 *
 * Stored in editor state only. NOT persisted. Defaults to 'build'.
 */
export const guidedModes = ['build', 'refine', 'convert'] as const;

export type GuidedMode = (typeof guidedModes)[number];

/**
 * Default guided mode on editor load.
 */
export const DEFAULT_GUIDED_MODE: GuidedMode = 'build';

/**
 * Map guided mode to suggestion intent filters.
 * Each mode only surfaces suggestions matching its intent category.
 */
export const GUIDED_MODE_SUGGESTION_INTENTS: Record<GuidedMode, Set<string>> = {
  build: new Set(['structure', 'template', 'hierarchy', 'spacing']),
  refine: new Set(['layout', 'composition', 'alignment', 'readability']),
  convert: new Set(['conversion', 'cta', 'cta-emphasis', 'action']),
};

/**
 * Inspector section visibility per guided mode.
 * True = visible/emphasized, false = de-emphasized (not hidden).
 */
export const GUIDED_MODE_INSPECTOR_SECTIONS: Record<GuidedMode, { content: boolean; layout: boolean; style: boolean; cta: boolean }> = {
  build: { content: true, layout: false, style: false, cta: false },
  refine: { content: false, layout: true, style: true, cta: false },
  convert: { content: false, layout: false, style: false, cta: true },
};
