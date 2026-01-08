/**
 * Phase 13: Multi-Document System Exports
 *
 * This barrel file exports all multi-document system components and utilities.
 */

// Types
export type {
  EditorDocument,
  EditorDocumentIndex,
  DocumentIndexEntry,
  DocumentAction,
} from './documentTypes';

export {
  DOCUMENT_VERSION,
  generateDocumentId,
  createEmptyDocument,
  cloneDocumentWithNewIds,
  createInitialDocumentIndex,
} from './documentTypes';

// Multi-document persistence
export {
  saveDocumentIndex,
  loadDocumentIndex,
  saveDocument,
  loadDocument,
  deleteDocumentFromStorage,
  loadMultiDocumentState,
  updateDocumentIndexEntry,
  removeDocumentFromIndex,
  clearAllDocumentStorage,
  createMultiDocDebouncedSave,
  shouldPersistDocument,
  shouldPersistIndex,
  DOCUMENT_PERSIST_ACTIONS,
  INDEX_PERSIST_ACTIONS,
} from './multiDocPersistence';

// Multi-document store
export type {
  DocumentSnapshot,
  MultiDocumentState,
  MultiDocumentStoreContextValue,
} from './multiDocStore';

export {
  MultiDocumentProvider,
  useMultiDocumentStore,
  generateNodeId,
} from './multiDocStore';

// Editor store adapter
export { EditorStoreAdapter } from './editorStoreAdapter';
