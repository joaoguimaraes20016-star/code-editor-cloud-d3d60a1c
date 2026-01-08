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
} from 'lucide-react';

import './EditorLayout.css';
import { CanvasEditor } from './canvas/CanvasEditor';
import { PhoneFrame } from './canvas/PhoneFrame';
import { EnhancedInspector } from './inspector/EnhancedInspector';
import { EditorProvider, useEditorStore } from './state/editorStore';
import { StructureTree } from './structure/StructureTree';
import { StepPalette } from './structure/StepPalette';
import { STEP_DEFINITIONS } from '@/lib/funnel/stepDefinitions';
import { cn } from '@/lib/utils';

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
};

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
  } = useEditorStore();

  const [leftTab, setLeftTab] = useState<LeftPanelTab>('pages');
  const [showAddStep, setShowAddStep] = useState(false);
  const activePage = pages.find((page) => page.id === activePageId) ?? null;

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

  const getStepIcon = (pageType: string | undefined) => {
    const Icon = STEP_ICONS[pageType || 'welcome'] || Play;
    return Icon;
  };

  return (
    <div className="builder-shell">
      {/* Left Panel - Pages/Layers */}
      <aside className="builder-panel builder-panel--left">
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
        </div>

        <div className="builder-panel-content">
          {leftTab === 'pages' && (
            <div className="builder-pages">
              <div className="builder-pages-list">
                {pages.map((page, index) => {
                  const isActive = page.id === activePageId;
                  const StepIcon = getStepIcon(page.type);
                  return (
                    <button
                      key={page.id}
                      type="button"
                      className={cn("builder-page-item", isActive && "builder-page-item--active")}
                      onClick={() => setActivePage(page.id)}
                    >
                      <span className="builder-page-index">{index + 1}</span>
                      <StepIcon className="builder-page-icon" size={14} />
                      <span className="builder-page-name">{page.name}</span>
                    </button>
                  );
                })}
              </div>
              
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

      {/* Center - Canvas with Phone Frame */}
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
          <div className="builder-canvas-actions">
            {/* Device selector placeholder */}
          </div>
        </div>
        
        <div className="builder-canvas-viewport">
          <PhoneFrame>
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
          </PhoneFrame>
          
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
      <aside className="builder-panel builder-panel--right">
        <EnhancedInspector />
      </aside>
    </div>
  );
}
