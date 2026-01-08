/**
 * Phase 12: Editor Persistence & Hydration
 *
 * This module provides persistence and recovery for the editor document.
 * It saves and restores the canonical editor state safely, ensuring:
 * - Only history-committed actions are persisted (not drag/hover/selection-only changes)
 * - Debounced writes to avoid excessive storage operations
 * - Version-aware serialization for future migration support
 * - Clean separation from ephemeral UI state
 */

import type { Page } from '../types';

// ============================================================================
// VERSION CONSTANT
// ============================================================================

/**
 * Current editor document version.
 * Increment this when making breaking changes to the document structure.
 * Structure code so future migrations are possible.
 */
export const EDITOR_DOC_VERSION = 1;

// ============================================================================
// CANONICAL EDITOR DOCUMENT TYPE
// ============================================================================

/**
 * Serializable editor document format.
 * This is the canonical representation persisted to storage.
 *
 * IMPORTANT: This type must ONLY include data from editorStore.present
 * that represents the actual document state. It must NOT include:
 * - Drag state
 * - Hover state
 * - UI-only flags
 * - Undo/redo history (past/future arrays)
 * - Selection state (ephemeral, reconstructed on load)
 */
export interface EditorDocument {
  /** Version number for migration support */
  version: number;
  /** All pages in the document */
  pages: Page[];
  /** Currently active page ID */
  activePageId: string;
}

// ============================================================================
// STORAGE KEY
// ============================================================================

const STORAGE_KEY = 'builder_v2_editor_document';

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Extracts the canonical document from editor present state.
 * Pure function - no side effects.
 */
export function extractDocument(
  pages: Page[],
  activePageId: string,
): EditorDocument {
  return {
    version: EDITOR_DOC_VERSION,
    pages,
    activePageId,
  };
}

/**
 * Serializes the editor document to a JSON string.
 * Pure function - no side effects.
 */
export function serializeDocument(document: EditorDocument): string {
  return JSON.stringify(document);
}

/**
 * Attempts to parse and validate a stored document string.
 * Returns null if invalid or incompatible version.
 * Pure function - no side effects.
 */
export function parseDocument(raw: string | null): EditorDocument | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isValidDocument(parsed)) {
      console.warn('[Persistence] Invalid document structure, ignoring stored data');
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[Persistence] Failed to parse stored document:', error);
    return null;
  }
}

/**
 * Type guard to validate document structure.
 * Ensures version compatibility and required fields.
 */
function isValidDocument(value: unknown): value is EditorDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Version check - must match current version
  // Future: Add migration logic here when version changes
  if (typeof obj.version !== 'number') {
    return false;
  }

  if (obj.version !== EDITOR_DOC_VERSION) {
    console.warn(
      `[Persistence] Document version mismatch: stored=${obj.version}, current=${EDITOR_DOC_VERSION}`,
    );
    // Future: Implement migration from older versions
    return false;
  }

  // Validate pages array
  if (!Array.isArray(obj.pages) || obj.pages.length === 0) {
    return false;
  }

  // Validate each page has required structure
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
    console.warn('[Persistence] activePageId references non-existent page');
    return false;
  }

  return true;
}

/**
 * Validates a page object structure.
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

  // Recursively validate children
  for (const child of obj.children) {
    if (!isValidCanvasNode(child)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Saves the editor document to localStorage.
 * Should be called with debouncing to avoid excessive writes.
 */
export function saveToStorage(document: EditorDocument): boolean {
  try {
    const serialized = serializeDocument(document);
    localStorage.setItem(STORAGE_KEY, serialized);
    console.debug('[Persistence] Document saved to storage');
    return true;
  } catch (error) {
    console.error('[Persistence] Failed to save document:', error);
    return false;
  }
}

/**
 * Loads the editor document from localStorage.
 * Returns null if no document exists or if validation fails.
 */
export function loadFromStorage(): EditorDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseDocument(raw);
  } catch (error) {
    console.error('[Persistence] Failed to load document:', error);
    return null;
  }
}

/**
 * Clears the stored editor document.
 * Useful for testing or "New Document" functionality.
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.debug('[Persistence] Storage cleared');
  } catch (error) {
    console.error('[Persistence] Failed to clear storage:', error);
  }
}

// ============================================================================
// DEBOUNCED PERSISTENCE
// ============================================================================

/**
 * Creates a debounced save function.
 * Only persists after the specified delay, canceling pending saves on new calls.
 */
export function createDebouncedSave(delayMs: number = 750): {
  scheduleSave: (document: EditorDocument) => void;
  cancelPending: () => void;
  flushPending: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingDocument: EditorDocument | null = null;

  function scheduleSave(document: EditorDocument): void {
    pendingDocument = document;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (pendingDocument) {
        saveToStorage(pendingDocument);
        pendingDocument = null;
      }
      timeoutId = null;
    }, delayMs);
  }

  function cancelPending(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingDocument = null;
  }

  function flushPending(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingDocument) {
      saveToStorage(pendingDocument);
      pendingDocument = null;
    }
  }

  return { scheduleSave, cancelPending, flushPending };
}

// ============================================================================
// HYDRATION HELPERS
// ============================================================================

/**
 * Actions that should trigger persistence.
 * These are history-tracked actions that modify the document.
 * Selection-only and mode changes are NOT persisted.
 */
export const PERSIST_TRIGGERING_ACTIONS = new Set([
  'ADD_NODE',
  'DELETE_NODE',
  'MOVE_NODE_UP',
  'MOVE_NODE_DOWN',
  'MOVE_NODE_TO_PARENT',
  'COMMIT_NODE_PROPS',
  'SET_ACTIVE_PAGE',
  // Note: HYDRATE_FROM_STORAGE is NOT in this list - we don't persist after loading
]);

/**
 * Checks if an action should trigger a persistence save.
 */
export function shouldPersistAfterAction(actionType: string): boolean {
  return PERSIST_TRIGGERING_ACTIONS.has(actionType);
}
