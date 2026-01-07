import type { EditorState, Page } from '../types';

import './canvas.css';
import { renderNode } from './renderNode';

type CanvasEditorProps = {
  page: Page;
  editorState: EditorState;
  onSelectNode: (nodeId: string) => void;
};

export function CanvasEditor({ page, editorState, onSelectNode }: CanvasEditorProps) {
  if (!page?.canvasRoot) {
    return <div className="builder-v2-placeholder">Empty page</div>;
  }

  return (
    <div className="builder-v2-canvas">
      {renderNode(page.canvasRoot, editorState, onSelectNode)}
    </div>
  );
}
