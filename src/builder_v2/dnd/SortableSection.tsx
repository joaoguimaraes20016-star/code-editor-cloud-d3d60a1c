/**
 * SortableSection - A section wrapper that can be dragged and reordered
 */

import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CanvasNode, EditorState } from '../types';
import { renderNode } from '../canvas/renderNode';

interface SortableSectionProps {
  node: CanvasNode;
  editorState: EditorState;
  onSelectNode: (nodeId: string) => void;
  highlightedNodeIds?: string[];
  isSelected: boolean;
}

export function SortableSection({
  node,
  editorState,
  onSelectNode,
  highlightedNodeIds = [],
  isSelected,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="builder-v2-sortable-section"
      data-dragging={isDragging || undefined}
      data-selected={isSelected || undefined}
    >
      <button
        className="builder-v2-section-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder section"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      {renderNode(node, editorState, onSelectNode, { highlightedNodeIds }, 0)}
    </div>
  );
}
