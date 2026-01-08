/**
 * Phase 13 & 14: Multi-Document Editor Shell
 *
 * This is the updated editor shell that supports multi-document workflows.
 * It wraps the existing editor components with the multi-document provider
 * and adds the document switcher UI.
 *
 * Phase 14 adds:
 * - True preview mode that renders published snapshot only
 * - Preview restrictions (no structure tree, no inspector, read-only canvas)
 * - Publish/Unpublish UI controls
 *
 * This preserves all existing editor behavior (canvas, inspector, structure tree)
 * while adding document-level management on top.
 */

import { useEffect } from 'react';

import './EditorLayout.css';
import { CanvasEditor } from './canvas/CanvasEditor';
import { PreviewCanvas } from './canvas/PreviewCanvas';
import { DocumentSwitcher } from './components/DocumentSwitcher';
import { editorModes } from './editorMode';
import { Inspector } from './inspector/Inspector';
import { EditorStoreAdapter } from './state/editorStoreAdapter';
import { MultiDocumentProvider, useMultiDocumentStore } from './state/multiDocStore';
import { StructureTree } from './structure/StructureTree';

/**
 * Main editor shell with multi-document support.
 * Use this instead of EditorShell for multi-document workflows.
 */
export function MultiDocEditorShell() {
  return (
    <MultiDocumentProvider>
      <EditorStoreAdapter>
        <MultiDocEditorShellContent />
      </EditorStoreAdapter>
    </MultiDocumentProvider>
  );
}

function MultiDocEditorShellContent() {
  const {
    pages,
    activePageId,
    mode,
    editorState,
    setMode,
    setActivePage,
    selectNode,
    undo,
    redo,
    canUndo,
    canRedo,
    currentDocument,
    // Phase 14: Published state
    publishedSnapshot,
    isPublished,
    publishDocument,
    unpublishDocument,
    // Phase 26: Highlighted nodes for suggestion feedback
    highlightedNodeIds,
  } = useMultiDocumentStore();

  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  
  // Phase 14: Determine if we're in preview mode
  const isPreviewMode = mode === 'preview';

  // Prevent body scroll when editor is mounted
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Keyboard shortcuts for undo/redo
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

  return (
    <div className="builder-v2-shell">
      <section className="builder-v2-panel builder-v2-panel--left">
        <header className="builder-v2-panel-header">
          Structure
          <span style={{ 
            marginLeft: 'auto', 
            fontSize: '11px', 
            opacity: 0.6,
            fontWeight: 400,
          }}>
            {currentDocument.name}
          </span>
        </header>
        <div className="builder-v2-panel-scroll">
          {/* Document Switcher */}
          <DocumentSwitcher />
          
          {/* Mode Toggle */}
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
          
          {/* Page List & Structure Tree */}
          <div
            className={`builder-v2-placeholder${
              mode === 'structure' ? '' : ' builder-v2-hidden'
            }`}
          >
            {pages.length === 0 ? (
              <p>No pages available.</p>
            ) : (
              <div>
                <div style={styles.pageListHeader}>Pages</div>
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
            {/* Phase 14: Show publish controls when not in structure mode */}
            {!isPreviewMode && (
              <div style={styles.publishControls}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {isPublished ? '✓ Published' : 'Not published'}
                </span>
              </div>
            )}
            {isPreviewMode && (
              <p style={{ opacity: 0.6, fontSize: 13 }}>
                Preview mode - Structure tree disabled
              </p>
            )}
            {mode === 'canvas' && (
              <p>Structure list is hidden in canvas mode.</p>
            )}
          </div>
        </div>
      </section>

      <section className="builder-v2-panel builder-v2-panel--center">
        <header className="builder-v2-panel-header">
          {isPreviewMode ? 'Preview' : 'Canvas'}
          {/* Phase 14: Publish button in header */}
          {!isPreviewMode && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {isPublished ? (
                <>
                  <button
                    type="button"
                    onClick={publishDocument}
                    style={styles.headerButton}
                  >
                    Re-publish
                  </button>
                  <button
                    type="button"
                    onClick={unpublishDocument}
                    style={{ ...styles.headerButton, ...styles.headerButtonDanger }}
                  >
                    Unpublish
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={publishDocument}
                  style={{ ...styles.headerButton, ...styles.headerButtonPrimary }}
                >
                  Publish
                </button>
              )}
            </div>
          )}
        </header>
        <div className="builder-v2-panel-scroll">
          {/* Canvas mode - editable draft */}
          <div className={mode === 'canvas' ? '' : 'builder-v2-hidden'}>
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
          
          {/* Phase 14: Preview mode - renders published snapshot only */}
          <div className={isPreviewMode ? '' : 'builder-v2-hidden'}>
            <PreviewCanvas publishedSnapshot={publishedSnapshot} />
          </div>
          
          {/* Structure mode - canvas hidden */}
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
          Inspector
          {isPreviewMode && (
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.5 }}>
              (disabled)
            </span>
          )}
        </header>
        <div className="builder-v2-panel-scroll">
          {/* Phase 14: Inspector hidden in preview mode */}
          {isPreviewMode ? (
            <div className="builder-v2-placeholder" style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ opacity: 0.6 }}>Inspector is disabled in preview mode.</p>
              <p style={{ fontSize: 12, opacity: 0.4, marginTop: 8 }}>
                Switch to Structure or Canvas mode to edit.
              </p>
            </div>
          ) : activePage ? (
            <Inspector />
          ) : (
            <p className="builder-v2-inspector-empty">No active page.</p>
          )}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageListHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    marginTop: '16px',
  },
  publishControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  headerButton: {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 4,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.8)',
    cursor: 'pointer',
  },
  headerButtonPrimary: {
    background: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
    color: 'rgb(134, 239, 172)',
  },
  headerButtonDanger: {
    background: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    color: 'rgba(252, 165, 165, 0.9)',
  },
};
