/**
 * Phase 14: Preview Canvas Component
 *
 * Renders the published snapshot in read-only preview mode.
 * This component:
 * - Only renders if a published snapshot exists
 * - Shows "Nothing published yet" empty state otherwise
 * - Renders pages from the published snapshot, not the draft
 * - Disables all interactions (selection, drag & drop)
 * 
 * Phase 37: Now includes step intent orchestration for behavioral parity
 * with editor canvas and runtime.
 * 
 * Phase 38: Visual Parity Lock — canonical frame wrapper for DOM parity.
 */

import type { PublishedDocumentSnapshot } from '../state/documentTypes';
import type { CSSProperties } from 'react';

import { resolveFunnelLayout } from '../layout/funnelLayout';
import { resolvePageIntent, generateIntentVariables } from '../layout/stepIntentResolver';
import { SPACING, INTERACTIVITY_MODE } from '../layout/layoutTokens';
import { RuntimeLayout } from '../runtime/RuntimeLayout';
import { StepBoundary } from '../runtime/StepBoundary';
import { StepStack } from '../runtime/StepStack';
import './canvas.css';
import '../styles/visual-parity.css';
import { renderTree } from './renderNode';

type PreviewCanvasProps = {
  /** The published snapshot to render, or null if never published */
  publishedSnapshot: PublishedDocumentSnapshot | null;
};

/**
 * Empty state shown when no published snapshot exists.
 */
function NothingPublishedState() {
  return (
    <div className="builder-v2-preview-empty">
      <div className="builder-v2-preview-empty-icon">📄</div>
      <h3 className="builder-v2-preview-empty-title">Nothing published yet</h3>
      <p className="builder-v2-preview-empty-description">
        Publish your document to see a preview of the live version.
      </p>
    </div>
  );
}

/**
 * Preview canvas that renders the published snapshot.
 * This is used when mode === 'preview' in the editor.
 * 
 * Phase 38: Uses canonical frame wrapper for DOM parity with canvas/runtime.
 */
export function PreviewCanvas({ publishedSnapshot }: PreviewCanvasProps) {
  const interactivity = INTERACTIVITY_MODE.preview;
  
  // No published snapshot - show empty state
  if (!publishedSnapshot) {
    return <NothingPublishedState />;
  }

  // Find the active page from the published snapshot
  const activePage = publishedSnapshot.pages.find(
    (page) => page.id === publishedSnapshot.activePageId,
  );

  // Fallback to first page if active page not found
  const pageToRender = activePage ?? publishedSnapshot.pages[0];

  if (!pageToRender?.canvasRoot) {
    return (
      <div className="builder-v2-preview-empty">
        <p>Published snapshot contains no pages.</p>
      </div>
    );
  }

  const layout = resolveFunnelLayout(pageToRender);
  
  // Phase 37: Resolve step intent for preview orchestration (DECORATIVE ONLY per Phase 38)
  const pageIndex = publishedSnapshot.pages.findIndex(p => p.id === pageToRender.id);
  const resolvedIntent = resolvePageIntent(pageToRender, {
    funnelPosition: pageIndex >= 0 ? pageIndex : undefined,
    totalPages: publishedSnapshot.pages.length,
    mode: 'preview',
  });
  const intentVars = generateIntentVariables(resolvedIntent, 'preview');

  // Phase 38: LOCKED spacing values
  const lockedSpacingVars = {
    '--funnel-section-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-block-gap': `${SPACING.BLOCK_GAP}px`,
    '--funnel-text-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-cta-gap': `${SPACING.CTA_GAP}px`,
    '--funnel-step-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-content-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-action-gap': `${SPACING.CTA_GAP}px`,
    ...intentVars,
  } as CSSProperties;

  // Phase 38: Canonical viewport frame structure (MUST be identical in canvas/preview/runtime)
  return (
    <div className="builder-root" data-mode="preview">
      <div className="builder-canvas-frame">
        <div 
          className="builder-page builder-v2-canvas builder-v2-canvas--preview"
          data-step-intent={resolvedIntent.intent}
          data-step-intent-source={resolvedIntent.source}
          style={lockedSpacingVars}
        >
          <div className="builder-v2-preview-header">
            <span className="builder-v2-preview-badge">Preview</span>
            <span className="builder-v2-preview-timestamp">
              Published: {new Date(publishedSnapshot.publishedAt).toLocaleString()}
            </span>
          </div>
          <div className="builder-v2-preview-content">
            <RuntimeLayout 
              mode="preview" 
              layout={layout}
              page={pageToRender}
              funnelPosition={pageIndex >= 0 ? pageIndex : undefined}
              totalPages={publishedSnapshot.pages.length}
            >
              <StepStack layout={layout} mode="preview">
                <StepBoundary motionMode="preview" stepId={pageToRender.id}>
                  {renderTree(pageToRender.canvasRoot, { readonly: !interactivity.editable })}
                </StepBoundary>
              </StepStack>
            </RuntimeLayout>
          </div>
        </div>
      </div>
    </div>
  );
}
