/**
 * Phase 38: Visual Parity Lock — Layout Tokens
 *
 * LOCKED spacing values. Do NOT override.
 * Intelligence layers (intent, personality, AI) MAY NOT change these values.
 *
 * @see Phase 38 spec: "One spacing system. No overrides."
 */

// ============================================================================
// LOCKED SPACING TOKENS — HARD NUMBERS ONLY
// ============================================================================

/**
 * Canonical spacing values for visual parity with Framer/Perspective.
 * These values are LOCKED. Do not apply multipliers or overrides.
 */
export const SPACING = {
  /** Gap between major sections */
  SECTION_GAP: 64,
  /** Gap between content blocks */
  BLOCK_GAP: 24,
  /** Gap between text elements */
  TEXT_GAP: 12,
  /** Gap around CTA elements */
  CTA_GAP: 32,
} as const;

/**
 * Hero section spacing constants.
 */
export const HERO = {
  /** Minimum height for hero sections */
  MIN_HEIGHT_VH: 85,
  /** Horizontal padding */
  PADDING_X: 24,
  /** Vertical padding */
  PADDING_Y: 64,
  /** Max width of hero content stack */
  STACK_MAX_WIDTH: 320,
  /** Gap between hero stack items */
  STACK_GAP: 24,
} as const;

/**
 * CTA styling constants.
 */
export const CTA = {
  /** Minimum width for primary CTAs */
  MIN_WIDTH: 240,
  /** Height for primary CTAs */
  HEIGHT: 48,
  /** Border radius */
  BORDER_RADIUS: 12,
  /** Font size */
  FONT_SIZE: 15,
  /** Font weight */
  FONT_WEIGHT: 600,
} as const;

/**
 * Media block constants.
 */
export const MEDIA = {
  /** Border radius for media containers */
  BORDER_RADIUS: 16,
} as const;

/**
 * Viewport frame constants (mobile-first).
 */
export const VIEWPORT = {
  /** Canvas frame width */
  WIDTH: 390,
  /** Frame border radius */
  BORDER_RADIUS: 24,
  /** Root padding */
  ROOT_PADDING_Y: 64,
} as const;

// ============================================================================
// INTERACTIVITY MODE (DOM PARITY)
// ============================================================================

/**
 * Interactivity modes for canvas/preview/runtime.
 * DOM structure must NOT change between modes — only behavior flags.
 */
export const INTERACTIVITY_MODE = {
  canvas: { editable: true, hoverGuides: true },
  preview: { editable: false, hoverGuides: false },
  runtime: { editable: false, hoverGuides: false },
} as const;

export type InteractivityMode = keyof typeof INTERACTIVITY_MODE;

// ============================================================================
// RULE_0 ENFORCEMENT — WHAT INTELLIGENCE MAY DO
// ============================================================================

/**
 * Phase 38 RULE_0: Intelligence layers (intent, personality, AI, suggestions)
 *
 * MAY NOT:
 * - Change layout geometry
 * - Change spacing units
 * - Change alignment rules
 * - Change viewport framing
 *
 * MAY ONLY:
 * - Adjust emphasis (opacity, scale ≤ 1.03, color)
 * - Toggle visibility
 */
export const RULE_0 = {
  /** Maximum scale factor intelligence may apply */
  MAX_SCALE: 1.03,
  /** Intelligence may adjust opacity */
  ALLOW_OPACITY: true,
  /** Intelligence may adjust color */
  ALLOW_COLOR: true,
  /** Intelligence may toggle visibility */
  ALLOW_VISIBILITY: true,
  /** Intelligence may NOT adjust spacing */
  ALLOW_SPACING: false,
  /** Intelligence may NOT adjust alignment */
  ALLOW_ALIGNMENT: false,
  /** Intelligence may NOT adjust geometry */
  ALLOW_GEOMETRY: false,
} as const;
