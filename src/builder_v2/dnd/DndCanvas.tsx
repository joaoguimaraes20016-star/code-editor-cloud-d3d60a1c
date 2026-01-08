/**
 * DndCanvas - Drag & Drop wrapper for the canvas
 * Enables reordering sections and elements via @dnd-kit
 */

import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CanvasNode, EditorState, Page } from '../types';

interface SortableNodeProps {
  node: CanvasNode;
  children: React.ReactNode;
}

function SortableNode({ node, children }: SortableNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="builder-v2-sortable-node"
      data-dragging={isDragging || undefined}
    >
      <button
        className="builder-v2-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      {children}
    </div>
  );
}

interface DndCanvasProps {
  page: Page;
  editorState: EditorState;
  onMoveNode: (nodeId: string, targetParentId: string, targetIndex: number) => void;
  children: (renderProps: {
    SortableWrapper: typeof SortableNode;
    nodeIds: string[];
  }) => React.ReactNode;
}

export function DndCanvas({ page, editorState, onMoveNode, children }: DndCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get section IDs from the page root's children
  const sectionIds = page.canvasRoot.children.map((child) => child.id);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const activeIndex = sectionIds.indexOf(active.id as string);
      const overIndex = sectionIds.indexOf(over.id as string);

      if (activeIndex !== -1 && overIndex !== -1) {
        // Moving within the same parent (page root)
        onMoveNode(active.id as string, page.canvasRoot.id, overIndex);
      }
    },
    [sectionIds, onMoveNode, page.canvasRoot.id]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        {children({
          SortableWrapper: SortableNode,
          nodeIds: sectionIds,
        })}
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="builder-v2-drag-overlay">
            <div className="builder-v2-drag-preview">
              Dragging section...
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Hook to get sortable props for a node
 */
export function useSortableNode(nodeId: string) {
  return useSortable({ id: nodeId });
}

export { SortableNode };
