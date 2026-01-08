/**
 * Phase 15: Runtime Page Route Component
 *
 * This is the route handler for /runtime/:documentId
 * It handles:
 * - Loading the document from persistence
 * - Error states (not found, not published, invalid snapshot)
 * - Rendering the published snapshot via RuntimeRenderer
 *
 * This component is fully decoupled from the editor and only imports:
 * - RuntimeRenderer (public renderer)
 * - Persistence functions (read-only)
 * - Type definitions
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { loadDocument } from '../state/multiDocPersistence';
import type { EditorDocument, PublishedDocumentSnapshot } from '../state/documentTypes';
import {
  RuntimeRenderer,
  RuntimeNotFound,
  RuntimeNotPublished,
  RuntimeInvalidSnapshot,
} from './RuntimeRenderer';
import './runtime.css';

// ============================================================================
// TYPES
// ============================================================================

type RuntimePageState =
  | { status: 'loading' }
  | { status: 'not-found'; documentId: string }
  | { status: 'not-published'; documentId: string }
  | { status: 'invalid-snapshot'; documentId: string; reason: string }
  | { status: 'ready'; snapshot: PublishedDocumentSnapshot };

// ============================================================================
// LOADING STATE
// ============================================================================

function RuntimeLoadingState() {
  return (
    <div className="runtime-loading-container">
      <div className="runtime-loading-state">
        <div className="runtime-loading-spinner" />
        <p className="runtime-loading-text">Loading...</p>
      </div>
    </div>
  );
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that a published snapshot has all required data for rendering.
 */
function validateSnapshot(
  snapshot: PublishedDocumentSnapshot | null | undefined,
): { valid: true } | { valid: false; reason: string } {
  if (!snapshot) {
    return { valid: false, reason: 'No published snapshot exists' };
  }

  if (typeof snapshot.version !== 'number') {
    return { valid: false, reason: 'Invalid snapshot version' };
  }

  if (!Array.isArray(snapshot.pages) || snapshot.pages.length === 0) {
    return { valid: false, reason: 'Snapshot contains no pages' };
  }

  if (typeof snapshot.activePageId !== 'string') {
    return { valid: false, reason: 'Invalid active page reference' };
  }

  if (typeof snapshot.publishedAt !== 'number') {
    return { valid: false, reason: 'Invalid publish timestamp' };
  }

  // Verify at least one page has a canvas root
  const hasRenderablePage = snapshot.pages.some(
    (page) => page.canvasRoot && typeof page.canvasRoot === 'object',
  );

  if (!hasRenderablePage) {
    return { valid: false, reason: 'No renderable pages in snapshot' };
  }

  return { valid: true };
}

// ============================================================================
// RUNTIME PAGE COMPONENT
// ============================================================================

/**
 * RuntimePage - Route handler for /runtime/:documentId
 *
 * Loads a document from persistence and renders its published snapshot.
 * Handles all error states gracefully.
 */
export function RuntimePage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [state, setState] = useState<RuntimePageState>({ status: 'loading' });

  useEffect(() => {
    // Reset to loading state when document ID changes
    setState({ status: 'loading' });

    // Handle missing document ID
    if (!documentId) {
      setState({ status: 'not-found', documentId: 'unknown' });
      return;
    }

    // Load document from persistence
    const document = loadDocument(documentId);

    // Document not found
    if (!document) {
      setState({ status: 'not-found', documentId });
      return;
    }

    // Document exists but never published
    if (!document.published) {
      setState({ status: 'not-published', documentId });
      return;
    }

    // Validate the published snapshot
    const validation = validateSnapshot(document.published);
    if (!validation.valid) {
      setState({
        status: 'invalid-snapshot',
        documentId,
        reason: (validation as { valid: false; reason: string }).reason,
      });
      return;
    }

    // All good - ready to render
    setState({ status: 'ready', snapshot: document.published });
  }, [documentId]);

  // Render based on current state
  switch (state.status) {
    case 'loading':
      return <RuntimeLoadingState />;

    case 'not-found':
      return <RuntimeNotFound documentId={state.documentId} />;

    case 'not-published':
      return <RuntimeNotPublished documentId={state.documentId} />;

    case 'invalid-snapshot':
      return (
        <RuntimeInvalidSnapshot
          documentId={state.documentId}
          reason={state.reason}
        />
      );

    case 'ready':
      return <RuntimeRenderer snapshot={state.snapshot} />;
  }
}

export default RuntimePage;
