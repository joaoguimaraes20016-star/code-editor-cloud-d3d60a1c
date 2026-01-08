/**
 * Phase 13: Editor Store Adapter
 *
 * This module provides a bridge between the multi-document store and
 * components that use the legacy single-document useEditorStore hook.
 *
 * It exports a context provider that wraps components and provides
 * the same interface as useEditorStore but backed by the multi-document store.
 */

import { useMemo, type ReactNode } from 'react';

import type { EditorStoreContextValue } from './editorStore';
import { EditorStoreAdapterContext } from './editorStore';
import { useMultiDocumentStore } from './multiDocStore';
import { DEFAULT_GUIDED_MODE } from '../editorMode';

/**
 * Provider that adapts multi-document store to legacy editor store interface.
 * Wrap components that use useEditorStore with this when inside MultiDocumentProvider.
 */
export function EditorStoreAdapter({ children }: { children: ReactNode }) {
  const multiDocStore = useMultiDocumentStore();

  const adaptedValue = useMemo<EditorStoreContextValue>(() => {
    // Create a dispatch wrapper that maps to multi-doc dispatch
    const dispatch = multiDocStore.dispatch as EditorStoreContextValue['dispatch'];

    return {
      pages: multiDocStore.pages,
      activePageId: multiDocStore.activePageId,
      selectedNodeId: multiDocStore.selectedNodeId,
      mode: multiDocStore.mode,
      editorState: multiDocStore.editorState,
      // Phase 33: Guided mode - provide defaults since multiDocStore may not have these
      guidedMode: (multiDocStore as any).guidedMode ?? DEFAULT_GUIDED_MODE,
      layoutSuggestions: (multiDocStore as any).layoutSuggestions ?? [],
      filteredSuggestions: (multiDocStore as any).filteredSuggestions ?? [],
      highlightedNodeIds: (multiDocStore as any).highlightedNodeIds ?? [],
      dispatch,
      selectNode: multiDocStore.selectNode,
      setMode: multiDocStore.setMode,
      setGuidedMode: (multiDocStore as any).setGuidedMode ?? (() => {}),
      setActivePage: multiDocStore.setActivePage,
      updateNodeProps: multiDocStore.updateNodeProps,
      updatePageProps: (multiDocStore as any).updatePageProps ?? (() => {}),
      addNode: multiDocStore.addNode,
      addPage: (multiDocStore as any).addPage ?? (() => {}),
      deleteNode: multiDocStore.deleteNode,
      deletePage: (multiDocStore as any).deletePage ?? (() => {}),
      moveNodeUp: multiDocStore.moveNodeUp,
      moveNodeDown: multiDocStore.moveNodeDown,
      moveNodeToParent: multiDocStore.moveNodeToParent,
      highlightNodes: (multiDocStore as any).highlightNodes ?? (() => {}),
      applyTemplate: (multiDocStore as any).applyTemplate ?? (() => {}),
      previewTemplate: (multiDocStore as any).previewTemplate ?? (() => {}),
      undo: multiDocStore.undo,
      redo: multiDocStore.redo,
      canUndo: multiDocStore.canUndo,
      canRedo: multiDocStore.canRedo,
    };
  }, [multiDocStore]);

  return (
    <EditorStoreAdapterContext.Provider value={adaptedValue}>
      {children}
    </EditorStoreAdapterContext.Provider>
  );
}