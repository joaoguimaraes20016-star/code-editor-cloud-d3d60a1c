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
 * Explicit intent for a funnel step. Drives layout + spacing decisions.
 */
export type StepIntent = 'optin' | 'content' | 'checkout' | 'thank_you';

/**
 * Phase 27: Layout Personality
 *
 * An opinionated but flexible taste layer that encodes design intent.
 * Controls spacing rhythm, typography scale, CTA emphasis, motion intensity,
 * and AI suggestion sensitivity without hardcoding styles.
 *
 * - clean: Minimal, breathable, generous whitespace (default)
 * - editorial: Magazine-like, strong hierarchy, reading-focused
 * - bold: High impact, attention-grabbing, confident spacing
 * - dense: Information-rich, compact, efficient use of space
 * - conversion: CTA-focused, urgency-driven, action-optimized
 */
export type LayoutPersonality = 'clean' | 'editorial' | 'bold' | 'dense' | 'conversion';

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
  /** Optional declarative layout intent. Derived from type when omitted. */
  layoutIntent?: StepIntent;
  /**
   * Phase 27: Layout Personality
   * Optional design taste layer that controls spacing, typography, emphasis, and motion.
   * Defaults to 'clean' when omitted.
   */
  layoutPersonality?: LayoutPersonality;
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
