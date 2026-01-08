import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
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

import type { EditorState, Page, CanvasNode } from '../types';
import type { EditorMode } from '../editorMode';

import './canvas.css';
import '../styles/visual-parity.css';
import { resolveFunnelLayout } from '../layout/funnelLayout';
import { generatePersonalityVariables } from '../layout/personalityResolver';
import { resolvePageIntent, generateIntentVariables } from '../layout/stepIntentResolver';
import { SPACING, INTERACTIVITY_MODE } from '../layout/layoutTokens';
import { renderNode } from './renderNode';
import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';

type CanvasEditorProps = {
  page: Page;
  editorState: EditorState;
  mode: EditorMode;
  onSelectNode: (nodeId: string) => void;
  onMoveNode?: (nodeId: string, targetParentId: string, targetIndex: number) => void;
  highlightedNodeIds?: string[];
  funnelPosition?: number;
  totalPages?: number;
};

interface SortableSectionProps {
  node: CanvasNode;
  editorState: EditorState;
  onSelectNode: (nodeId: string) => void;
  highlightedNodeIds: string[];
  isDragMode: boolean;
}

function SortableSection({
  node,
  editorState,
  onSelectNode,
  highlightedNodeIds,
  isDragMode,
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
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
  };

  const isSelected = editorState.selectedNodeId === node.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="builder-v2-sortable-section"
      data-dragging={isDragging || undefined}
      data-selected={isSelected || undefined}
    >
      {isDragMode && (
        <button
          className="builder-v2-section-drag-handle"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder section"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </button>
      )}
      {renderNode(node, editorState, onSelectNode, { highlightedNodeIds }, 1)}
    </div>
  );
}

export function CanvasEditor({ 
  page, 
  editorState, 
  onSelectNode,
  onMoveNode,
  mode,
  highlightedNodeIds = [],
  funnelPosition,
  totalPages,
}: CanvasEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isPreview = mode === 'preview';
  const interactivity = isPreview ? INTERACTIVITY_MODE.preview : INTERACTIVITY_MODE.canvas;

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id || !onMoveNode) {
        return;
      }

      const sectionIds = page.canvasRoot.children.map((c) => c.id);
      const activeIndex = sectionIds.indexOf(active.id as string);
      const overIndex = sectionIds.indexOf(over.id as string);

      if (activeIndex !== -1 && overIndex !== -1) {
        onMoveNode(active.id as string, page.canvasRoot.id, overIndex);
      }
    },
    [page.canvasRoot, onMoveNode]
  );

  if (!page?.canvasRoot) {
    return (
      <div className="builder-v2-empty-state">
        <div className="builder-v2-empty-icon">📄</div>
        <p className="builder-v2-empty-title">Empty page</p>
        <p className="builder-v2-empty-hint">Add elements from the panel</p>
      </div>
    );
  }

  const layout = resolveFunnelLayout(page);
  const personalityVars = generatePersonalityVariables(layout.personality);
  const resolvedIntent = resolvePageIntent(page, {
    funnelPosition,
    totalPages,
    mode: isPreview ? 'preview' : 'editor',
  });
  const intentVars = generateIntentVariables(resolvedIntent, isPreview ? 'preview' : 'editor');
  
  const layoutVars = {
    '--funnel-section-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-block-gap': `${SPACING.BLOCK_GAP}px`,
    '--funnel-text-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-cta-gap': `${SPACING.CTA_GAP}px`,
    '--funnel-step-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-content-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-action-gap': `${SPACING.CTA_GAP}px`,
    ...personalityVars,
    ...intentVars,
  } as CSSProperties;
  
  const shouldShowGuides = interactivity.hoverGuides && resolvedIntent.orchestration.showCompositionGuides;

  // Check if the root has section children or is a legacy step component
  const rootDef = ComponentRegistry[page.canvasRoot.type] ?? fallbackComponent;
  const hasSortableSections = rootDef.constraints.canHaveChildren && page.canvasRoot.children.length > 0;
  const sectionIds = hasSortableSections ? page.canvasRoot.children.map((c) => c.id) : [];
  const isDragEnabled = !isPreview && hasSortableSections && !!onMoveNode;

  const renderContent = () => {
    if (!hasSortableSections) {
      // Legacy single-step page or no children - render directly
      return renderNode(page.canvasRoot, editorState, onSelectNode, {
        readonly: !interactivity.editable,
        highlightedNodeIds,
      });
    }

    // Render frame wrapper, then sortable sections
    const frameIsSelected = editorState.selectedNodeId === page.canvasRoot.id;
    const frameDef = ComponentRegistry[page.canvasRoot.type] ?? fallbackComponent;
    const frameProps = { ...frameDef.defaultProps, ...page.canvasRoot.props };

    return (
      <div
        className={`builder-v2-node builder-v2-node--container`}
        data-selected={frameIsSelected}
        data-node-id={page.canvasRoot.id}
        data-has-children="true"
        data-depth="0"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPreview) {
            onSelectNode(page.canvasRoot.id);
          }
        }}
      >
        <div className="builder-v2-node-overlay" aria-hidden="true" />
        <div className="builder-v2-node-surface">
          {frameDef.render(frameProps, page.canvasRoot.children.map((section) => (
            <SortableSection
              key={section.id}
              node={section}
              editorState={editorState}
              onSelectNode={onSelectNode}
              highlightedNodeIds={highlightedNodeIds}
              isDragMode={isDragEnabled}
            />
          )))}
        </div>
      </div>
    );
  };

  const canvasContent = (
    <div className="builder-root" data-mode={isPreview ? 'preview' : 'canvas'}>
      <div className="builder-canvas-frame">
        <div 
          className={`builder-page builder-v2-canvas${isPreview ? ' builder-v2-canvas--readonly' : ''}`}
          data-mode={mode}
          data-intent={layout.intent}
          data-step-intent={resolvedIntent.intent}
          data-step-intent-source={resolvedIntent.source}
          data-width={layout.width}
          data-personality={layout.personality.personality}
          style={layoutVars}
        >
          {shouldShowGuides && (
            <div className="builder-v2-canvas-guides" aria-hidden="true">
              <div className="builder-v2-canvas-guide builder-v2-canvas-guide--center" />
              <div
                className="builder-v2-canvas-guide builder-v2-canvas-guide--bounds"
                style={{ '--builder-v2-guide-width': `${layout.maxWidth}px` } as CSSProperties}
              />
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  );

  if (!isDragEnabled) {
    return canvasContent;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        {canvasContent}
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="builder-v2-drag-overlay">
            <div className="builder-v2-drag-preview">
              <GripVertical size={14} />
              <span>Reordering...</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
