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
      dispatch,
      selectNode: multiDocStore.selectNode,
      setMode: multiDocStore.setMode,
      setActivePage: multiDocStore.setActivePage,
      updateNodeProps: multiDocStore.updateNodeProps,
      addNode: multiDocStore.addNode,
      deleteNode: multiDocStore.deleteNode,
      moveNodeUp: multiDocStore.moveNodeUp,
      moveNodeDown: multiDocStore.moveNodeDown,
      moveNodeToParent: multiDocStore.moveNodeToParent,
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
