/**
 * Phase 13: Multi-Document Store
 *
 * This module provides document-level state management that wraps
 * the existing single-document editor store. It handles:
 * - Multiple document tracking
 * - Document switching with history reset
 * - Document CRUD operations
 * - Multi-document persistence
 *
 * Invariants:
 * - At least one document must always exist
 * - Switching documents resets undo/redo history
 * - Selection and mode are reset on document switch
 * - Only document content is persisted, not UI state
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';

import type { CanvasNode, EditorState, Page } from '../types';
import {
  cloneDocumentWithNewIds,
  createEmptyDocument,
  createPublishedSnapshot,
  DOCUMENT_VERSION,
  type DocumentAction,
  type DocumentIndexEntry,
  type EditorDocument,
  type EditorDocumentIndex,
  type PublishedDocumentSnapshot,
} from './documentTypes';
import {
  createMultiDocDebouncedSave,
  deleteDocumentFromStorage,
  loadDocument,
  loadMultiDocumentState,
  removeDocumentFromIndex,
  saveDocument,
  saveDocumentIndex,
  shouldPersistDocument,
  shouldPersistIndex,
  updateDocumentIndexEntry,
} from './multiDocPersistence';
import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import { applyIntentDefaults } from '../registry/creationHelpers';
import { DEFAULT_PERSONALITY } from '../layout/personalityResolver';

// ============================================================================
// NODE ID GENERATION
// ============================================================================

let nodeIdCounter = 0;

export function generateNodeId(type: string): string {
  nodeIdCounter += 1;
  return `${type}-${nodeIdCounter}`;
}

// ============================================================================
// TREE HELPERS (copied from editorStore to maintain pure functions)
// ============================================================================

function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

function updateNodePropsInTree(
  node: CanvasNode,
  nodeId: string,
  partialProps: Record<string, unknown>,
): CanvasNode {
  if (node.id === nodeId) {
    return {
      ...node,
      props: { ...node.props, ...partialProps },
    };
  }

  let didChangeChild = false;
  const nextChildren = node.children.map((child) => {
    const next = updateNodePropsInTree(child, nodeId, partialProps);
    if (next !== child) {
      didChangeChild = true;
    }
    return next;
  });

  if (!didChangeChild) {
    return node;
  }

  return { ...node, children: nextChildren };
}

function insertChildNode(
  node: CanvasNode,
  parentId: string,
  newNode: CanvasNode,
): { next: CanvasNode; inserted: boolean } {
  if (node.id === parentId) {
    return {
      next: { ...node, children: [...node.children, newNode] },
      inserted: true,
    };
  }

  let inserted = false;
  const nextChildren = node.children.map((child) => {
    const { next, inserted: childInserted } = insertChildNode(child, parentId, newNode);
    if (childInserted) {
      inserted = true;
    }
    return next;
  });

  if (!inserted) {
    return { next: node, inserted: false };
  }

  return { next: { ...node, children: nextChildren }, inserted: true };
}

function removeNodeFromTree(
  node: CanvasNode,
  nodeId: string,
): { next: CanvasNode; removed: boolean } {
  let removed = false;
  const nextChildren: CanvasNode[] = [];

  for (const child of node.children) {
    if (child.id === nodeId) {
      removed = true;
      continue;
    }

    const { next, removed: childRemoved } = removeNodeFromTree(child, nodeId);
    if (childRemoved) {
      removed = true;
      nextChildren.push(next);
    } else {
      nextChildren.push(child);
    }
  }

  if (!removed) {
    return { next: node, removed: false };
  }

  return { next: { ...node, children: nextChildren }, removed: true };
}

function moveNodeWithinParent(
  root: CanvasNode,
  nodeId: string,
  direction: 'up' | 'down',
): CanvasNode {
  if (root.id === nodeId) {
    return root;
  }

  const { next, moved } = (function move(node: CanvasNode): { next: CanvasNode; moved: boolean } {
    if (node.id === nodeId) {
      return { next: node, moved: false };
    }

    const childIndex = node.children.findIndex((child) => child.id === nodeId);

    if (childIndex !== -1) {
      const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1;

      if (targetIndex < 0 || targetIndex >= node.children.length) {
        return { next: node, moved: false };
      }

      const nextChildren = node.children.slice();
      const [moving] = nextChildren.splice(childIndex, 1);
      nextChildren.splice(targetIndex, 0, moving);

      return { next: { ...node, children: nextChildren }, moved: true };
    }

    let didMoveChild = false;
    const nextChildren = node.children.map((child) => {
      const { next: nextChild, moved } = move(child);
      if (moved) {
        didMoveChild = true;
        return nextChild;
      }
      return child;
    });

    if (!didMoveChild) {
      return { next: node, moved: false };
    }

    return { next: { ...node, children: nextChildren }, moved: true };
  })(root);

  return moved ? next : root;
}

function findPathToNode(node: CanvasNode, targetId: string, path: number[] = []): number[] | null {
  if (node.id === targetId) {
    return path;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const childPath = findPathToNode(child, targetId, [...path, index]);
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function getNodeAtPath(node: CanvasNode, path: number[]): CanvasNode | null {
  let current: CanvasNode | null = node;

  for (const index of path) {
    if (!current || index < 0 || index >= current.children.length) {
      return null;
    }
    current = current.children[index];
  }

  return current;
}

function removeNodeAtPath(
  node: CanvasNode,
  path: number[],
): { next: CanvasNode; removed: CanvasNode | null } {
  if (path.length === 0) {
    return { next: node, removed: null };
  }

  const [index, ...rest] = path;

  if (index < 0 || index >= node.children.length) {
    return { next: node, removed: null };
  }

  if (rest.length === 0) {
    const removedNode = node.children[index];
    const nextChildren = node.children.filter((_, i) => i !== index);

    return { next: { ...node, children: nextChildren }, removed: removedNode };
  }

  const child = node.children[index];
  const { next: nextChild, removed } = removeNodeAtPath(child, rest);

  if (!removed) {
    return { next: node, removed: null };
  }

  const nextChildren = node.children.slice();
  nextChildren[index] = nextChild;

  return { next: { ...node, children: nextChildren }, removed };
}

function insertNodeAtPath(
  node: CanvasNode,
  path: number[],
  index: number,
  newNode: CanvasNode,
): { next: CanvasNode; inserted: boolean } {
  if (path.length === 0) {
    const clampedIndex = Math.max(0, Math.min(index, node.children.length));
    const nextChildren = node.children.slice();
    nextChildren.splice(clampedIndex, 0, newNode);

    return { next: { ...node, children: nextChildren }, inserted: true };
  }

  const [childIndex, ...rest] = path;

  if (childIndex < 0 || childIndex >= node.children.length) {
    return { next: node, inserted: false };
  }

  const child = node.children[childIndex];
  const { next: nextChild, inserted } = insertNodeAtPath(child, rest, index, newNode);

  if (!inserted) {
    return { next: node, inserted: false };
  }

  const nextChildren = node.children.slice();
  nextChildren[childIndex] = nextChild;

  return { next: { ...node, children: nextChildren }, inserted: true };
}

function moveNodeToParent(
  root: CanvasNode,
  nodeId: string,
  targetParentId: string,
  targetIndex?: number,
): CanvasNode {
  if (root.id === nodeId) {
    return root;
  }

  const nodePath = findPathToNode(root, nodeId);
  const targetParentPath = findPathToNode(root, targetParentId);

  if (!nodePath || !targetParentPath) {
    return root;
  }

  const targetIsDescendant =
    targetParentPath.length >= nodePath.length &&
    nodePath.every((segment, index) => targetParentPath[index] === segment);

  if (targetIsDescendant) {
    return root;
  }

  const sourceParentPath = nodePath.slice(0, -1);
  const sourceIndex = nodePath[nodePath.length - 1];
  const sourceParent = getNodeAtPath(root, sourceParentPath);
  const targetParent = getNodeAtPath(root, targetParentPath);

  if (!sourceParent || !targetParent) {
    return root;
  }

  const targetDefinition = ComponentRegistry[targetParent.type] ?? fallbackComponent;

  if (!targetDefinition.constraints.canHaveChildren) {
    return root;
  }

  const movingWithinSameParent = targetParent.id === sourceParent.id;
  const requestedTargetIndex =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, targetParent.children.length))
      : targetParent.children.length;
  const isAlreadyLastSibling = sourceIndex === targetParent.children.length - 1;
  const isNoopMoveWithinSameParent =
    movingWithinSameParent &&
    ((targetIndex === undefined && isAlreadyLastSibling) ||
      requestedTargetIndex === sourceIndex ||
      (requestedTargetIndex >= targetParent.children.length && isAlreadyLastSibling));

  if (isNoopMoveWithinSameParent) {
    return root;
  }

  const { next: withoutNode, removed } = removeNodeAtPath(root, nodePath);

  if (!removed) {
    return root;
  }

  const targetParentPathAfterRemoval = findPathToNode(withoutNode, targetParentId);

  if (!targetParentPathAfterRemoval) {
    return root;
  }

  const parentAfterRemoval = getNodeAtPath(withoutNode, targetParentPathAfterRemoval);

  if (!parentAfterRemoval) {
    return root;
  }

  let insertionIndex =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, parentAfterRemoval.children.length))
      : parentAfterRemoval.children.length;

  if (movingWithinSameParent && insertionIndex > sourceIndex) {
    insertionIndex -= 1;
  }

  const { next: nextRoot, inserted } = insertNodeAtPath(
    withoutNode,
    targetParentPathAfterRemoval,
    insertionIndex,
    removed,
  );

  if (!inserted) {
    return root;
  }

  return nextRoot;
}

// ============================================================================
// SNAPSHOT TYPES
// ============================================================================

export type DocumentSnapshot = {
  /** Current document content */
  document: EditorDocument;
  /** Selected node within active page */
  selectedNodeId: string | null;
  /** Editor mode */
  mode: EditorState['mode'];
  /** Temporarily highlighted node IDs (for suggestion preview/feedback) */
  highlightedNodeIds: string[];
};

type HistoryState = {
  past: DocumentSnapshot[];
  present: DocumentSnapshot;
  future: DocumentSnapshot[];
};

// ============================================================================
// MULTI-DOCUMENT STATE
// ============================================================================

export type MultiDocumentState = {
  /** Document index (metadata only) */
  index: EditorDocumentIndex;
  /** Per-document history state */
  history: HistoryState;
};

// ============================================================================
// ACTION TYPES
// ============================================================================

type PageAction =
  | { type: 'SET_ACTIVE_PAGE'; pageId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SET_MODE'; mode: EditorState['mode'] }
  | { type: 'COMMIT_NODE_PROPS'; nodeId: string; partialProps: Record<string, unknown> }
  | { type: 'ADD_NODE'; parentId: string; node: CanvasNode }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE_UP'; nodeId: string }
  | { type: 'MOVE_NODE_DOWN'; nodeId: string }
  | { type: 'MOVE_NODE_TO_PARENT'; nodeId: string; targetParentId: string; targetIndex?: number }
  | { type: 'HIGHLIGHT_NODES'; nodeIds: string[] };

type HistoryAction = { type: 'UNDO' } | { type: 'REDO' };

type HydrateAction = {
  type: 'HYDRATE_MULTI_DOC';
  index: EditorDocumentIndex;
  activeDocument: EditorDocument;
};

type MultiDocAction =
  | PageAction
  | HistoryAction
  | HydrateAction
  | DocumentAction;

// ============================================================================
// HISTORY-TRACKED ACTIONS
// ============================================================================

const historyTrackedActions = new Set<string>([
  'ADD_NODE',
  'DELETE_NODE',
  'MOVE_NODE_UP',
  'MOVE_NODE_DOWN',
  'MOVE_NODE_TO_PARENT',
  'COMMIT_NODE_PROPS',
  'SET_ACTIVE_PAGE',
]);

// ============================================================================
// CLONE HELPER
// ============================================================================

function cloneSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot)) as DocumentSnapshot;
}

// ============================================================================
// DOCUMENT REDUCER (handles content changes within a document)
// ============================================================================

function documentReducer(state: DocumentSnapshot, action: PageAction): DocumentSnapshot {
  const { document } = state;
  
  switch (action.type) {
    case 'SET_ACTIVE_PAGE':
      return {
        ...state,
        document: {
          ...document,
          activePageId: action.pageId,
          updatedAt: Date.now(),
        },
        selectedNodeId: null,
      };

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.nodeId,
      };

    case 'SET_MODE':
      // Phase 14: Clear selection when entering preview mode
      // Preview is read-only and should not have any selection state
      return {
        ...state,
        mode: action.mode,
        selectedNodeId: action.mode === 'preview' ? null : state.selectedNodeId,
      };

    case 'ADD_NODE': {
      const pageIndex = document.pages.findIndex((p) => p.id === document.activePageId);
      if (pageIndex === -1) return state;

      const targetPage = document.pages[pageIndex];
      const parentNode = findNodeById(targetPage.canvasRoot, action.parentId);
      if (!parentNode) return state;

      const parentDefinition = ComponentRegistry[parentNode.type] ?? fallbackComponent;
      if (!parentDefinition.constraints.canHaveChildren) return state;

      const { next, inserted } = insertChildNode(targetPage.canvasRoot, action.parentId, action.node);
      if (!inserted) return state;

      const nextPages = document.pages.slice();
      nextPages[pageIndex] = { ...targetPage, canvasRoot: next };

      return {
        ...state,
        document: {
          ...document,
          pages: nextPages,
          updatedAt: Date.now(),
        },
        selectedNodeId: action.node.id,
      };
    }

    case 'DELETE_NODE': {
      const pageIndex = document.pages.findIndex((p) => p.id === document.activePageId);
      if (pageIndex === -1) return state;

      const targetPage = document.pages[pageIndex];
      if (targetPage.canvasRoot.id === action.nodeId) return state;

      const { next, removed } = removeNodeFromTree(targetPage.canvasRoot, action.nodeId);
      if (!removed) return state;

      const nextPages = document.pages.slice();
      nextPages[pageIndex] = { ...targetPage, canvasRoot: next };

      return {
        ...state,
        document: {
          ...document,
          pages: nextPages,
          updatedAt: Date.now(),
        },
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
      };
    }

    case 'COMMIT_NODE_PROPS': {
      const nextPages = document.pages.map((page) => {
        if (page.id !== document.activePageId) return page;

        const nextRoot = updateNodePropsInTree(page.canvasRoot, action.nodeId, action.partialProps);
        if (nextRoot === page.canvasRoot) return page;

        return { ...page, canvasRoot: nextRoot };
      });

      const didChange = nextPages.some((page, i) => page !== document.pages[i]);
      if (!didChange) return state;

      return {
        ...state,
        document: {
          ...document,
          pages: nextPages,
          updatedAt: Date.now(),
        },
      };
    }

    case 'MOVE_NODE_UP':
    case 'MOVE_NODE_DOWN': {
      const pageIndex = document.pages.findIndex((p) => p.id === document.activePageId);
      if (pageIndex === -1) return state;

      const targetPage = document.pages[pageIndex];
      const direction = action.type === 'MOVE_NODE_UP' ? 'up' : 'down';
      const nextRoot = moveNodeWithinParent(targetPage.canvasRoot, action.nodeId, direction);

      if (nextRoot === targetPage.canvasRoot) return state;

      const nextPages = document.pages.slice();
      nextPages[pageIndex] = { ...targetPage, canvasRoot: nextRoot };

      return {
        ...state,
        document: {
          ...document,
          pages: nextPages,
          updatedAt: Date.now(),
        },
        selectedNodeId: action.nodeId,
      };
    }

    case 'MOVE_NODE_TO_PARENT': {
      const pageIndex = document.pages.findIndex((p) => p.id === document.activePageId);
      if (pageIndex === -1) return state;

      const targetPage = document.pages[pageIndex];
      const nextRoot = moveNodeToParent(
        targetPage.canvasRoot,
        action.nodeId,
        action.targetParentId,
        action.targetIndex,
      );

      if (nextRoot === targetPage.canvasRoot) return state;

      const nextPages = document.pages.slice();
      nextPages[pageIndex] = { ...targetPage, canvasRoot: nextRoot };

      return {
        ...state,
        document: {
          ...document,
          pages: nextPages,
          updatedAt: Date.now(),
        },
        selectedNodeId: action.nodeId,
      };
    }

    case 'HIGHLIGHT_NODES':
      return {
        ...state,
        highlightedNodeIds: action.nodeIds,
      };

    default:
      return state;
  }
}

// ============================================================================
// MAIN REDUCER
// ============================================================================

function multiDocReducer(state: MultiDocumentState, action: MultiDocAction): MultiDocumentState {
  // Handle hydration
  if (action.type === 'HYDRATE_MULTI_DOC') {
    return {
      index: action.index,
      history: {
        past: [],
        present: {
          document: action.activeDocument,
          selectedNodeId: null,
          mode: 'structure',
          highlightedNodeIds: [],
        },
        future: [],
      },
    };
  }

  // Handle undo
  if (action.type === 'UNDO') {
    if (state.history.past.length === 0) return state;

    const previous = state.history.past[state.history.past.length - 1];
    return {
      ...state,
      history: {
        past: state.history.past.slice(0, -1),
        present: { ...cloneSnapshot(previous), highlightedNodeIds: [] },
        future: [cloneSnapshot(state.history.present), ...state.history.future],
      },
    };
  }

  // Handle redo
  if (action.type === 'REDO') {
    if (state.history.future.length === 0) return state;

    const [next, ...rest] = state.history.future;
    return {
      ...state,
      history: {
        past: [...state.history.past, cloneSnapshot(state.history.present)],
        present: { ...cloneSnapshot(next), highlightedNodeIds: [] },
        future: rest,
      },
    };
  }

  // Handle document-level actions
  if (action.type === 'CREATE_DOCUMENT') {
    const newIndex = updateDocumentIndexEntry(state.index, action.document);
    return {
      index: newIndex,
      history: state.history,
    };
  }

  if (action.type === 'DELETE_DOCUMENT') {
    // Prevent deleting the last document
    if (Object.keys(state.index.documents).length <= 1) {
      console.warn('[MultiDocStore] Cannot delete last document');
      return state;
    }

    const newIndex = removeDocumentFromIndex(state.index, action.documentId);
    
    // If deleting active document, switch to another
    if (action.documentId === state.index.activeDocumentId) {
      const remainingDocIds = Object.keys(newIndex.documents);
      const fallbackDocId = remainingDocIds[0];
      const fallbackDoc = loadDocument(fallbackDocId);
      
      if (fallbackDoc) {
        return {
          index: { ...newIndex, activeDocumentId: fallbackDocId },
          history: {
            past: [],
            present: {
              document: fallbackDoc,
              selectedNodeId: null,
              mode: 'structure',
              highlightedNodeIds: [],
            },
            future: [],
          },
        };
      }
    }

    return { ...state, index: newIndex };
  }

  if (action.type === 'DUPLICATE_DOCUMENT') {
    const newIndex = updateDocumentIndexEntry(state.index, action.newDocument);
    return {
      index: newIndex,
      history: state.history,
    };
  }

  if (action.type === 'SET_ACTIVE_DOCUMENT') {
    if (action.documentId === state.index.activeDocumentId) {
      return state;
    }

    const newDoc = loadDocument(action.documentId);
    if (!newDoc) {
      console.warn(`[MultiDocStore] Failed to load document ${action.documentId}`);
      return state;
    }

    return {
      index: {
        ...state.index,
        activeDocumentId: action.documentId,
      },
      history: {
        past: [],
        present: {
          document: newDoc,
          selectedNodeId: null,
          mode: 'structure',
          highlightedNodeIds: [],
        },
        future: [],
      },
    };
  }

  if (action.type === 'RENAME_DOCUMENT') {
    const currentDoc = state.history.present.document;
    
    if (action.documentId !== currentDoc.id) {
      // Renaming a different document - just update index
      const entry = state.index.documents[action.documentId];
      if (!entry) return state;
      
      const newIndex: EditorDocumentIndex = {
        ...state.index,
        documents: {
          ...state.index.documents,
          [action.documentId]: {
            ...entry,
            name: action.newName,
            updatedAt: Date.now(),
          },
        },
      };
      
      return { ...state, index: newIndex };
    }

    // Renaming active document
    const renamedDoc: EditorDocument = {
      ...currentDoc,
      name: action.newName,
      updatedAt: Date.now(),
    };

    const newIndex = updateDocumentIndexEntry(state.index, renamedDoc);

    return {
      index: newIndex,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          document: renamedDoc,
        },
      },
    };
  }

  // ============================================================================
  // PHASE 14: PUBLISH / UNPUBLISH ACTIONS
  // ============================================================================

  if (action.type === 'PUBLISH_DOCUMENT') {
    const currentDoc = state.history.present.document;
    
    // Create a deep-cloned published snapshot from current draft
    const publishedSnapshot = createPublishedSnapshot(
      currentDoc.pages,
      currentDoc.activePageId,
    );
    
    // Update document with published snapshot
    const publishedDoc: EditorDocument = {
      ...currentDoc,
      published: publishedSnapshot,
      updatedAt: Date.now(),
    };
    
    // Update index with new timestamp
    const newIndex = updateDocumentIndexEntry(state.index, publishedDoc);
    
    // Important: Do NOT modify undo/redo history
    // Publishing is a side-effect operation, not an edit operation
    // Selection is cleared after publish
    return {
      index: newIndex,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          document: publishedDoc,
          selectedNodeId: null,
        },
        // past and future remain unchanged
      },
    };
  }

  if (action.type === 'UNPUBLISH_DOCUMENT') {
    const currentDoc = state.history.present.document;
    
    // If not published, no-op
    if (!currentDoc.published) {
      return state;
    }
    
    // Clear published snapshot, draft remains untouched
    const unpublishedDoc: EditorDocument = {
      ...currentDoc,
      published: null,
      updatedAt: Date.now(),
    };
    
    // Update index with new timestamp
    const newIndex = updateDocumentIndexEntry(state.index, unpublishedDoc);
    
    return {
      index: newIndex,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          document: unpublishedDoc,
        },
      },
    };
  }

  // Handle page-level actions
  const isPageAction = [
    'SET_ACTIVE_PAGE',
    'SELECT_NODE',
    'SET_MODE',
    'COMMIT_NODE_PROPS',
    'ADD_NODE',
    'DELETE_NODE',
    'MOVE_NODE_UP',
    'MOVE_NODE_DOWN',
    'MOVE_NODE_TO_PARENT',
  ].includes(action.type);

  if (isPageAction) {
    const nextPresent = documentReducer(state.history.present, action as PageAction);

    if (nextPresent === state.history.present) {
      return state;
    }

    // Track history for certain actions
    if (historyTrackedActions.has(action.type)) {
      return {
        ...state,
        history: {
          past: [...state.history.past, cloneSnapshot(state.history.present)],
          present: cloneSnapshot(nextPresent),
          future: [],
        },
      };
    }

    // Non-tracked action - just update present
    return {
      ...state,
      history: {
        ...state.history,
        present: nextPresent,
      },
    };
  }

  return state;
}

// ============================================================================
// INITIAL STATE FACTORY
// ============================================================================

function createInitialState(): MultiDocumentState {
  const defaultDoc = createEmptyDocument('My First Funnel');
  
  return {
    index: {
      activeDocumentId: defaultDoc.id,
      documents: {
        [defaultDoc.id]: {
          id: defaultDoc.id,
          name: defaultDoc.name,
          updatedAt: defaultDoc.updatedAt,
        },
      },
    },
    history: {
      past: [],
      present: {
        document: defaultDoc,
        selectedNodeId: null,
        mode: 'structure',
        highlightedNodeIds: [],
      },
      future: [],
    },
  };
}

// ============================================================================
// CONTEXT & PROVIDER
// ============================================================================

export type MultiDocumentStoreContextValue = {
  // Document index
  documentIndex: EditorDocumentIndex;
  documentList: DocumentIndexEntry[];
  activeDocumentId: string;
  
  // Current document state
  pages: Page[];
  activePageId: string;
  selectedNodeId: string | null;
  mode: EditorState['mode'];
  editorState: EditorState;
  currentDocument: EditorDocument;
  
  // Phase 14: Published state
  publishedSnapshot: PublishedDocumentSnapshot | null;
  isPublished: boolean;
  
  // Phase 26: Highlighted nodes for suggestion feedback
  highlightedNodeIds: string[];
  
  // Dispatch
  dispatch: Dispatch<MultiDocAction>;
  
  // Document actions
  createDocument: (name?: string) => void;
  deleteDocument: (documentId: string) => void;
  duplicateDocument: (documentId: string) => void;
  setActiveDocument: (documentId: string) => void;
  renameDocument: (documentId: string, newName: string) => void;
  
  // Phase 14: Publish actions
  publishDocument: () => void;
  unpublishDocument: () => void;
  
  // Page/Node actions (same as before)
  selectNode: (nodeId: string | null) => void;
  setMode: (mode: EditorState['mode']) => void;
  setActivePage: (pageId: string) => void;
  updateNodeProps: (nodeId: string, partialProps: Record<string, unknown>) => void;
  addNode: (parentId: string, type: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  moveNodeToParent: (nodeId: string, targetParentId: string, targetIndex?: number) => void;
  highlightNodes: (nodeIds: string[]) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const MultiDocumentStoreContext = createContext<MultiDocumentStoreContextValue | undefined>(undefined);

export function MultiDocumentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(multiDocReducer, null, createInitialState);

  const hasHydratedRef = useRef(false);
  const debouncedSaveRef = useRef(createMultiDocDebouncedSave(750));
  const lastActionRef = useRef<string | null>(null);

  // Hydrate on mount
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    const { index, activeDocument } = loadMultiDocumentState();
    
    dispatch({
      type: 'HYDRATE_MULTI_DOC',
      index,
      activeDocument,
    });
  }, []);

  // Persistence effect
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const actionType = lastActionRef.current;
    if (!actionType) return;

    const { present } = state.history;

    // Document content changed - persist document and index
    if (shouldPersistDocument(actionType)) {
      debouncedSaveRef.current.scheduleDocumentSave(present.document, state.index);
    }

    // Index-only change
    if (shouldPersistIndex(actionType)) {
      // For document creation/duplication, we need to save the new document immediately
      if (actionType === 'CREATE_DOCUMENT' || actionType === 'DUPLICATE_DOCUMENT') {
        // Document was created but might not be active - find it and save
        for (const docId of Object.keys(state.index.documents)) {
          if (docId !== state.index.activeDocumentId) {
            const doc = loadDocument(docId);
            if (!doc) {
              // New document, save it from pending state
              // This is handled in the action handlers below
            }
          }
        }
      }
      
      debouncedSaveRef.current.scheduleIndexSave(state.index);
    }

    // For DELETE_DOCUMENT, also remove from storage
    if (actionType === 'DELETE_DOCUMENT') {
      // The document ID to delete would be in the action, but we don't have it here
      // It's handled in the delete action handler
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history.present.document, state.index]);

  // Flush on unmount
  useEffect(() => {
    const { flushPending } = debouncedSaveRef.current;
    return () => {
      flushPending();
    };
  }, []);

  // Wrap dispatch to track actions
  const wrappedDispatch = useCallback<Dispatch<MultiDocAction>>((action) => {
    lastActionRef.current = action.type;
    dispatch(action);
  }, []);

  // Document actions
  const createDocument = useCallback(
    (name: string = 'New Document') => {
      const newDoc = createEmptyDocument(name);
      saveDocument(newDoc); // Persist immediately
      wrappedDispatch({ type: 'CREATE_DOCUMENT', document: newDoc });
    },
    [wrappedDispatch],
  );

  const deleteDocument = useCallback(
    (documentId: string) => {
      deleteDocumentFromStorage(documentId);
      wrappedDispatch({ type: 'DELETE_DOCUMENT', documentId });
    },
    [wrappedDispatch],
  );

  const duplicateDocument = useCallback(
    (documentId: string) => {
      const sourceDoc = documentId === state.index.activeDocumentId
        ? state.history.present.document
        : loadDocument(documentId);
      
      if (!sourceDoc) {
        console.warn(`[MultiDocStore] Cannot duplicate: document ${documentId} not found`);
        return;
      }

      const newDoc = cloneDocumentWithNewIds(sourceDoc, `${sourceDoc.name} (Copy)`);
      saveDocument(newDoc); // Persist immediately
      wrappedDispatch({ type: 'DUPLICATE_DOCUMENT', sourceDocumentId: documentId, newDocument: newDoc });
    },
    [wrappedDispatch, state.index.activeDocumentId, state.history.present.document],
  );

  const setActiveDocument = useCallback(
    (documentId: string) => {
      // Save current document before switching
      const currentDoc = state.history.present.document;
      saveDocument(currentDoc);
      saveDocumentIndex(state.index);
      
      wrappedDispatch({ type: 'SET_ACTIVE_DOCUMENT', documentId });
    },
    [wrappedDispatch, state.history.present.document, state.index],
  );

  const renameDocument = useCallback(
    (documentId: string, newName: string) => {
      wrappedDispatch({ type: 'RENAME_DOCUMENT', documentId, newName });
    },
    [wrappedDispatch],
  );

  // Phase 14: Publish/Unpublish actions
  const publishDocument = useCallback(() => {
    wrappedDispatch({ type: 'PUBLISH_DOCUMENT' });
  }, [wrappedDispatch]);

  const unpublishDocument = useCallback(() => {
    wrappedDispatch({ type: 'UNPUBLISH_DOCUMENT' });
  }, [wrappedDispatch]);

  // Page/Node actions
  const selectNode = useCallback(
    (nodeId: string | null) => wrappedDispatch({ type: 'SELECT_NODE', nodeId }),
    [wrappedDispatch],
  );

  const setMode = useCallback(
    (mode: EditorState['mode']) => wrappedDispatch({ type: 'SET_MODE', mode }),
    [wrappedDispatch],
  );

  const setActivePage = useCallback(
    (pageId: string) => wrappedDispatch({ type: 'SET_ACTIVE_PAGE', pageId }),
    [wrappedDispatch],
  );

  const updateNodeProps = useCallback(
    (nodeId: string, partialProps: Record<string, unknown>) =>
      wrappedDispatch({ type: 'COMMIT_NODE_PROPS', nodeId, partialProps }),
    [wrappedDispatch],
  );

  const addNode = useCallback(
    (parentId: string, type: string) => {
      const definition = ComponentRegistry[type] ?? fallbackComponent;
      
      // Phase 28: Get active page personality for intent defaults
      const currentDoc = state.history.present.document;
      const activePage = currentDoc.pages.find((p) => p.id === currentDoc.activePageId);
      const personality = activePage?.layoutPersonality ?? DEFAULT_PERSONALITY;
      
      // Phase 28: Find parent node type for context-aware defaults
      let parentType: string | undefined;
      if (activePage) {
        const parent = findNodeById(activePage.canvasRoot, parentId);
        parentType = parent?.type;
      }
      
      // Phase 28: Apply intent defaults at creation time only
      const baseProps = { ...(definition.defaultProps ?? {}) };
      const props = applyIntentDefaults(type, baseProps, personality, parentType);
      
      const node: CanvasNode = {
        id: generateNodeId(type),
        type,
        props,
        children: [],
      };
      wrappedDispatch({ type: 'ADD_NODE', parentId, node });
    },
    [wrappedDispatch, state.history.present.document],
  );

  const deleteNode = useCallback(
    (nodeId: string) => wrappedDispatch({ type: 'DELETE_NODE', nodeId }),
    [wrappedDispatch],
  );

  const moveNodeUp = useCallback(
    (nodeId: string) => wrappedDispatch({ type: 'MOVE_NODE_UP', nodeId }),
    [wrappedDispatch],
  );

  const moveNodeDown = useCallback(
    (nodeId: string) => wrappedDispatch({ type: 'MOVE_NODE_DOWN', nodeId }),
    [wrappedDispatch],
  );

  const moveNodeToParentCallback = useCallback(
    (nodeId: string, targetParentId: string, targetIndex?: number) =>
      wrappedDispatch({ type: 'MOVE_NODE_TO_PARENT', nodeId, targetParentId, targetIndex }),
    [wrappedDispatch],
  );

  const undo = useCallback(() => wrappedDispatch({ type: 'UNDO' }), [wrappedDispatch]);
  const redo = useCallback(() => wrappedDispatch({ type: 'REDO' }), [wrappedDispatch]);
  
  // Phase 26: Highlight nodes for suggestion preview
  const highlightNodes = useCallback(
    (nodeIds: string[]) => wrappedDispatch({ type: 'HIGHLIGHT_NODES', nodeIds }),
    [wrappedDispatch],
  );

  // Derived state
  const { present } = state.history;
  const { document } = present;

  const documentList = useMemo(
    () => Object.values(state.index.documents).sort((a, b) => b.updatedAt - a.updatedAt),
    [state.index.documents],
  );

  const editorState = useMemo<EditorState>(
    () => ({
      selectedPageId: document.activePageId,
      selectedNodeId: present.selectedNodeId,
      mode: present.mode,
    }),
    [document.activePageId, present.selectedNodeId, present.mode],
  );

  const value = useMemo<MultiDocumentStoreContextValue>(
    () => ({
      // Document index
      documentIndex: state.index,
      documentList,
      activeDocumentId: state.index.activeDocumentId,
      
      // Current document state
      pages: document.pages,
      activePageId: document.activePageId,
      selectedNodeId: present.selectedNodeId,
      mode: present.mode,
      editorState,
      currentDocument: document,
      
      // Phase 26: Highlighted nodes for suggestion preview
      highlightedNodeIds: present.highlightedNodeIds,
      
      // Phase 14: Published state
      publishedSnapshot: document.published ?? null,
      isPublished: document.published != null,
      
      // Dispatch
      dispatch: wrappedDispatch,
      
      // Document actions
      createDocument,
      deleteDocument,
      duplicateDocument,
      setActiveDocument,
      renameDocument,
      
      // Phase 14: Publish actions
      publishDocument,
      unpublishDocument,
      
      // Page/Node actions
      selectNode,
      setMode,
      setActivePage,
      updateNodeProps,
      addNode,
      deleteNode,
      moveNodeUp,
      moveNodeDown,
      moveNodeToParent: moveNodeToParentCallback,
      
      // History
      undo,
      redo,
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      
      // Phase 26: Highlight for suggestions
      highlightNodes,
    }),
    [
      state.index,
      documentList,
      document,
      present.selectedNodeId,
      present.mode,
      present.highlightedNodeIds,
      editorState,
      wrappedDispatch,
      createDocument,
      deleteDocument,
      duplicateDocument,
      setActiveDocument,
      renameDocument,
      publishDocument,
      unpublishDocument,
      selectNode,
      setMode,
      setActivePage,
      updateNodeProps,
      addNode,
      deleteNode,
      moveNodeUp,
      moveNodeDown,
      moveNodeToParentCallback,
      undo,
      redo,
      highlightNodes,
      state.history.past.length,
      state.history.future.length,
    ],
  );

  return (
    <MultiDocumentStoreContext.Provider value={value}>
      {children}
    </MultiDocumentStoreContext.Provider>
  );
}

export function useMultiDocumentStore() {
  const context = useContext(MultiDocumentStoreContext);

  if (!context) {
    throw new Error('useMultiDocumentStore must be used within a MultiDocumentProvider');
  }

  return context;
}
