/**
 * Phase 13 & 14: Multi-Document Draft System Types
 *
 * Canonical types for managing multiple editor documents (projects).
 * This extends the single-document system to support Figma/Framer-like
 * multi-document workflows.
 *
 * Phase 14 adds Draft vs Published state model:
 * - Documents maintain a mutable draft state
 * - Publishing creates an immutable published snapshot
 * - Preview mode renders only the published snapshot
 * - Editing never mutates published state
 *
 * Invariants:
 * - Each document is independently versioned and persisted
 * - Document index tracks active document and document IDs only (not full content)
 * - At least one document must always exist
 * - Document switching resets undo/redo history
 * - Published snapshots are immutable once created
 * - Draft state remains unchanged by publish operations
 */

import type { Page } from '../types';

/**
 * Current document structure version.
 * Increment when making breaking changes to EditorDocument.
 */
export const DOCUMENT_VERSION = 1;

// ============================================================================
// PUBLISHED SNAPSHOT (Phase 14)
// ============================================================================

/**
 * An immutable snapshot of a published document.
 *
 * This represents the "frozen" output state that is rendered in preview mode
 * and will be used for public URLs, version history, etc.
 *
 * Invariants:
 * - Fully serializable (no functions, no circular refs)
 * - Immutable once created (deep-cloned from draft)
 * - Derived only from current draft state at publish time
 * - No references to draft objects
 */
export interface PublishedDocumentSnapshot {
  /** Version of the snapshot format (for future migrations) */
  version: number;
  /** Deep-cloned pages from the draft at publish time */
  pages: Page[];
  /** Active page ID at the time of publishing */
  activePageId: string;
  /** Timestamp when this snapshot was created (epoch ms) */
  publishedAt: number;
  /** Optional metadata for adapters (e.g., legacy runtime payloads) */
  metadata?: Record<string, unknown> | null;
}

// ============================================================================
// EDITOR DOCUMENT
// ============================================================================

/**
 * A complete editor document representing a funnel project.
 *
 * This is the canonical representation of a single document/project.
 * Each document contains its own set of pages and is persisted independently.
 *
 * Phase 14: Now includes optional published snapshot for draft vs published separation.
 */
export interface EditorDocument {
  /** Unique identifier for this document */
  id: string;
  /** User-facing document name */
  name: string;
  /** Structure version for migration support */
  version: number;
  /** All pages in this document (draft state) */
  pages: Page[];
  /** Currently active page ID within this document */
  activePageId: string;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
  /**
   * Published snapshot (Phase 14).
   * - undefined/null means "never published"
   * - When present, contains an immutable snapshot of the document
   * - Preview mode renders this, not the draft state
   */
  published?: PublishedDocumentSnapshot | null;
}

/**
 * Index of all documents in the editor.
 *
 * Stored separately from document content to enable:
 * - Fast document listing without loading full content
 * - Independent document persistence
 * - Clean document switching
 *
 * Storage key: builder_v2:index
 */
export interface EditorDocumentIndex {
  /** Currently active document ID */
  activeDocumentId: string;
  /** Map of document ID to document metadata (not full content) */
  documents: Record<string, DocumentIndexEntry>;
}

/**
 * Minimal document metadata stored in the index.
 * Full document content is loaded on-demand.
 */
export interface DocumentIndexEntry {
  id: string;
  name: string;
  updatedAt: number;
}

/**
 * Actions for document-level operations.
 * These operate at the document layer, above page/node operations.
 */
export type DocumentAction =
  | { type: 'CREATE_DOCUMENT'; document: EditorDocument }
  | { type: 'DELETE_DOCUMENT'; documentId: string }
  | { type: 'DUPLICATE_DOCUMENT'; sourceDocumentId: string; newDocument: EditorDocument }
  | { type: 'SET_ACTIVE_DOCUMENT'; documentId: string }
  | { type: 'RENAME_DOCUMENT'; documentId: string; newName: string }
  | { type: 'PUBLISH_DOCUMENT' }
  | { type: 'UNPUBLISH_DOCUMENT' };

/**
 * Generates a unique document ID.
 */
export function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a new empty document with default structure.
 */
export function createEmptyDocument(name: string = 'Untitled Document'): EditorDocument {
  const pageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  return {
    id: generateDocumentId(),
    name,
    version: DOCUMENT_VERSION,
    pages: [
      {
        id: pageId,
        name: 'Landing Page',
        type: 'landing',
        layoutIntent: 'content',
        canvasRoot: {
          id: 'root',
          type: 'container',
          props: { gap: 12 },
          children: [],
        },
      },
    ],
    activePageId: pageId,
    updatedAt: Date.now(),
  };
}

/**
 * Deep clones a document with new IDs.
 * Used for document duplication.
 */
export function cloneDocumentWithNewIds(
  source: EditorDocument,
  newName: string,
): EditorDocument {
  const newDocId = generateDocumentId();
  const idMap = new Map<string, string>();
  
  // Generate new IDs for all nodes
  function generateNewId(oldId: string, prefix: string = 'node'): string {
    const newId = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    idMap.set(oldId, newId);
    return newId;
  }
  
  // Clone canvas node tree with new IDs
  function cloneNode(node: import('../types').CanvasNode): import('../types').CanvasNode {
    const newId = generateNewId(node.id, node.type);
    return {
      id: newId,
      type: node.type,
      props: structuredClone ? structuredClone(node.props) : JSON.parse(JSON.stringify(node.props)),
      children: node.children.map(cloneNode),
    };
  }
  
  // Clone pages with new IDs
  const clonedPages = source.pages.map((page) => {
    const newPageId = generateNewId(page.id, 'page');
    return {
      id: newPageId,
      name: page.name,
      type: page.type,
      layoutIntent: page.layoutIntent,
      canvasRoot: cloneNode(page.canvasRoot),
    };
  });
  
  // Resolve new active page ID
  const newActivePageId = idMap.get(source.activePageId) ?? clonedPages[0]?.id;
  
  return {
    id: newDocId,
    name: newName,
    version: DOCUMENT_VERSION,
    pages: clonedPages,
    activePageId: newActivePageId,
    updatedAt: Date.now(),
  };
}

/**
 * Creates initial document index with a default document.
 */
export function createInitialDocumentIndex(defaultDocument: EditorDocument): EditorDocumentIndex {
  return {
    activeDocumentId: defaultDocument.id,
    documents: {
      [defaultDocument.id]: {
        id: defaultDocument.id,
        name: defaultDocument.name,
        updatedAt: defaultDocument.updatedAt,
      },
    },
  };
}

// ============================================================================
// PHASE 14: PUBLISHING HELPERS
// ============================================================================

/**
 * Deep clones an object using structuredClone with fallback to JSON.
 * Used to ensure published snapshots have no references to draft objects.
 */
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Creates a published snapshot from the current draft state.
 *
 * This function:
 * - Deep-clones all pages to ensure no references to draft
 * - Captures the active page ID at publish time
 * - Timestamps the snapshot
 *
 * Invariants:
 * - Returns a fully independent copy (no shared references)
 * - Does NOT modify the source document
 * - Pure function - no side effects
 */
export function createPublishedSnapshot(
  pages: Page[],
  activePageId: string,
  metadata?: Record<string, unknown> | null,
): PublishedDocumentSnapshot {
  const snapshot: PublishedDocumentSnapshot = {
    version: DOCUMENT_VERSION,
    pages: deepClone(pages),
    activePageId,
    publishedAt: Date.now(),
  };

  if (metadata && Object.keys(metadata).length > 0) {
    snapshot.metadata = deepClone(metadata);
  }

  return snapshot;
}

/**
 * Checks if a document has been published.
 * Returns true if a published snapshot exists.
 */
export function isDocumentPublished(document: EditorDocument): boolean {
  return document.published != null;
}

/**
 * Gets the published snapshot from a document.
 * Returns null if the document has never been published.
 */
export function getPublishedSnapshot(
  document: EditorDocument,
): PublishedDocumentSnapshot | null {
  return document.published ?? null;
}
