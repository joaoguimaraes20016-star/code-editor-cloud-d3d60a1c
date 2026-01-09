import { useEffect, useState } from 'react';
import {
  Play,
  MessageSquare,
  List,
  Mail,
  Phone,
  UserCheck,
  Video,
  Code,
  CheckCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Smartphone,
  Tablet,
  Monitor,
  PanelLeftClose,
  PanelRightClose,
  GripVertical,
} from 'lucide-react';
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

import './EditorLayout.css';
import { CanvasEditor } from './canvas/CanvasEditor';
import { DeviceFrame, type DeviceType } from './canvas/DeviceFrame';
import { EnhancedInspector } from './inspector/EnhancedInspector';
import { EditorProvider, useEditorStore } from './state/editorStore';
import { StructureTree } from './structure/StructureTree';
import { StepPalette } from './structure/StepPalette';
import { PageContextMenu } from './components/PageContextMenu';
import { cn } from '@/lib/utils';
import type { Page } from './types';

type LeftPanelTab = 'pages' | 'layers';

const STEP_ICONS: Record<string, typeof Play> = {
  welcome: Play,
  text_question: MessageSquare,
  multi_choice: List,
  email_capture: Mail,
  phone_capture: Phone,
  opt_in: UserCheck,
  video: Video,
  embed: Code,
  thank_you: CheckCircle,
  landing: Play,
  optin: UserCheck,
  appointment: Code,
};

interface SortablePageItemProps {
  page: Page;
  index: number;
  isActive: boolean;
  onSelect: (pageId: string) => void;
  onRename?: (pageId: string, name: string) => void;
  onDelete?: (pageId: string) => void;
  onDuplicate?: (pageId: string) => void;
  onMoveUp?: (pageId: string) => void;
  onMoveDown?: (pageId: string) => void;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  getStepIcon: (type: string | undefined) => typeof Play;
}

function SortablePageItem({
  page,
  index,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canDelete,
  canMoveUp,
  canMoveDown,
  getStepIcon,
}: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const StepIcon = getStepIcon(page.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("builder-page-item-wrapper", isDragging && "builder-page-item-wrapper--dragging")}
    >
      <button
        type="button"
        className={cn("builder-page-item", isActive && "builder-page-item--active")}
        onClick={() => onSelect(page.id)}
      >
        <span 
          className="builder-page-drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={12} />
        </span>
        <span className="builder-page-index">{index + 1}</span>
        <StepIcon className="builder-page-icon" size={14} />
        <span className="builder-page-name">{page.name}</span>
        <PageContextMenu
          page={page}
          index={index}
          onRename={onRename}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canDelete={canDelete}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </button>
    </div>
  );
}

export function EditorShell() {
  return (
    <EditorProvider>
      <EditorShellContent />
    </EditorProvider>
  );
}

function EditorShellContent() {
  const {
    pages,
    activePageId,
    editorState,
    setActivePage,
    selectNode,
    undo,
    redo,
    canUndo,
    canRedo,
    highlightedNodeIds,
    addPage,
    deletePage,
    updatePageProps,
    moveNodeUp,
    moveNodeDown,
  } = useEditorStore();

  const [leftTab, setLeftTab] = useState<LeftPanelTab>('pages');
  const [showAddStep, setShowAddStep] = useState(false);
  const [device, setDevice] = useState<DeviceType>('mobile');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activePageDragId, setActivePageDragId] = useState<string | null>(null);

  const activePage = pages.find((page) => page.id === activePageId) ?? null;

  // DnD sensors
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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      const isZKey = event.key.toLowerCase() === 'z';

      if (!isModifierPressed || !isZKey) return;

      if (event.shiftKey) {
        event.preventDefault();
        if (canRedo) redo();
        return;
      }

      event.preventDefault();
      if (canUndo) undo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo]);

  const handleAddStep = (stepType: string) => {
    addPage(stepType);
    setShowAddStep(false);
  };

  const handleRenamePage = (pageId: string, newName: string) => {
    updatePageProps(pageId, { name: newName });
  };

  const handleDuplicatePage = (pageId: string) => {
    // Find the page and create a copy
    const pageToDuplicate = pages.find(p => p.id === pageId);
    if (pageToDuplicate) {
      // Use addPage with the same type, then update props
      addPage(pageToDuplicate.type);
    }
  };

  const handleMovePageUp = (pageId: string) => {
    // Page reordering handled by DnD, but we can support context menu too
    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex > 0) {
      // Swap with previous page - this would need a reorderPages action
      // For now, we'll rely on DnD
    }
  };

  const handleMovePageDown = (pageId: string) => {
    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex < pages.length - 1) {
      // Swap with next page
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActivePageDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActivePageDragId(null);
    // Page reordering would need a reorderPages action in the store
    // For now, pages are in insertion order
  };

  const getStepIcon = (pageType: string | undefined) => {
    const Icon = STEP_ICONS[pageType || 'welcome'] || Play;
    return Icon;
  };

  return (
    <div className={cn(
      "builder-shell",
      leftCollapsed && "builder-shell--left-collapsed",
      rightCollapsed && "builder-shell--right-collapsed"
    )}>
      {/* Left Panel Toggle (when collapsed) */}
      {leftCollapsed && (
        <button
          type="button"
          className="builder-panel-toggle builder-panel-toggle--left"
          onClick={() => setLeftCollapsed(false)}
          title="Show pages panel"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Left Panel - Pages/Layers */}
      <aside className={cn("builder-panel builder-panel--left", leftCollapsed && "builder-panel--collapsed")}>
        <div className="builder-panel-header">
          <div className="builder-panel-tabs">
            <button
              type="button"
              className={cn("builder-tab", leftTab === 'pages' && "builder-tab--active")}
              onClick={() => setLeftTab('pages')}
            >
              Pages
            </button>
            <button
              type="button"
              className={cn("builder-tab", leftTab === 'layers' && "builder-tab--active")}
              onClick={() => setLeftTab('layers')}
            >
              Layers
            </button>
          </div>
          <button
            type="button"
            className="builder-panel-collapse-btn"
            onClick={() => setLeftCollapsed(true)}
            title="Collapse panel"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <div className="builder-panel-content">
          {leftTab === 'pages' && (
            <div className="builder-pages">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="builder-pages-list">
                    {pages.map((page, index) => (
                      <SortablePageItem
                        key={page.id}
                        page={page}
                        index={index}
                        isActive={page.id === activePageId}
                        onSelect={setActivePage}
                        onRename={handleRenamePage}
                        onDelete={pages.length > 1 ? deletePage : undefined}
                        onDuplicate={handleDuplicatePage}
                        onMoveUp={handleMovePageUp}
                        onMoveDown={handleMovePageDown}
                        canDelete={pages.length > 1}
                        canMoveUp={index > 0}
                        canMoveDown={index < pages.length - 1}
                        getStepIcon={getStepIcon}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activePageDragId ? (
                    <div className="builder-page-drag-overlay">
                      <GripVertical size={12} />
                      <span>Reordering...</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              
              {/* Add Step Button */}
              <div className="builder-add-step">
                {showAddStep ? (
                  <StepPalette onAddStep={handleAddStep} compact />
                ) : (
                  <button
                    type="button"
                    className="builder-add-step-btn"
                    onClick={() => setShowAddStep(true)}
                  >
                    <Plus size={14} />
                    <span>Add Step</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {leftTab === 'layers' && activePage && (
            <StructureTree />
          )}

          {leftTab === 'layers' && !activePage && (
            <p className="builder-empty-state">No page selected</p>
          )}
        </div>
      </aside>

      {/* Center - Canvas with Device Frame */}
      <main className="builder-canvas-area">
        <div className="builder-canvas-toolbar">
          <div className="builder-canvas-nav">
            <button
              type="button"
              className="builder-nav-btn"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="builder-nav-btn"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>
          </div>
          
          <div className="builder-canvas-title">
            {activePage?.name || 'Untitled'}
          </div>
          
          {/* Device Selector */}
          <div className="builder-device-selector">
            <button
              type="button"
              className={cn("builder-device-btn", device === 'mobile' && "builder-device-btn--active")}
              onClick={() => setDevice('mobile')}
              title="Mobile"
            >
              <Smartphone size={16} />
            </button>
            <button
              type="button"
              className={cn("builder-device-btn", device === 'tablet' && "builder-device-btn--active")}
              onClick={() => setDevice('tablet')}
              title="Tablet"
            >
              <Tablet size={16} />
            </button>
            <button
              type="button"
              className={cn("builder-device-btn", device === 'desktop' && "builder-device-btn--active")}
              onClick={() => setDevice('desktop')}
              title="Desktop"
            >
              <Monitor size={16} />
            </button>
          </div>
        </div>
        
        <div className="builder-canvas-viewport">
          <DeviceFrame device={device}>
            {activePage ? (
              <CanvasEditor
                page={activePage}
                editorState={editorState}
                mode="canvas"
                onSelectNode={(nodeId) => selectNode(nodeId)}
                highlightedNodeIds={highlightedNodeIds}
                funnelPosition={pages.findIndex(p => p.id === activePageId)}
                totalPages={pages.length}
              />
            ) : (
              <div className="builder-empty-state">
                Select a page to start editing
              </div>
            )}
          </DeviceFrame>
          
          {/* Step Navigation */}
          {pages.length > 1 && activePage && (
            <div className="builder-step-nav">
              <button
                type="button"
                className="builder-step-nav-btn"
                disabled={pages.findIndex(p => p.id === activePageId) === 0}
                onClick={() => {
                  const idx = pages.findIndex(p => p.id === activePageId);
                  if (idx > 0) setActivePage(pages[idx - 1].id);
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="builder-step-nav-indicator">
                {pages.findIndex(p => p.id === activePageId) + 1} / {pages.length}
              </span>
              <button
                type="button"
                className="builder-step-nav-btn"
                disabled={pages.findIndex(p => p.id === activePageId) === pages.length - 1}
                onClick={() => {
                  const idx = pages.findIndex(p => p.id === activePageId);
                  if (idx < pages.length - 1) setActivePage(pages[idx + 1].id);
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Right Panel - Inspector */}
      <aside className={cn("builder-panel builder-panel--right", rightCollapsed && "builder-panel--collapsed")}>
        <div className="builder-panel-header builder-panel-header--right">
          <button
            type="button"
            className="builder-panel-collapse-btn"
            onClick={() => setRightCollapsed(true)}
            title="Collapse panel"
          >
            <PanelRightClose size={16} />
          </button>
          <span className="builder-panel-title">Properties</span>
        </div>
        <EnhancedInspector />
      </aside>

      {/* Right Panel Toggle (when collapsed) */}
      {rightCollapsed && (
        <button
          type="button"
          className="builder-panel-toggle builder-panel-toggle--right"
          onClick={() => setRightCollapsed(false)}
          title="Show properties panel"
        >
          <ChevronLeft size={16} />
        </button>
      )}
    </div>
  );
}
