/**
 * Phase 13: Multi-Document Persistence
 *
 * This module extends Phase 12's single-document persistence to support
 * multiple documents. Each document is persisted independently with its
 * own storage key, and an index tracks all documents.
 *
 * Storage Strategy:
 * - builder_v2:index - Document index (IDs, names, active document)
 * - builder_v2:doc:{documentId} - Individual document content
 *
 * Invariants:
 * - Index stores only metadata, not full document content
 * - Documents are loaded on-demand when switching
 * - Invalid documents are ignored (not loaded)
 * - At least one document always exists
 */

import type { Page } from '../types';
import {
  createEmptyDocument,
  createInitialDocumentIndex,
  DOCUMENT_VERSION,
  type DocumentIndexEntry,
  type EditorDocument,
  type EditorDocumentIndex,
} from './documentTypes';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const INDEX_STORAGE_KEY = 'builder_v2:index';
const DOC_STORAGE_KEY_PREFIX = 'builder_v2:doc:';

/**
 * Generates storage key for a specific document.
 */
function getDocumentStorageKey(documentId: string): string {
  return `${DOC_STORAGE_KEY_PREFIX}${documentId}`;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates document index structure.
 */
function isValidDocumentIndex(value: unknown): value is EditorDocumentIndex {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.activeDocumentId !== 'string') {
    return false;
  }

  if (typeof obj.documents !== 'object' || obj.documents === null) {
    return false;
  }

  const documents = obj.documents as Record<string, unknown>;

  // Validate at least one document exists
  const documentIds = Object.keys(documents);
  if (documentIds.length === 0) {
    return false;
  }

  // Validate each document entry
  for (const entry of Object.values(documents)) {
    if (!isValidDocumentIndexEntry(entry)) {
      return false;
    }
  }

  // Validate activeDocumentId references existing document
  if (!(obj.activeDocumentId in documents)) {
    console.warn('[MultiDocPersistence] activeDocumentId references non-existent document');
    return false;
  }

  return true;
}

/**
 * Validates document index entry structure.
 */
function isValidDocumentIndexEntry(value: unknown): value is DocumentIndexEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.updatedAt === 'number'
  );
}

/**
 * Validates a full document structure.
 */
function isValidDocument(value: unknown): value is EditorDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required string fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  // Version check
  if (typeof obj.version !== 'number' || obj.version !== DOCUMENT_VERSION) {
    console.warn(
      `[MultiDocPersistence] Document version mismatch: stored=${obj.version}, current=${DOCUMENT_VERSION}`,
    );
    return false;
  }

  // Validate pages array
  if (!Array.isArray(obj.pages) || obj.pages.length === 0) {
    return false;
  }

  // Validate each page
  for (const page of obj.pages) {
    if (!isValidPage(page)) {
      return false;
    }
  }

  // Validate activePageId
  if (typeof obj.activePageId !== 'string') {
    return false;
  }

  // Ensure activePageId references an existing page
  const pageIds = new Set(obj.pages.map((p: Page) => p.id));
  if (!pageIds.has(obj.activePageId)) {
    console.warn('[MultiDocPersistence] activePageId references non-existent page');
    return false;
  }

  // Validate updatedAt
  if (typeof obj.updatedAt !== 'number') {
    return false;
  }

  // Phase 14: Validate published snapshot if present
  // published is optional (undefined or null means never published)
  if (obj.published !== undefined && obj.published !== null) {
    if (!isValidPublishedSnapshot(obj.published, pageIds)) {
      console.warn('[MultiDocPersistence] Invalid published snapshot');
      return false;
    }
  }

  return true;
}

/**
 * Phase 14: Validates a published snapshot structure.
 */
function isValidPublishedSnapshot(
  value: unknown,
  validPageIds?: Set<string>,
): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Version check
  if (typeof obj.version !== 'number') {
    return false;
  }

  // Validate pages array
  if (!Array.isArray(obj.pages) || obj.pages.length === 0) {
    return false;
  }

  // Validate each page in snapshot
  for (const page of obj.pages) {
    if (!isValidPage(page)) {
      return false;
    }
  }

  // Validate activePageId
  if (typeof obj.activePageId !== 'string') {
    return false;
  }

  // Ensure activePageId references a page in the snapshot
  const snapshotPageIds = new Set(obj.pages.map((p: Page) => p.id));
  if (!snapshotPageIds.has(obj.activePageId)) {
    return false;
  }

  // Validate publishedAt timestamp
  if (typeof obj.publishedAt !== 'number') {
    return false;
  }

  return true;
}

/**
 * Validates a page structure.
 */
function isValidPage(value: unknown): value is Page {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  if (!['landing', 'optin', 'appointment', 'thank_you'].includes(obj.type as string)) {
    return false;
  }

  if (
    typeof obj.layoutIntent !== 'undefined' &&
    obj.layoutIntent !== null &&
    !['optin', 'content', 'checkout', 'thank_you'].includes(obj.layoutIntent as string)
  ) {
    return false;
  }

  if (!isValidCanvasNode(obj.canvasRoot)) {
    return false;
  }

  return true;
}

/**
 * Recursively validates a canvas node structure.
 */
function isValidCanvasNode(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.type !== 'string' || obj.type.length === 0) {
    return false;
  }

  if (typeof obj.props !== 'object' || obj.props === null) {
    return false;
  }

  if (!Array.isArray(obj.children)) {
    return false;
  }

  for (const child of obj.children) {
    if (!isValidCanvasNode(child)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// INDEX OPERATIONS
// ============================================================================

/**
 * Saves the document index to localStorage.
 */
export function saveDocumentIndex(index: EditorDocumentIndex): boolean {
  try {
    const serialized = JSON.stringify(index);
    localStorage.setItem(INDEX_STORAGE_KEY, serialized);
    console.debug('[MultiDocPersistence] Index saved');
    return true;
  } catch (error) {
    console.error('[MultiDocPersistence] Failed to save index:', error);
    return false;
  }
}

/**
 * Loads the document index from localStorage.
 * Returns null if no index exists or validation fails.
 */
export function loadDocumentIndex(): EditorDocumentIndex | null {
  try {
    const raw = localStorage.getItem(INDEX_STORAGE_KEY);
    
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isValidDocumentIndex(parsed)) {
      console.warn('[MultiDocPersistence] Invalid index structure, ignoring');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[MultiDocPersistence] Failed to load index:', error);
    return null;
  }
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Saves a document to localStorage.
 */
export function saveDocument(document: EditorDocument): boolean {
  try {
    const key = getDocumentStorageKey(document.id);
    const serialized = JSON.stringify(document);
    localStorage.setItem(key, serialized);
    console.debug(`[MultiDocPersistence] Document "${document.name}" saved`);
    return true;
  } catch (error) {
    console.error('[MultiDocPersistence] Failed to save document:', error);
    return false;
  }
}

/**
 * Loads a document from localStorage by ID.
 * Returns null if document doesn't exist or validation fails.
 */
export function loadDocument(documentId: string): EditorDocument | null {
  try {
    const key = getDocumentStorageKey(documentId);
    const raw = localStorage.getItem(key);

    if (!raw) {
      console.warn(`[MultiDocPersistence] Document ${documentId} not found`);
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isValidDocument(parsed)) {
      console.warn(`[MultiDocPersistence] Invalid document structure for ${documentId}`);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(`[MultiDocPersistence] Failed to load document ${documentId}:`, error);
    return null;
  }
}

/**
 * Deletes a document from localStorage.
 */
export function deleteDocumentFromStorage(documentId: string): boolean {
  try {
    const key = getDocumentStorageKey(documentId);
    localStorage.removeItem(key);
    console.debug(`[MultiDocPersistence] Document ${documentId} deleted`);
    return true;
  } catch (error) {
    console.error(`[MultiDocPersistence] Failed to delete document ${documentId}:`, error);
    return false;
  }
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Loads the complete multi-document state.
 * Returns the index and the active document.
 * Falls back to creating initial state if nothing is stored.
 */
export function loadMultiDocumentState(): {
  index: EditorDocumentIndex;
  activeDocument: EditorDocument;
} {
  const index = loadDocumentIndex();

  if (!index) {
    // No index found, create initial state
    console.debug('[MultiDocPersistence] No index found, creating initial state');
    const defaultDoc = createEmptyDocument('My First Funnel');
    const newIndex = createInitialDocumentIndex(defaultDoc);
    
    // Persist initial state
    saveDocumentIndex(newIndex);
    saveDocument(defaultDoc);
    
    return { index: newIndex, activeDocument: defaultDoc };
  }

  // Try to load active document
  let activeDocument = loadDocument(index.activeDocumentId);

  if (!activeDocument) {
    // Active document is invalid, try to find another valid document
    console.warn('[MultiDocPersistence] Active document invalid, finding fallback');
    
    for (const docId of Object.keys(index.documents)) {
      const doc = loadDocument(docId);
      if (doc) {
        activeDocument = doc;
        // Update index with new active document
        index.activeDocumentId = doc.id;
        saveDocumentIndex(index);
        break;
      }
    }
  }

  if (!activeDocument) {
    // All documents are invalid, create fresh state
    console.warn('[MultiDocPersistence] All documents invalid, creating fresh state');
    const defaultDoc = createEmptyDocument('My First Funnel');
    const newIndex = createInitialDocumentIndex(defaultDoc);
    
    // Clean up old invalid document storage
    clearAllDocumentStorage();
    
    saveDocumentIndex(newIndex);
    saveDocument(defaultDoc);
    
    return { index: newIndex, activeDocument: defaultDoc };
  }

  return { index, activeDocument };
}

/**
 * Updates the index entry for a document (used after document changes).
 */
export function updateDocumentIndexEntry(
  index: EditorDocumentIndex,
  document: EditorDocument,
): EditorDocumentIndex {
  return {
    ...index,
    documents: {
      ...index.documents,
      [document.id]: {
        id: document.id,
        name: document.name,
        updatedAt: document.updatedAt,
      },
    },
  };
}

/**
 * Removes a document from the index.
 */
export function removeDocumentFromIndex(
  index: EditorDocumentIndex,
  documentId: string,
): EditorDocumentIndex {
  const { [documentId]: removed, ...remainingDocuments } = index.documents;
  
  // Determine new active document if we're removing the active one
  let newActiveDocumentId = index.activeDocumentId;
  if (documentId === index.activeDocumentId) {
    const remainingIds = Object.keys(remainingDocuments);
    newActiveDocumentId = remainingIds[0] ?? index.activeDocumentId;
  }
  
  return {
    activeDocumentId: newActiveDocumentId,
    documents: remainingDocuments,
  };
}

/**
 * Clears all document storage (for reset/testing).
 */
export function clearAllDocumentStorage(): void {
  try {
    // Remove index
    localStorage.removeItem(INDEX_STORAGE_KEY);
    
    // Remove all documents
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DOC_STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    
    console.debug('[MultiDocPersistence] All document storage cleared');
  } catch (error) {
    console.error('[MultiDocPersistence] Failed to clear storage:', error);
  }
}

// ============================================================================
// DEBOUNCED PERSISTENCE
// ============================================================================

/**
 * Creates a debounced save function for multi-document persistence.
 * Handles both document and index saves.
 */
export function createMultiDocDebouncedSave(delayMs: number = 750): {
  scheduleDocumentSave: (document: EditorDocument, index: EditorDocumentIndex) => void;
  scheduleIndexSave: (index: EditorDocumentIndex) => void;
  cancelPending: () => void;
  flushPending: () => void;
} {
  let documentTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let indexTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingDocument: EditorDocument | null = null;
  let pendingIndex: EditorDocumentIndex | null = null;

  function scheduleDocumentSave(document: EditorDocument, index: EditorDocumentIndex): void {
    pendingDocument = document;
    pendingIndex = index;

    if (documentTimeoutId !== null) {
      clearTimeout(documentTimeoutId);
    }

    documentTimeoutId = setTimeout(() => {
      if (pendingDocument && pendingIndex) {
        saveDocument(pendingDocument);
        saveDocumentIndex(updateDocumentIndexEntry(pendingIndex, pendingDocument));
        pendingDocument = null;
        pendingIndex = null;
      }
      documentTimeoutId = null;
    }, delayMs);
  }

  function scheduleIndexSave(index: EditorDocumentIndex): void {
    pendingIndex = index;

    if (indexTimeoutId !== null) {
      clearTimeout(indexTimeoutId);
    }

    indexTimeoutId = setTimeout(() => {
      if (pendingIndex) {
        saveDocumentIndex(pendingIndex);
        pendingIndex = null;
      }
      indexTimeoutId = null;
    }, delayMs);
  }

  function cancelPending(): void {
    if (documentTimeoutId !== null) {
      clearTimeout(documentTimeoutId);
      documentTimeoutId = null;
    }
    if (indexTimeoutId !== null) {
      clearTimeout(indexTimeoutId);
      indexTimeoutId = null;
    }
    pendingDocument = null;
    pendingIndex = null;
  }

  function flushPending(): void {
    if (documentTimeoutId !== null) {
      clearTimeout(documentTimeoutId);
      documentTimeoutId = null;
    }
    if (indexTimeoutId !== null) {
      clearTimeout(indexTimeoutId);
      indexTimeoutId = null;
    }
    
    if (pendingDocument) {
      saveDocument(pendingDocument);
    }
    if (pendingIndex) {
      saveDocumentIndex(pendingIndex);
    }
    
    pendingDocument = null;
    pendingIndex = null;
  }

  return { scheduleDocumentSave, scheduleIndexSave, cancelPending, flushPending };
}

// ============================================================================
// PERSISTENCE TRIGGERS
// ============================================================================

/**
 * Actions that should trigger document persistence.
 */
export const DOCUMENT_PERSIST_ACTIONS = new Set([
  // Page/node level actions (persist document)
  'ADD_NODE',
  'DELETE_NODE',
  'MOVE_NODE_UP',
  'MOVE_NODE_DOWN',
  'MOVE_NODE_TO_PARENT',
  'COMMIT_NODE_PROPS',
  'SET_ACTIVE_PAGE',
  // Document level actions
  'RENAME_DOCUMENT',
  // Phase 14: Publish actions (persist snapshot with document)
  'PUBLISH_DOCUMENT',
  'UNPUBLISH_DOCUMENT',
]);

/**
 * Actions that should trigger index-only persistence.
 */
export const INDEX_PERSIST_ACTIONS = new Set([
  'CREATE_DOCUMENT',
  'DELETE_DOCUMENT',
  'DUPLICATE_DOCUMENT',
  'SET_ACTIVE_DOCUMENT',
]);

/**
 * Checks if an action should trigger document persistence.
 */
export function shouldPersistDocument(actionType: string): boolean {
  return DOCUMENT_PERSIST_ACTIONS.has(actionType);
}

/**
 * Checks if an action should trigger index persistence.
 */
export function shouldPersistIndex(actionType: string): boolean {
  return INDEX_PERSIST_ACTIONS.has(actionType);
}
