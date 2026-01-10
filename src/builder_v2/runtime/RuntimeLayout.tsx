/**
 * RuntimeLayout centralizes layout constraints for runtime surfaces
 * without introducing any visual changes yet. It simply constrains
 * width, centers content, and provides hooks for future modes.
 *
 * Phase 27: Now includes personality variable injection for visual parity
 * with editor canvas.
 * 
 * Phase 37: Now includes step intent orchestration for behavioral parity
 * across editor, preview, and runtime.
 * 
 * Phase 38: Visual Parity Lock — locked spacing, canonical frame wrapper.
 */
import type { CSSProperties, ReactNode } from 'react';

import type { FunnelLayoutMetrics } from '../layout/funnelLayout';
import { generatePersonalityVariables } from '../layout/personalityResolver';
import { SPACING, INTERACTIVITY_MODE } from '../layout/layoutTokens';
import { 
  resolveStepIntent, 
  generateIntentVariables,
  type ResolvedStepIntent,
} from '../layout/stepIntentResolver';
import type { Page, StepIntent } from '../types';
import './runtime.css';
import '../styles/visual-parity.css';

export type RuntimeLayoutMode = 'editor' | 'preview' | 'runtime';

export interface RuntimeLayoutProps {
  children: ReactNode;
  mode?: RuntimeLayoutMode;
  layout?: FunnelLayoutMetrics;
  /** Page for intent resolution (Phase 37) */
  page?: Page;
  /** Explicit intent override */
  stepIntent?: StepIntent;
  /** Funnel position for intent inference */
  funnelPosition?: number;
  /** Total pages for intent inference */
  totalPages?: number;
  /** Whether to wrap in canonical frame (false if parent already provides it) */
  useCanonicalFrame?: boolean;
}

export function RuntimeLayout({ 
  children, 
  mode = 'runtime', 
  layout,
  page,
  stepIntent,
  funnelPosition,
  totalPages,
  useCanonicalFrame = false,
}: RuntimeLayoutProps) {
  const interactivity = INTERACTIVITY_MODE[mode] ?? INTERACTIVITY_MODE.runtime;
  
  // Phase 27: Generate personality CSS variables (DECORATIVE ONLY per Phase 38)
  const personalityVars = layout?.personality 
    ? generatePersonalityVariables(layout.personality)
    : {};

  // Phase 37: Resolve step intent for orchestration (DECORATIVE ONLY per Phase 38)
  let resolvedIntent: ResolvedStepIntent | null = null;
  if (page || stepIntent || layout?.intent) {
    resolvedIntent = resolveStepIntent({
      explicitIntent: stepIntent ?? page?.layoutIntent,
      pageType: page?.type ?? 'landing',
      personality: page?.layoutPersonality ?? layout?.personality?.personality,
      canvasRoot: page?.canvasRoot,
      funnelPosition,
      totalPages,
      mode,
    });
  }

  // Phase 37: Generate intent variables (DECORATIVE ONLY per Phase 38 — no geometry)
  const intentVars = resolvedIntent 
    ? generateIntentVariables(resolvedIntent, mode)
    : {};

  // Phase 38: LOCKED spacing values — ignore layout.spacing, use canonical values
  const geometryStyles: React.CSSProperties = {
    // Phase 38: LOCKED spacing (hard numbers only)
  } as React.CSSProperties;

  // Apply CSS custom properties via style attribute
  const cssVarStyles = {
    '--runtime-layout-max-width': `${layout?.maxWidth ?? 460}px`,
    '--funnel-section-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-block-gap': `${SPACING.BLOCK_GAP}px`,
    '--funnel-text-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-cta-gap': `${SPACING.CTA_GAP}px`,
    '--funnel-step-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-content-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-action-gap': `${SPACING.CTA_GAP}px`,
    ...personalityVars,
    ...intentVars,
  } as React.CSSProperties;

  const layoutContent = (
    <div
      className={`runtime-layout runtime-layout--${mode}`}
      data-width={layout?.width}
      data-intent={layout?.intent}
      data-step-intent={resolvedIntent?.intent}
      data-step-intent-source={resolvedIntent?.source}
      data-personality={layout?.personality?.personality}
      style={geometryStyles}
    >
      <div className="runtime-layout__scroll">
        <div className="runtime-layout__content">{children}</div>
      </div>
    </div>
  );

  // Phase 38: Canonical viewport frame structure (when useCanonicalFrame is true)
  if (useCanonicalFrame) {
    return (
      <div className="builder-root" data-mode={mode}>
        <div className="builder-canvas-frame">
          <div className="builder-page">
            {layoutContent}
          </div>
        </div>
      </div>
    );
  }

  return layoutContent;
}
