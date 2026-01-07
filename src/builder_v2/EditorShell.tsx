import { useEffect, useState } from 'react';

import './EditorLayout.css';
import { CanvasEditor } from './canvas/CanvasEditor';
import { editorModes } from './editorMode';
import { Inspector } from './inspector/Inspector';
import { CanvasNode, EditorState, Page } from './types';

/**
 * NOTE:
 * EditorShell currently owns EditorState locally.
 * In Phase 3, this will be lifted into a shared editor store/context.
 */

const sampleCanvasTree: CanvasNode = {
  id: 'root',
  type: 'container',
  props: {
    gap: 12,
  },
  children: [
    {
      id: 'hero',
      type: 'hero',
      props: {
        headline: 'Builder V2 Hero',
        subheadline: 'Registry-driven components',
        backgroundColor: '#1f2937',
      },
      children: [
        {
          id: 'hero-cta',
          type: 'button',
          props: {
            label: 'Explore',
          },
          children: [],
        },
      ],
    },
    {
      id: 'headline',
      type: 'text',
      props: {
        text: 'Welcome to Builder V2',
      },
      children: [],
    },
    {
      id: 'cta',
      type: 'button',
      props: {
        label: 'Get Started',
      },
      children: [],
    },
  ],
};

const samplePage: Page = {
  id: 'page-1',
  name: 'Sample Page',
  type: 'landing',
  canvasRoot: sampleCanvasTree,
};

export function EditorShell() {
  const [editorState, setEditorState] = useState<EditorState>({
    selectedPageId: null,
    selectedNodeId: null,
    mode: 'structure',
  });
  const [page, setPage] = useState<Page>(samplePage);

  const updateNodeProps = (node: CanvasNode, nodeId: string, partialProps: Record<string, unknown>) => {
    if (node.id === nodeId) {
      return {
        ...node,
        props: {
          ...node.props,
          ...partialProps,
        },
      };
    }

    return {
      ...node,
      children: node.children.map((child) =>
        updateNodeProps(child, nodeId, partialProps),
      ),
    };
  };

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

  return (
    <div className="builder-v2-shell">
      <section className="builder-v2-panel builder-v2-panel--left">
        <header className="builder-v2-panel-header">Structure</header>
        <div className="builder-v2-panel-scroll">
          <div className="builder-v2-mode-toggle">
            {editorModes.map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                aria-pressed={editorState.mode === nextMode}
                onClick={() =>
                  setEditorState((prev) => ({
                    ...prev,
                    mode: nextMode,
                  }))
                }
              >
                {nextMode}
              </button>
            ))}
          </div>
          <div
            className={`builder-v2-placeholder${
              editorState.mode === 'structure' ? '' : ' builder-v2-hidden'
            }`}
          >
            <p>Pages list placeholder</p>
            <p>Selected page: {editorState.selectedPageId ?? 'none'}</p>
          </div>
          <div
            className={`builder-v2-placeholder${
              editorState.mode === 'structure' ? ' builder-v2-hidden' : ''
            }`}
          >
            <p>Structure list is hidden in {editorState.mode} mode.</p>
          </div>
        </div>
      </section>

      <section className="builder-v2-panel builder-v2-panel--center">
        <header className="builder-v2-panel-header">Canvas</header>
        <div className="builder-v2-panel-scroll">
          <div
            className={editorState.mode === 'canvas' ? '' : 'builder-v2-hidden'}
          >
            <CanvasEditor
              page={page}
              editorState={editorState}
              onSelectNode={(nodeId) =>
                setEditorState((prev) => ({
                  ...prev,
                  selectedNodeId: nodeId,
                  selectedPageId: prev.selectedPageId ?? page.id,
                }))
              }
            />
          </div>
          <div
            className={`builder-v2-placeholder${
              editorState.mode === 'preview' ? '' : ' builder-v2-hidden'
            }`}
          >
            <p>Runtime preview placeholder</p>
          </div>
          <div
            className={`builder-v2-placeholder${
              editorState.mode === 'structure' ? '' : ' builder-v2-hidden'
            }`}
          >
            <p>Canvas is hidden in structure mode.</p>
          </div>
        </div>
      </section>

      <section className="builder-v2-panel builder-v2-panel--right">
        <header className="builder-v2-panel-header">Inspector</header>
        <div className="builder-v2-panel-scroll">
          <Inspector
            selectedNodeId={editorState.selectedNodeId}
            page={page}
            onUpdateNode={(nodeId, partialProps) => {
              setPage((prevPage) => ({
                ...prevPage,
                canvasRoot: updateNodeProps(prevPage.canvasRoot, nodeId, partialProps),
              }));
            }}
          />
        </div>
      </section>
    </div>
  );
}
