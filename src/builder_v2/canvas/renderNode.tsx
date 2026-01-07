import type { CanvasNode, EditorState } from '../types';

import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';

/**
 * renderNode MUST remain a pure function.
 * - No state
 * - No side effects
 * - No data mutation
 * This guarantees deterministic rendering and prevents duplication bugs.
 */
export function renderNode(
  node: CanvasNode,
  editorState: EditorState,
  onSelectNode: (nodeId: string) => void,
): JSX.Element {
  const children = node.children.map((child) =>
    renderNode(child, editorState, onSelectNode),
  );
  const definition = ComponentRegistry[node.type] ?? fallbackComponent;
  const safeChildren = definition.constraints.canHaveChildren ? children : [];
  const props = {
    ...definition.defaultProps,
    ...node.props,
  };
  const isSelected = editorState.selectedNodeId === node.id;

  return (
    <div
      key={node.id}
      className="builder-v2-node"
      data-selected={isSelected}
      data-node-id={node.id}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          onSelectNode(node.id);
        }}
      >
        {definition.render(props, safeChildren)}
      </div>
    </div>
  );
}
