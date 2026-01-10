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

import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import { applyIntentDefaults } from '../registry/creationHelpers';
import { DEFAULT_PERSONALITY } from '../layout/personalityResolver';
import { DEFAULT_GUIDED_MODE, GUIDED_MODE_SUGGESTION_INTENTS, type GuidedMode } from '../editorMode';
import type { CanvasNode, EditorState, Page } from '../types';
import {
  createDebouncedSave,
  extractDocument,
  loadFromStorage,
  shouldPersistAfterAction,
  type EditorDocument,
} from './persistence';
import {
  analyzeLayout,
  createLayoutContext,
  shouldRecomputeSuggestions,
  type LayoutSuggestion,
} from '../ai/layoutIntelligence';
import {
  analyzeComposition,
  mergeWithLayoutSuggestions,
  shouldRecomputeComposition,
  clearSuggestionsForNode,
} from '../ai/compositionIntelligence';
import {
  analyzeStructure,
  shouldRunStructuralAnalysis,
  type AISuggestion,
} from '../ai/structuralIntelligence';
import {
  analyzeTemplateMatch,
  shouldRunTemplateAnalysis,
  type TemplateSuggestion,
} from '../ai/templateIntelligence';
import {
  applyTemplate,
  previewTemplateApplication,
} from '../ai/applyTemplate';

let nodeIdCounter = 0;

export function generateNodeId(type: string) {
  nodeIdCounter += 1;
  return `${type}-${nodeIdCounter}`;
}

// Helper functions for step defaults
function getStepLabel(stepType: string): string {
  const labels: Record<string, string> = {
    welcome: 'Welcome',
    text_question: 'Question',
    multi_choice: 'Multi Choice',
    email_capture: 'Email Capture',
    phone_capture: 'Phone Capture',
    opt_in: 'Opt-In Form',
    video: 'Video',
    embed: 'Calendar',
    thank_you: 'Thank You',
  };
  return labels[stepType] || 'Step';
}

function getDefaultHeadline(stepType: string): string {
  const headlines: Record<string, string> = {
    welcome: 'Welcome! Let\'s get started.',
    text_question: 'Tell us about yourself',
    multi_choice: 'Choose an option',
    email_capture: 'Enter your email',
    phone_capture: 'Enter your phone number',
    opt_in: 'Get instant access',
    video: 'Watch this first',
    embed: 'Book your call',
    thank_you: 'Thank you!',
  };
  return headlines[stepType] || 'Step';
}

function getDefaultSubtext(stepType: string): string {
  const subtexts: Record<string, string> = {
    welcome: 'We\'re excited to have you here.',
    text_question: 'Your answer helps us personalize your experience.',
    multi_choice: 'Select the option that best describes you.',
    email_capture: 'We\'ll send you important updates.',
    phone_capture: 'We\'ll text you a confirmation.',
    opt_in: 'Fill out the form below to continue.',
    video: 'This will only take a moment.',
    embed: 'Select a time that works for you.',
    thank_you: 'We\'ll be in touch soon.',
  };
  return subtexts[stepType] || '';
}

export function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
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

export function updateNodePropsInTree(
  node: CanvasNode,
  nodeId: string,
  partialProps: Record<string, unknown>,
): CanvasNode {
  if (node.id === nodeId) {
    return {
      ...node,
      props: {
        ...node.props,
        ...partialProps,
      },
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

  return {
    ...node,
    children: nextChildren,
  };
}

export function insertChildNode(
  node: CanvasNode,
  parentId: string,
  newNode: CanvasNode,
): { next: CanvasNode; inserted: boolean } {
  if (node.id === parentId) {
    return {
      next: {
        ...node,
        children: [...node.children, newNode],
      },
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

  return {
    next: {
      ...node,
      children: nextChildren,
    },
    inserted: true,
  };
}

export function removeNodeFromTree(
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

  return {
    next: {
      ...node,
      children: nextChildren,
    },
    removed: true,
  };
}

function findPathToNode(
  node: CanvasNode,
  targetId: string,
  path: number[] = [],
): number[] | null {
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
    const nextChildren = node.children.filter((_, childIndex) => childIndex !== index);

    if (nextChildren.length === node.children.length) {
      return { next: node, removed: null };
    }

    return {
      next: {
        ...node,
        children: nextChildren,
      },
      removed: removedNode,
    };
  }

  const child = node.children[index];
  const { next: nextChild, removed } = removeNodeAtPath(child, rest);

  if (!removed) {
    return { next: node, removed: null };
  }

  const nextChildren = node.children.slice();
  nextChildren[index] = nextChild;

  return {
    next: {
      ...node,
      children: nextChildren,
    },
    removed,
  };
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

    return {
      next: {
        ...node,
        children: nextChildren,
      },
      inserted: true,
    };
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

  if (nextChild === child) {
    return { next: node, inserted: true };
  }

  const nextChildren = node.children.slice();
  nextChildren[childIndex] = nextChild;

  return {
    next: {
      ...node,
      children: nextChildren,
    },
    inserted: true,
  };
}

export function moveNodeWithinParent(
  root: CanvasNode,
  nodeId: string,
  direction: 'up' | 'down',
): CanvasNode {
  if (root.id === nodeId) {
    return root;
  }

  const { next, moved } = (function move(node: CanvasNode): {
    next: CanvasNode;
    moved: boolean;
  } {
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

      return {
        next: {
          ...node,
          children: nextChildren,
        },
        moved: true,
      };
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

    return {
      next: {
        ...node,
        children: nextChildren,
      },
      moved: true,
    };
  })(root);

  return moved ? next : root;
}

export function moveNodeToParent(
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

// Initial page starts with a blank frame - user adds sections from picker
const initialPage: Page = {
  id: 'page-1',
  name: 'Page 1',
  type: 'landing',
  canvasRoot: {
    id: 'frame-1',
    type: 'frame',
    props: {},
    children: [], // Empty - user adds sections from SectionPicker
  },
};

export type EditorSnapshot = {
  pages: Page[];
  activePageId: string;
  selectedNodeId: string | null;
  mode: EditorState['mode'];
  /** Phase 33: Guided authoring mode (build/refine/convert) - UI only, not persisted */
  guidedMode: GuidedMode;
  /** AI-powered layout suggestions (silent intelligence layer) */
  layoutSuggestions: LayoutSuggestion[];
  /** Temporarily highlighted node IDs (for suggestion preview/feedback) */
  highlightedNodeIds: string[];
};

type HistoryState = {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
};

type BaseEditorAction =
  | { type: 'SET_ACTIVE_PAGE'; pageId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SET_MODE'; mode: EditorState['mode'] }
  | { type: 'SET_GUIDED_MODE'; guidedMode: GuidedMode }
  | { type: 'COMMIT_NODE_PROPS'; nodeId: string; partialProps: Record<string, unknown> }
  | { type: 'UPDATE_PAGE_PROPS'; pageId: string; partialProps: Partial<Omit<Page, 'id' | 'canvasRoot'>> }
  | { type: 'ADD_NODE'; parentId: string; node: CanvasNode }
  | { type: 'ADD_PAGE'; page: Page }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'MOVE_NODE_UP'; nodeId: string }
  | { type: 'MOVE_NODE_DOWN'; nodeId: string }
  | { type: 'MOVE_NODE_TO_PARENT'; nodeId: string; targetParentId: string; targetIndex?: number }
  | { type: 'SET_LAYOUT_SUGGESTIONS'; suggestions: LayoutSuggestion[] }
  | { type: 'HIGHLIGHT_NODES'; nodeIds: string[] }
  | { type: 'APPLY_TEMPLATE'; templateId: string }
  | { type: 'PREVIEW_TEMPLATE'; templateId: string | null };

type HistoryAction = { type: 'UNDO' } | { type: 'REDO' };

/**
 * Hydration action - restores editor state from persisted document.
 * This resets undo/redo history to start clean after hydration.
 */
type HydrateAction = {
  type: 'HYDRATE_FROM_STORAGE';
  pages: Page[];
  activePageId: string;
};

type EditorAction = BaseEditorAction | HistoryAction | HydrateAction;

export type EditorStoreContextValue = {
  pages: Page[];
  activePageId: string;
  selectedNodeId: string | null;
  mode: EditorState['mode'];
  /** Phase 33: Guided authoring mode (build/refine/convert) */
  guidedMode: GuidedMode;
  editorState: EditorState;
  /** AI-powered layout suggestions (silent intelligence layer) */
  layoutSuggestions: LayoutSuggestion[];
  /** Phase 33: Filtered suggestions based on guided mode */
  filteredSuggestions: LayoutSuggestion[];
  /** Temporarily highlighted node IDs (for suggestion preview/feedback) */
  highlightedNodeIds: string[];
  dispatch: Dispatch<EditorAction>;
  selectNode: (nodeId: string | null) => void;
  setMode: (mode: EditorState['mode']) => void;
  /** Phase 33: Set guided authoring mode */
  setGuidedMode: (guidedMode: GuidedMode) => void;
  setActivePage: (pageId: string) => void;
  updateNodeProps: (nodeId: string, partialProps: Record<string, unknown>) => void;
  /** Phase 27: Update page-level properties (name, type, layoutPersonality, etc.) */
  updatePageProps: (pageId: string, partialProps: Partial<Omit<Page, 'id' | 'canvasRoot'>>) => void;
  addNode: (parentId: string, type: string) => void;
  /** Add a new page/step to the funnel */
  addPage: (stepType: string) => void;
  deleteNode: (nodeId: string) => void;
  /** Delete a page from the funnel */
  deletePage: (pageId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  moveNodeToParent: (nodeId: string, targetParentId: string, targetIndex?: number) => void;
  highlightNodes: (nodeIds: string[]) => void;
  /** Phase 32: Apply a template to the active page */
  applyTemplate: (templateId: string) => void;
  /** Phase 32: Preview template changes (highlight affected nodes) */
  previewTemplate: (templateId: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const EditorStoreContext = createContext<EditorStoreContextValue | undefined>(undefined);

const initialSnapshot: EditorSnapshot = {
  pages: [initialPage],
  activePageId: initialPage.id,
  selectedNodeId: null,
  mode: 'structure',
  guidedMode: DEFAULT_GUIDED_MODE,
  layoutSuggestions: [],
  highlightedNodeIds: [],
};

const initialHistoryState: HistoryState = {
  past: [],
  present: initialSnapshot,
  future: [],
};

const historyTrackedActions = new Set<BaseEditorAction['type']>([
  'ADD_NODE',
  'ADD_PAGE',
  'DELETE_NODE',
  'DELETE_PAGE',
  'MOVE_NODE_UP',
  'MOVE_NODE_DOWN',
  'MOVE_NODE_TO_PARENT',
  'COMMIT_NODE_PROPS',
  'UPDATE_PAGE_PROPS',
  'SET_ACTIVE_PAGE',
  'APPLY_TEMPLATE', // Phase 32: Template application is undo/redo safe
]);

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as EditorSnapshot;
}

function editorReducer(state: EditorSnapshot, action: BaseEditorAction): EditorSnapshot {
  switch (action.type) {
    case 'SET_ACTIVE_PAGE':
      return {
        ...state,
        activePageId: action.pageId,
        selectedNodeId: null,
      };
    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.nodeId,
      };
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
      };
    case 'SET_GUIDED_MODE':
      return {
        ...state,
        guidedMode: action.guidedMode,
      };
    case 'ADD_NODE': {
      const pageIndex = state.pages.findIndex((page) => page.id === state.activePageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];
      const parentNode = findNodeById(targetPage.canvasRoot, action.parentId);

      if (!parentNode) {
        return state;
      }

      const parentDefinition = ComponentRegistry[parentNode.type] ?? fallbackComponent;

      // Compatibility: legacy/step roots (e.g. welcome_step) can't have children.
      // If the user is trying to add a section to the page root, auto-wrap the
      // existing root in a "frame" so future sections can be inserted.
      if (!parentDefinition.constraints.canHaveChildren) {
        if (action.parentId !== targetPage.canvasRoot.id) {
          return state;
        }

        const nextPages = state.pages.slice();
        const frameNode: CanvasNode = {
          id: generateNodeId('frame'),
          type: 'frame',
          props: {},
          children: [targetPage.canvasRoot, action.node],
        };

        nextPages[pageIndex] = {
          ...targetPage,
          canvasRoot: frameNode,
        };

        return {
          ...state,
          pages: nextPages,
          selectedNodeId: action.node.id,
        };
      }

      const { next, inserted } = insertChildNode(targetPage.canvasRoot, action.parentId, action.node);

      if (!inserted) {
        return state;
      }

      const nextPages = state.pages.slice();

      nextPages[pageIndex] = {
        ...targetPage,
        canvasRoot: next,
      };

      return {
        ...state,
        pages: nextPages,
        selectedNodeId: action.node.id,
      };
    }
    case 'DELETE_NODE': {
      const pageIndex = state.pages.findIndex((page) => page.id === state.activePageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];

      if (targetPage.canvasRoot.id === action.nodeId) {
        return state;
      }

      const { next, removed } = removeNodeFromTree(targetPage.canvasRoot, action.nodeId);

      if (!removed) {
        return state;
      }

      const nextPages = state.pages.slice();

      nextPages[pageIndex] = {
        ...targetPage,
        canvasRoot: next,
      };

      const nextSelectedNodeId = state.selectedNodeId === action.nodeId ? null : state.selectedNodeId;

      return {
        ...state,
        pages: nextPages,
        selectedNodeId: nextSelectedNodeId,
      };
    }
    case 'ADD_PAGE': {
      return {
        ...state,
        pages: [...state.pages, action.page],
        activePageId: action.page.id,
        selectedNodeId: null,
      };
    }
    case 'DELETE_PAGE': {
      // Cannot delete the last page
      if (state.pages.length <= 1) {
        return state;
      }

      const pageIndex = state.pages.findIndex((page) => page.id === action.pageId);
      if (pageIndex === -1) {
        return state;
      }

      const nextPages = state.pages.filter((page) => page.id !== action.pageId);
      
      // If deleting the active page, switch to an adjacent page
      let nextActivePageId = state.activePageId;
      if (state.activePageId === action.pageId) {
        nextActivePageId = pageIndex > 0 
          ? nextPages[pageIndex - 1].id 
          : nextPages[0].id;
      }

      return {
        ...state,
        pages: nextPages,
        activePageId: nextActivePageId,
        selectedNodeId: null,
      };
    }
    case 'COMMIT_NODE_PROPS': {
      const nextPages = state.pages.map((page) => {
        if (page.id !== state.activePageId) {
          return page;
        }

        const nextRoot = updateNodePropsInTree(page.canvasRoot, action.nodeId, action.partialProps);

        if (nextRoot === page.canvasRoot) {
          return page;
        }

        return {
          ...page,
          canvasRoot: nextRoot,
        };
      });

      const didChange = nextPages.some((page, index) => page !== state.pages[index]);

      if (!didChange) {
        return state;
      }

      // Phase 29: Clear suggestions that affect the edited node
      // This ensures suggestions are cleared on manual edit in affected area
      const clearedSuggestions = clearSuggestionsForNode(action.nodeId, state.layoutSuggestions);

      return {
        ...state,
        pages: nextPages,
        layoutSuggestions: clearedSuggestions,
      };
    }
    case 'MOVE_NODE_UP':
    case 'MOVE_NODE_DOWN': {
      const pageIndex = state.pages.findIndex((page) => page.id === state.activePageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];
      const direction = action.type === 'MOVE_NODE_UP' ? 'up' : 'down';
      const nextRoot = moveNodeWithinParent(targetPage.canvasRoot, action.nodeId, direction);

      if (nextRoot === targetPage.canvasRoot) {
        return state;
      }

      const nextPages = state.pages.slice();

      nextPages[pageIndex] = {
        ...targetPage,
        canvasRoot: nextRoot,
      };

      return {
        ...state,
        pages: nextPages,
        selectedNodeId: action.nodeId,
      };
    }
    case 'MOVE_NODE_TO_PARENT': {
      const pageIndex = state.pages.findIndex((page) => page.id === state.activePageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];
      const nextRoot = moveNodeToParent(
        targetPage.canvasRoot,
        action.nodeId,
        action.targetParentId,
        action.targetIndex,
      );

      if (nextRoot === targetPage.canvasRoot) {
        return state;
      }

      const nextPages = state.pages.slice();

      nextPages[pageIndex] = {
        ...targetPage,
        canvasRoot: nextRoot,
      };

      return {
        ...state,
        pages: nextPages,
        selectedNodeId: action.nodeId,
      };
    }
    case 'UPDATE_PAGE_PROPS': {
      const pageIndex = state.pages.findIndex((page) => page.id === action.pageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];
      const nextPage = {
        ...targetPage,
        ...action.partialProps,
        // Preserve immutable fields
        id: targetPage.id,
        canvasRoot: targetPage.canvasRoot,
      };

      // Check if anything actually changed
      const hasChanges = Object.keys(action.partialProps).some(
        (key) => targetPage[key as keyof typeof targetPage] !== action.partialProps[key as keyof typeof action.partialProps]
      );

      if (!hasChanges) {
        return state;
      }

      const nextPages = state.pages.slice();
      nextPages[pageIndex] = nextPage;

      return {
        ...state,
        pages: nextPages,
      };
    }
    case 'SET_LAYOUT_SUGGESTIONS':
      return {
        ...state,
        layoutSuggestions: action.suggestions,
      };
    case 'HIGHLIGHT_NODES':
      return {
        ...state,
        highlightedNodeIds: action.nodeIds,
      };
    // Phase 32: Template application
    case 'APPLY_TEMPLATE': {
      const pageIndex = state.pages.findIndex((page) => page.id === state.activePageId);

      if (pageIndex === -1) {
        return state;
      }

      const targetPage = state.pages[pageIndex];
      const result = applyTemplate(targetPage, action.templateId);

      if (!result.success) {
        return state;
      }

      const nextPages = state.pages.slice();
      nextPages[pageIndex] = result.page;

      // Clear template suggestions after application
      const filteredSuggestions = state.layoutSuggestions.filter(
        (s) => !('templateId' in s) || (s as TemplateSuggestion).templateId !== action.templateId
      );

      return {
        ...state,
        pages: nextPages,
        layoutSuggestions: filteredSuggestions,
        highlightedNodeIds: [], // Clear preview highlights
      };
    }
    // Phase 32: Template preview (highlight affected nodes)
    case 'PREVIEW_TEMPLATE': {
      if (!action.templateId) {
        return {
          ...state,
          highlightedNodeIds: [],
        };
      }

      const activePage = state.pages.find((page) => page.id === state.activePageId);
      if (!activePage) {
        return state;
      }

      const affectedIds = previewTemplateApplication(activePage, action.templateId);

      return {
        ...state,
        highlightedNodeIds: affectedIds,
      };
    }
    default:
      return state;
  }
}

function historyReducer(state: HistoryState, action: EditorAction): HistoryState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) {
      return state;
    }

    const previous = state.past[state.past.length - 1];

    // Clear layout suggestions on undo (will be recomputed)
    return {
      past: state.past.slice(0, -1),
      present: { ...cloneSnapshot(previous), layoutSuggestions: [], highlightedNodeIds: [] },
      future: [cloneSnapshot(state.present), ...state.future],
    };
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) {
      return state;
    }

    const [next, ...rest] = state.future;

    // Clear layout suggestions on redo (will be recomputed)
    return {
      past: [...state.past, cloneSnapshot(state.present)],
      present: { ...cloneSnapshot(next), layoutSuggestions: [], highlightedNodeIds: [] },
      future: rest,
    };
  }

  // Handle hydration - resets history to start clean
  if (action.type === 'HYDRATE_FROM_STORAGE') {
    // Validate that activePageId exists in pages
    const pageIds = new Set(action.pages.map((p) => p.id));
    const safeActivePageId = pageIds.has(action.activePageId)
      ? action.activePageId
      : action.pages[0]?.id ?? state.present.activePageId;

    return {
      past: [],
      present: {
        pages: action.pages,
        activePageId: safeActivePageId,
        // Selection defaults safely - no node selected after hydration
        selectedNodeId: null,
        // Mode defaults to structure view
        mode: 'structure',
        // Phase 33: Guided mode defaults to 'build' (not persisted)
        guidedMode: DEFAULT_GUIDED_MODE,
        // Layout suggestions will be computed after hydration
        layoutSuggestions: [],
        // No highlighted nodes after hydration
        highlightedNodeIds: [],
      },
      future: [],
    };
  }

  const nextPresent = editorReducer(state.present, action);

  if (nextPresent === state.present) {
    return state;
  }

  if (historyTrackedActions.has(action.type as BaseEditorAction['type'])) {
    return {
      past: [...state.past, cloneSnapshot(state.present)],
      present: cloneSnapshot(nextPresent),
      future: [],
    };
  }

  return {
    ...state,
    present: nextPresent,
  };
}

type EditorProviderProps = {
  children: ReactNode;
  /** Optional initial document to hydrate from (e.g., from database) */
  initialDocument?: EditorDocument | null;
};

export function EditorProvider({ children, initialDocument }: EditorProviderProps) {
  // If we have an initial document, create initial state from it
  const computedInitialState = useMemo((): HistoryState => {
    if (initialDocument && initialDocument.pages && initialDocument.pages.length > 0) {
      return {
        past: [],
        present: {
          pages: initialDocument.pages as Page[],
          activePageId: initialDocument.activePageId || initialDocument.pages[0]?.id || 'page-1',
          selectedNodeId: null,
          mode: 'structure',
          guidedMode: DEFAULT_GUIDED_MODE,
          layoutSuggestions: [],
          highlightedNodeIds: [],
        },
        future: [],
      };
    }
    return initialHistoryState;
  }, [initialDocument]);

  const [state, dispatch] = useReducer(historyReducer, computedInitialState);
  
  // Track if we've hydrated to avoid double-hydration
  const hasHydratedRef = useRef(!!initialDocument);
  
  // Create debounced save function (stable reference)
  const debouncedSaveRef = useRef(createDebouncedSave(750));
  
  // Track last dispatched action for persistence decisions
  const lastActionRef = useRef<string | null>(null);

  // Hydration on mount - only if no initial document was provided
  useEffect(() => {
    if (hasHydratedRef.current) {
      return;
    }
    hasHydratedRef.current = true;

    const storedDocument = loadFromStorage();
    
    if (storedDocument) {
      console.debug('[Persistence] Hydrating editor from stored document');
      dispatch({
        type: 'HYDRATE_FROM_STORAGE',
        pages: storedDocument.pages,
        activePageId: storedDocument.activePageId,
      });
    } else {
      console.debug('[Persistence] No stored document found, using initial state');
    }
  }, []);

  // Persistence effect - save after history-committed actions
  useEffect(() => {
    // Don't persist during initial mount or after hydration
    if (!hasHydratedRef.current) {
      return;
    }
    
    // Check if the last action should trigger persistence
    if (lastActionRef.current && shouldPersistAfterAction(lastActionRef.current)) {
      const document = extractDocument(state.present.pages, state.present.activePageId);
      debouncedSaveRef.current.scheduleSave(document);
    }
  }, [state.present.pages, state.present.activePageId]);

  // Flush pending saves on unmount
  useEffect(() => {
    const { flushPending } = debouncedSaveRef.current;
    return () => {
      flushPending();
    };
  }, []);

  // Layout Intelligence - compute suggestions on meaningful edits (debounced)
  // Phase 29: Now includes composition intelligence for guided composition
  // Phase 30: Now includes AI structural intelligence on hydration/import
  useEffect(() => {
    // Skip if not hydrated yet
    if (!hasHydratedRef.current) {
      return;
    }

    // Only recompute on meaningful actions
    const shouldRecompute =
      !lastActionRef.current ||
      shouldRecomputeSuggestions(lastActionRef.current) ||
      shouldRecomputeComposition(lastActionRef.current);
    
    if (!shouldRecompute) {
      return;
    }

    // Find the active page
    const activePage = state.present.pages.find((p) => p.id === state.present.activePageId);
    if (!activePage) {
      return;
    }

    // Debounce suggestion computation to avoid performance issues
    const timeoutId = setTimeout(() => {
      // Compute layout suggestions
      const context = createLayoutContext(activePage);
      const layoutSuggestions = analyzeLayout(context);
      
      // Phase 29: Compute composition suggestions
      const compositionSuggestions = analyzeComposition(activePage);
      
      // Phase 30: Compute AI structural suggestions (only on hydration/import)
      let aiSuggestions: AISuggestion[] = [];
      if (lastActionRef.current && shouldRunStructuralAnalysis(lastActionRef.current)) {
        const structuralAnalysis = analyzeStructure(activePage);
        aiSuggestions = structuralAnalysis.suggestions;
      }
      
      // Phase 31: Compute template-aware suggestion (only on hydration/import, max 1)
      let templateSuggestion: TemplateSuggestion | null = null;
      if (lastActionRef.current && shouldRunTemplateAnalysis(lastActionRef.current)) {
        const { suggestion } = analyzeTemplateMatch(activePage);
        templateSuggestion = suggestion;
      }
      
      // Phase 29-31: Merge suggestions (layout first, then composition, then AI, then template, max 3 total)
      const allCompositionSuggestions = [
        ...compositionSuggestions,
        ...aiSuggestions,
        ...(templateSuggestion ? [templateSuggestion] : []),
      ];
      const mergedSuggestions = mergeWithLayoutSuggestions(
        layoutSuggestions,
        allCompositionSuggestions,
        3
      );

      // Only dispatch if suggestions actually changed
      const currentSuggestionIds = state.present.layoutSuggestions.map((s) => s.id).join(',');
      const newSuggestionIds = mergedSuggestions.map((s) => s.id).join(',');
      
      if (currentSuggestionIds !== newSuggestionIds) {
        dispatch({ type: 'SET_LAYOUT_SUGGESTIONS', suggestions: mergedSuggestions });
        
        // Silent logging for development - remove in production
        if (mergedSuggestions.length > 0 && process.env.NODE_ENV === 'development') {
          console.debug('[Layout Intelligence] Suggestions computed:', {
            layout: layoutSuggestions.length,
            composition: compositionSuggestions.length,
            ai: aiSuggestions.length,
            template: templateSuggestion ? 1 : 0,
            merged: mergedSuggestions.length,
          });
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [state.present.pages, state.present.activePageId]);

  // Wrap dispatch to track action types for persistence decisions
  const wrappedDispatch = useCallback<Dispatch<EditorAction>>((action) => {
    lastActionRef.current = action.type;
    dispatch(action);
  }, []);

  const selectNode = useCallback(
    (nodeId: string | null) => wrappedDispatch({ type: 'SELECT_NODE', nodeId }),
    [wrappedDispatch],
  );

  const setMode = useCallback(
    (mode: EditorState['mode']) => wrappedDispatch({ type: 'SET_MODE', mode }),
    [wrappedDispatch],
  );

  // Phase 33: Guided authoring mode setter
  const setGuidedMode = useCallback(
    (guidedMode: GuidedMode) => wrappedDispatch({ type: 'SET_GUIDED_MODE', guidedMode }),
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

  // Phase 27: Update page-level properties
  const updatePageProps = useCallback(
    (pageId: string, partialProps: Partial<Omit<Page, 'id' | 'canvasRoot'>>) =>
      wrappedDispatch({ type: 'UPDATE_PAGE_PROPS', pageId, partialProps }),
    [wrappedDispatch],
  );

  const addNode = useCallback(
    (parentId: string, type: string) => {
      const definition = ComponentRegistry[type] ?? fallbackComponent;
      
      // Phase 28: Get active page personality for intent defaults
      const activePage = state.present.pages.find((p) => p.id === state.present.activePageId);
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
    [wrappedDispatch, state.present.pages, state.present.activePageId],
  );

  const deleteNode = useCallback(
    (nodeId: string) => wrappedDispatch({ type: 'DELETE_NODE', nodeId }),
    [wrappedDispatch],
  );

  // Add a new page/step to the funnel
  const addPage = useCallback(
    (stepType: string) => {
      const pageId = generateNodeId('page');
      const rootId = generateNodeId('step');
      
      // Map step type to page type
      const pageType = (() => {
        if (stepType === 'welcome') return 'landing';
        if (stepType === 'opt_in' || stepType === 'email_capture' || stepType === 'phone_capture') return 'optin';
        if (stepType === 'embed') return 'appointment';
        if (stepType === 'thank_you') return 'thank_you';
        return 'landing';
      })() as Page['type'];

      // Create default props based on step type
      const defaultProps: Record<string, unknown> = {
        headline: getDefaultHeadline(stepType),
        subtext: getDefaultSubtext(stepType),
        buttonText: 'Continue',
      };

      const newPage: Page = {
        id: pageId,
        name: getStepLabel(stepType),
        type: pageType,
        canvasRoot: {
          id: rootId,
          type: `${stepType}_step`,
          props: defaultProps,
          children: [],
        },
      };

      wrappedDispatch({ type: 'ADD_PAGE', page: newPage });
    },
    [wrappedDispatch],
  );

  // Delete a page from the funnel
  const deletePage = useCallback(
    (pageId: string) => wrappedDispatch({ type: 'DELETE_PAGE', pageId }),
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

  const highlightNodes = useCallback(
    (nodeIds: string[]) => wrappedDispatch({ type: 'HIGHLIGHT_NODES', nodeIds }),
    [wrappedDispatch],
  );

  const applyTemplateCallback = useCallback(
    (templateId: string) => wrappedDispatch({ type: 'APPLY_TEMPLATE', templateId }),
    [wrappedDispatch],
  );

  const previewTemplateCallback = useCallback(
    (templateId: string | null) => wrappedDispatch({ type: 'PREVIEW_TEMPLATE', templateId }),
    [wrappedDispatch],
  );

  const undo = useCallback(() => wrappedDispatch({ type: 'UNDO' }), [wrappedDispatch]);
  const redo = useCallback(() => wrappedDispatch({ type: 'REDO' }), [wrappedDispatch]);

  const editorState = useMemo<EditorState>(
    () => ({
      selectedPageId: state.present.activePageId,
      selectedNodeId: state.present.selectedNodeId,
      mode: state.present.mode,
    }),
    [state.present.activePageId, state.present.selectedNodeId, state.present.mode],
  );

  // Phase 33: Filter suggestions based on guided mode
  const filteredSuggestions = useMemo(() => {
    const allowedIntents = GUIDED_MODE_SUGGESTION_INTENTS[state.present.guidedMode];
    return state.present.layoutSuggestions.filter((suggestion) => {
      // Check suggestion type against allowed intents
      const suggestionIntent = suggestion.type;
      return allowedIntents.has(suggestionIntent) || allowedIntents.has('structure');
    }).slice(0, 3); // Max 3 suggestions
  }, [state.present.layoutSuggestions, state.present.guidedMode]);

  const value = useMemo<EditorStoreContextValue>(
    () => ({
      pages: state.present.pages,
      activePageId: state.present.activePageId,
      selectedNodeId: state.present.selectedNodeId,
      mode: state.present.mode,
      guidedMode: state.present.guidedMode,
      editorState,
      layoutSuggestions: state.present.layoutSuggestions,
      filteredSuggestions,
      highlightedNodeIds: state.present.highlightedNodeIds,
      dispatch: wrappedDispatch,
      selectNode,
      setMode,
      setGuidedMode,
      setActivePage,
      updateNodeProps,
      updatePageProps,
      addNode,
      addPage,
      deleteNode,
      deletePage,
      moveNodeUp,
      moveNodeDown,
      moveNodeToParent: moveNodeToParentCallback,
      highlightNodes,
      applyTemplate: applyTemplateCallback,
      previewTemplate: previewTemplateCallback,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [
      state.present.pages,
      state.present.activePageId,
      state.present.selectedNodeId,
      state.present.mode,
      state.present.guidedMode,
      state.present.layoutSuggestions,
      state.present.highlightedNodeIds,
      state.past.length,
      state.future.length,
      editorState,
      filteredSuggestions,
      wrappedDispatch,
      selectNode,
      setMode,
      setGuidedMode,
      setActivePage,
      updateNodeProps,
      updatePageProps,
      addNode,
      addPage,
      deleteNode,
      deletePage,
      moveNodeUp,
      moveNodeDown,
      moveNodeToParentCallback,
      highlightNodes,
      applyTemplateCallback,
      previewTemplateCallback,
      undo,
      redo,
    ],
  );

  return <EditorStoreContext.Provider value={value}>{children}</EditorStoreContext.Provider>;
}

/**
 * Adapter context for multi-document integration.
 * When components are used within MultiDocumentProvider + EditorStoreAdapter,
 * they receive state from the multi-doc store through this context.
 */
export const EditorStoreAdapterContext = createContext<EditorStoreContextValue | null>(null);

/**
 * Hook to access editor store state.
 * Checks adapter context first (for multi-doc mode), then falls back to direct context.
 */
export function useEditorStore(): EditorStoreContextValue {
  const adapterContext = useContext(EditorStoreAdapterContext);
  const directContext = useContext(EditorStoreContext);

  // Prefer adapter context (multi-doc mode) if available
  if (adapterContext) {
    return adapterContext;
  }

  // Fall back to direct context (single-doc mode)
  if (directContext) {
    return directContext;
  }

  throw new Error(
    'useEditorStore must be used within an EditorProvider or MultiDocumentProvider with EditorStoreAdapter',
  );
}
