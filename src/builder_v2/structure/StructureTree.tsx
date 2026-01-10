import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import { findNodeById, useEditorStore } from '../state/editorStore';
import { getNodeLabel } from '../utils/nodeLabels';
import type { CanvasNode } from '../types';

const addableTypes = ['heading', 'paragraph', 'cta_button', 'image_block', 'spacer', 'section'];

type DragTarget = { parentId: string; insertIndex: number; indicatorY: number; indicatorLeft: number; indicatorWidth: number };

type DragState = {
  isDragging: boolean;
  draggedNodeId: string | null;
  ghost:
    | {
        x: number;
        y: number;
        width: number;
        label: string;
      }
    | null;
  dropTarget: DragTarget | null;
  dropValid: boolean;
};

type NodeInfo = {
  parentId: string | null;
  index: number;
  node: CanvasNode;
};

type StructureNodeProps = {
  node: CanvasNode;
  depth: number;
  index: number;
  siblingsCount: number;
  parentId: string | null;
  isReadOnly: boolean;
  onPointerDown: (
    event: React.MouseEvent<HTMLDivElement>,
    payload: {
      node: CanvasNode;
      depth: number;
      parentId: string | null;
      index: number;
      label: string;
      canHaveChildren: boolean;
    },
  ) => void;
};

function StructureNode({
  node,
  depth,
  index,
  siblingsCount,
  parentId,
  onPointerDown,
  isReadOnly,
}: StructureNodeProps) {
  const {
    selectedNodeId,
    selectNode,
    addNode,
    deleteNode,
    moveNodeUp,
    moveNodeDown,
  } = useEditorStore();
  const definition = ComponentRegistry[node.type] ?? fallbackComponent;
  const label = definition.displayName ?? node.type;
  const isSelected = selectedNodeId === node.id;
  const canHaveChildren = definition.constraints?.canHaveChildren ?? false;
  const isFirstSibling = index === 0;
  const isLastSibling = index === siblingsCount - 1;
  const indentStyle = {
    '--builder-v2-structure-depth': depth.toString(),
  } as React.CSSProperties;

  return (
    <div className="builder-v2-structure-node">
      <div
        className="builder-v2-structure-row"
        data-structure-node-id={node.id}
        data-parent-id={parentId ?? ''}
        data-node-index={index}
        data-can-have-children={canHaveChildren ? 'true' : undefined}
        data-selected={isSelected}
        data-depth={depth}
        aria-selected={isSelected}
        aria-disabled={isReadOnly}
        style={indentStyle}
        onClick={(event) => {
          event.stopPropagation();

          if (isReadOnly) {
            return;
          }

          selectNode(node.id);
        }}
        onMouseDown={(event) => {
          if (isReadOnly) {
            return;
          }

          if ((event.target as HTMLElement)?.closest('button')) {
            return;
          }

          onPointerDown(event, {
            node,
            depth,
            parentId,
            index,
            label,
            canHaveChildren,
          });
        }}
      >
        <div className="builder-v2-structure-row-content">
          <span className="builder-v2-structure-row-label">{label}</span>
          <span className="builder-v2-structure-row-type">{getNodeLabel(node.type)}</span>
        </div>

        {!isReadOnly && (
          <div className="builder-v2-structure-row-controls">
            <div className="builder-v2-structure-row-controls-group">
              <button
                type="button"
                className="builder-v2-structure-chip"
                disabled={isFirstSibling}
                onClick={(event) => {
                  event.stopPropagation();
                  moveNodeUp(node.id);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="builder-v2-structure-chip"
                disabled={isLastSibling}
                onClick={(event) => {
                  event.stopPropagation();
                  moveNodeDown(node.id);
                }}
              >
                ↓
              </button>
            </div>
            {canHaveChildren && (
              <div className="builder-v2-structure-row-controls-group">
                <button
                  type="button"
                  className="builder-v2-structure-chip builder-v2-structure-chip--add"
                  onClick={(event) => {
                    event.stopPropagation();
                    addNode(node.id, 'heading');
                  }}
                >
                  + Add
                </button>
              </div>
            )}
            {/* Allow deleting any element - removed depth > 0 constraint */}
            <button
              type="button"
              className="builder-v2-structure-chip builder-v2-structure-chip--danger"
              onClick={(event) => {
                event.stopPropagation();
                deleteNode(node.id);
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <div className="builder-v2-structure-children">
        {node.children.map((child, childIndex) => (
          <StructureNode
            key={child.id}
            node={child}
            depth={depth + 1}
            index={childIndex}
            siblingsCount={node.children.length}
            parentId={node.id}
            onPointerDown={onPointerDown}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  );
}

export function StructureTree() {
  const store = useEditorStore();
  const { pages, activePageId, selectNode, moveNodeToParent, mode } = store;
  const isPreview = mode === 'preview';
  const activePage = pages.find((page) => page.id === activePageId) ?? null;

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    ghost: null,
    dropTarget: null,
    dropValid: false,
  });

  const pointerRef = useRef<{
    isPointerDown: boolean;
    startX: number;
    startY: number;
    startTime: number;
    depth: number;
    parentId: string | null;
    index: number;
    nodeId: string | null;
    label: string;
    canHaveChildren: boolean;
    rowRect: DOMRect | null;
    timer: number | null;
  }>({
    isPointerDown: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    depth: 0,
    parentId: null,
    index: 0,
    nodeId: null,
    label: '',
    canHaveChildren: false,
    rowRect: null,
    timer: null,
  });

  const activeRoot = activePage?.canvasRoot ?? null;

  const nodeInfoMap = useMemo(() => {
    const map = new Map<string, NodeInfo>();

    function walk(node: CanvasNode) {
      node.children.forEach((child, childIndex) => {
        map.set(child.id, { parentId: node.id, index: childIndex, node: child });
        walk(child);
      });
    }

    if (activeRoot) {
      map.set(activeRoot.id, { parentId: null, index: 0, node: activeRoot });
      walk(activeRoot);
    }

    return map;
  }, [activeRoot]);

  const resetDrag = () => {
    if (pointerRef.current.timer) {
      window.clearTimeout(pointerRef.current.timer);
    }

    pointerRef.current = {
      isPointerDown: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      depth: 0,
      parentId: null,
      index: 0,
      nodeId: null,
      label: '',
      canHaveChildren: false,
      rowRect: null,
      timer: null,
    };

    setDragState({
      isDragging: false,
      draggedNodeId: null,
      ghost: null,
      dropTarget: null,
      dropValid: false,
    });
  };

  const containsNode = (node: CanvasNode | null, targetId: string): boolean => {
    if (!node) {
      return false;
    }

    if (node.id === targetId) {
      return true;
    }

    return node.children.some((child) => containsNode(child, targetId));
  };

  const findParentInfo = (targetId: string): { parentId: string | null; index: number } | null => {
    const info = nodeInfoMap.get(targetId);

    if (!info) {
      return null;
    }

    return { parentId: info.parentId, index: info.index };
  };

  const validateDrop = (
    draggedNodeId: string,
    targetParentId: string,
    insertIndex: number,
  ): boolean => {
    if (!activeRoot) {
      return false;
    }

    if (!draggedNodeId || !targetParentId) {
      return false;
    }

    if (draggedNodeId === targetParentId) {
      return false;
    }

    const draggedNode = findNodeById(activeRoot, draggedNodeId);
    const targetParent = findNodeById(activeRoot, targetParentId);

    if (!draggedNode || !targetParent) {
      return false;
    }

    if (containsNode(draggedNode, targetParentId)) {
      return false;
    }

    const parentDefinition = ComponentRegistry[targetParent.type] ?? fallbackComponent;

    if (!parentDefinition.constraints.canHaveChildren) {
      return false;
    }

    const parentInfo = findParentInfo(draggedNodeId);

    if (parentInfo && parentInfo.parentId === targetParentId && parentInfo.index === insertIndex) {
      return false;
    }

    return insertIndex >= 0;
  };

  const startDrag = (clientX: number, clientY: number) => {
    if (isPreview) {
      return;
    }

    const meta = pointerRef.current;

    if (!meta.nodeId || meta.depth === 0) {
      return;
    }

    if (meta.timer) {
      window.clearTimeout(meta.timer);
      meta.timer = null;
    }

    meta.isPointerDown = false;

    setDragState((prev) => ({
      ...prev,
      isDragging: true,
      draggedNodeId: meta.nodeId,
      ghost: meta.rowRect
        ? {
            x: clientX + 12,
            y: clientY + 12,
            width: meta.rowRect.width,
            label: meta.label,
          }
        : null,
    }));

    selectNode(meta.nodeId);
  };

  const resolveZoneDrop = (
    hoveredEl: HTMLElement,
    clientY: number,
  ): { target: DragTarget | null; valid: boolean } => {
    if (!activeRoot || !dragState.draggedNodeId) {
      return { target: null, valid: false };
    }

    const hoveredId = hoveredEl.getAttribute('data-structure-node-id') ?? '';
    const parentId = hoveredEl.getAttribute('data-parent-id') ?? '';
    const indexAttr = hoveredEl.getAttribute('data-node-index');
    const canHaveChildrenAttr = hoveredEl.getAttribute('data-can-have-children');

    if (!indexAttr) {
      return { target: null, valid: false };
    }

    const hoveredIndex = Number(indexAttr);
    const canHaveChildren = canHaveChildrenAttr === 'true';
    const rect = hoveredEl.getBoundingClientRect();
    const topBoundary = rect.top + rect.height * 0.25;
    const bottomBoundary = rect.bottom - rect.height * 0.25;

    let targetParentId = parentId;
    let insertIndex = hoveredIndex;
    let indicatorY = rect.top;

    if (clientY < topBoundary) {
      targetParentId = parentId;
      insertIndex = hoveredIndex;
      indicatorY = rect.top;
    } else if (clientY > bottomBoundary) {
      targetParentId = parentId;
      insertIndex = hoveredIndex + 1;
      indicatorY = rect.bottom;
    } else {
      if (canHaveChildren) {
        targetParentId = hoveredId;
        insertIndex = 0;
        indicatorY = rect.top + rect.height / 2;
      } else {
        targetParentId = parentId;
        insertIndex = hoveredIndex + 1;
        indicatorY = rect.bottom;
      }
    }

    if (!targetParentId) {
      return { target: null, valid: false };
    }

    const valid = validateDrop(dragState.draggedNodeId, targetParentId, insertIndex);

    const target: DragTarget = {
      parentId: targetParentId,
      insertIndex,
      indicatorY,
      indicatorLeft: rect.left,
      indicatorWidth: rect.width,
    };

    return { target, valid };
  };

  const handlePointerDown: StructureNodeProps['onPointerDown'] = (event, payload) => {
    if (isPreview) {
      return;
    }

    if (payload.depth === 0) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const rowRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    pointerRef.current = {
      isPointerDown: true,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now(),
      depth: payload.depth,
      parentId: payload.parentId,
      index: payload.index,
      nodeId: payload.node.id,
      label: payload.label,
      canHaveChildren: payload.canHaveChildren,
      rowRect,
      timer: window.setTimeout(() => {
        startDrag(event.clientX, event.clientY);
      }, 200),
    };
  };

  useEffect(() => {
    if (isPreview) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const meta = pointerRef.current;

      if (!meta.isPointerDown && !dragState.isDragging) {
        return;
      }

      if (meta.isPointerDown && !dragState.isDragging) {
        const distance = Math.hypot(event.clientX - meta.startX, event.clientY - meta.startY);
        const elapsed = Date.now() - meta.startTime;

        if (distance > 5 || elapsed > 200) {
          startDrag(event.clientX, event.clientY);
        }
      }

      if (!dragState.isDragging) {
        return;
      }

      setDragState((prev) => ({
        ...prev,
        ghost: prev.ghost
          ? {
              ...prev.ghost,
              x: event.clientX + 12,
              y: event.clientY + 12,
            }
          : prev.ghost,
      }));

      const hoveredEl = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;

      if (!hoveredEl) {
        setDragState((prev) => ({ ...prev, dropTarget: null, dropValid: false }));
        return;
      }

      const rowEl = hoveredEl.closest('[data-structure-node-id]') as HTMLElement | null;

      if (!rowEl) {
        setDragState((prev) => ({ ...prev, dropTarget: null, dropValid: false }));
        return;
      }

      const { target, valid } = resolveZoneDrop(rowEl, event.clientY);

      setDragState((prev) => ({
        ...prev,
        dropTarget: target,
        dropValid: valid,
      }));
    };

    const handleMouseUp = () => {
      const meta = pointerRef.current;

      if (meta.isPointerDown && !dragState.isDragging) {
        resetDrag();
        return;
      }

      if (!dragState.isDragging) {
        return;
      }

      if (dragState.dropTarget && dragState.draggedNodeId && dragState.dropValid) {
        moveNodeToParent(
          dragState.draggedNodeId,
          dragState.dropTarget.parentId,
          dragState.dropTarget.insertIndex,
        );
      }

      resetDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragState.isDragging) {
        event.preventDefault();
        resetDrag();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState.draggedNodeId, dragState.dropTarget, dragState.dropValid, dragState.isDragging, isPreview, moveNodeToParent]);

  if (!activePage) {
    return <p className="builder-v2-placeholder">No active page.</p>;
  }

  if (!activePage.canvasRoot) {
    return <p className="builder-v2-placeholder">Empty page.</p>;
  }

  return (
    <div
      className={`builder-v2-structure-tree${
        isPreview ? ' builder-v2-structure-tree--disabled' : ''
      }`}
      aria-disabled={isPreview}
    >
      {isPreview && (
        <div className="builder-v2-structure-disabled-banner">
          Preview mode · Structure locked
        </div>
      )}
      <StructureNode
        node={activePage.canvasRoot}
        depth={0}
        index={0}
        siblingsCount={1}
        parentId={null}
        onPointerDown={handlePointerDown}
        isReadOnly={isPreview}
      />

      {dragState.isDragging && dragState.ghost && (
        <div
          className="builder-v2-dnd-ghost"
          style={{
            top: dragState.ghost.y,
            left: dragState.ghost.x,
            width: dragState.ghost.width,
          }}
        >
          {dragState.ghost.label}
        </div>
      )}

      {dragState.isDragging && dragState.dropTarget && dragState.dropValid && (
        <div
          className="builder-v2-dnd-line"
          style={{
            top: dragState.dropTarget.indicatorY,
            left: dragState.dropTarget.indicatorLeft,
            width: dragState.dropTarget.indicatorWidth,
          }}
        />
      )}
    </div>
  );
}
