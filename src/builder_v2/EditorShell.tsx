import { useEffect } from 'react';

import './EditorLayout.css';
import { CanvasEditor } from './canvas/CanvasEditor';
import { GuidedModeSwitcher } from './components/GuidedModeSwitcher';
import { editorModes } from './editorMode';
import { Inspector } from './inspector/Inspector';
import { EditorProvider, useEditorStore } from './state/editorStore';
import { StructureTree } from './structure/StructureTree';

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
    mode,
    guidedMode,
    editorState,
    setMode,
    setGuidedMode,
    setActivePage,
    selectNode,
    undo,
    redo,
    canUndo,
    canRedo,
    highlightedNodeIds,
  } = useEditorStore();
  const activePage = pages.find((page) => page.id === activePageId) ?? null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      const isZKey = event.key.toLowerCase() === 'z';

      if (!isModifierPressed || !isZKey) {
        return;
      }

      if (event.shiftKey) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }

      event.preventDefault();

      if (canUndo) {
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canRedo, canUndo, redo, undo]);

  const isPreview = mode === 'preview';

  return (
    <div
      className={`builder-v2-shell${isPreview ? ' builder-v2-shell--preview' : ''}`}
      data-mode={mode}
      data-editor-mode={guidedMode}
    >
      <section className="builder-v2-panel builder-v2-panel--left">
        <header className="builder-v2-panel-header">
          <span>Structure</span>
          {isPreview && <span className="builder-v2-mode-badge">Preview locked</span>}
        </header>
        <div className="builder-v2-panel-scroll">
          <div className="builder-v2-mode-toggle">
            {editorModes.map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                aria-pressed={mode === nextMode}
                onClick={() => setMode(nextMode)}
              >
                {nextMode}
              </button>
            ))}
          </div>
          {isPreview && (
            <div className="builder-v2-preview-hint">
              Preview mode is read-only. Switch back to Canvas to continue editing.
            </div>
          )}
          <div
            className={`builder-v2-placeholder${
              mode === 'structure' ? '' : ' builder-v2-hidden'
            }`}
          >
            {pages.length === 0 ? (
              <p>No pages available.</p>
            ) : (
              <div>
                {pages.map((page) => {
                  const isActive = page.id === activePageId;

                  return (
                    <button
                      key={page.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActivePage(page.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        marginBottom: '8px',
                        borderRadius: '10px',
                        background: isActive
                          ? 'rgba(99, 102, 241, 0.2)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isActive
                          ? '1px solid rgba(99, 102, 241, 0.7)'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f5f7fa',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{page.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Type: {page.type}</div>
                    </button>
                  );
                })}
                <div style={{ marginTop: 12 }}>
                  {activePage ? (
                    <StructureTree />
                  ) : (
                    <p className="builder-v2-placeholder">No active page.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            className={`builder-v2-placeholder${
              mode === 'structure' ? ' builder-v2-hidden' : ''
            }`}
          >
            <p>Structure list is hidden in {mode} mode.</p>
          </div>
        </div>
      </section>

      <section className="builder-v2-panel builder-v2-panel--center">
        <header className="builder-v2-panel-header">
          <span>{mode === 'preview' ? 'Preview' : 'Canvas'}</span>
          {/* Phase 33: Guided Mode Switcher */}
          {!isPreview && (
            <GuidedModeSwitcher
              activeMode={guidedMode}
              onModeChange={setGuidedMode}
            />
          )}
          {isPreview && <span className="builder-v2-mode-badge">Live Preview</span>}
        </header>
        <div className="builder-v2-panel-scroll">
          <div
            className={mode === 'canvas' ? '' : 'builder-v2-hidden'}
          >
            {activePage ? (
              <CanvasEditor
                page={activePage}
                editorState={editorState}
                mode={mode}
                onSelectNode={(nodeId) => selectNode(nodeId)}
                highlightedNodeIds={highlightedNodeIds}
              />
            ) : (
              <div className="builder-v2-placeholder">No active page.</div>
            )}
          </div>
          <div
            className={`builder-v2-placeholder${
              mode === 'preview' ? '' : ' builder-v2-hidden'
            }`}
          >
            <p>Preview mode renders the published snapshot and disables editing.</p>
          </div>
          <div
            className={`builder-v2-placeholder${
              mode === 'structure' ? '' : ' builder-v2-hidden'
            }`}
          >
            <p>Canvas is hidden in structure mode.</p>
          </div>
        </div>
      </section>

      <section className="builder-v2-panel builder-v2-panel--right">
        <header className="builder-v2-panel-header">
          <span>Inspector</span>
          {isPreview && <span className="builder-v2-mode-badge">Locked</span>}
        </header>
        <div className="builder-v2-panel-scroll">
          {activePage ? (
            <Inspector />
          ) : (
            <p className="builder-v2-inspector-empty">No active page.</p>
          )}
        </div>
      </section>
    </div>
  );
}
