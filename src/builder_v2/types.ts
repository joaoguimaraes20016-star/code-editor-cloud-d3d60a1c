/**
 * Canonical data contracts for the funnel builder.
 *
 * Invariants:
 * - Pages are created ONLY by explicit user action; never auto-generated or derived from content/steps.
 *   This prevents hidden duplication and keeps the editor/runtime in sync with user intent.
 * - CanvasNode is pure data (structure + props only), with no UI flags or runtime logic.
 *   Purity avoids render drift and guarantees identical interpretation across editor/runtime.
 * - EditorState and RuntimeState are intentionally separated to prevent UI state from
 *   influencing execution or data submission behavior.
 */

export type PageType = 'landing' | 'optin' | 'appointment' | 'thank_you';

/**
 * CanvasNode.type must map to a registered component key.
 * Rendering and inspector behavior are resolved via ComponentRegistry,
 * never via conditional logic in the canvas renderer.
 */
export interface CanvasNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: CanvasNode[];
}

export interface Page {
  id: string;
  name: string;
  type: PageType;
  /**
   * canvasRoot must always be a single root node.
   * Pages may not have multiple roots to ensure deterministic layout and rendering.
   */
  canvasRoot: CanvasNode;
}

/**
 * UI-only state for the editor surface.
 * Must never influence runtime funnel execution or submission logic.
 */
export interface EditorState {
  selectedPageId: string | null;
  selectedNodeId: string | null;
  mode: 'structure' | 'canvas' | 'preview';
}

/**
 * Execution-only state for the runtime funnel.
 * Must not reference editor concerns (selections, modes, etc.).
 */
export interface RuntimeState {
  currentPageId: string;
  answers: Record<string, any>;
  consentGiven: boolean;
}
