import type { CSSProperties } from 'react';

import type { CanvasNode, EditorState } from '../types';

import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';

/**
 * Options for rendering the canvas tree.
 */
export interface RenderOptions {
  /**
   * When true, the canvas is read-only (preview mode).
   * - Nodes are not selectable
   * - No selection highlighting
   * - Used for published snapshot rendering
   */
  readonly?: boolean;
  /**
   * Node IDs to highlight (for suggestion preview/feedback).
   * Highlighted nodes show a subtle glow/pulse animation.
   */
  highlightedNodeIds?: string[];
  /**
   * Callback when a node is deleted
   */
  onDeleteNode?: (nodeId: string) => void;
}

// Map node types to human-readable labels
const nodeTypeLabels: Record<string, string> = {
  heading: 'Heading',
  paragraph: 'Text',
  cta_button: 'Button',
  image_block: 'Image',
  video_embed: 'Video',
  email_input: 'Email',
  phone_input: 'Phone',
  text_input: 'Text Input',
  option_grid: 'Options',
  info_card: 'Info Card',
  calendar_embed: 'Calendar',
  spacer: 'Spacer',
  section: 'Section',
  frame: 'Frame',
  consent_checkbox: 'Consent',
};

function getNodeTypeLabel(type: string): string {
  return nodeTypeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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
  options: RenderOptions = {},
  depth = 0,
): JSX.Element {
  const { readonly = false, highlightedNodeIds = [], onDeleteNode } = options;
  
  const children = node.children.map((child) =>
    renderNode(child, editorState, onSelectNode, options, depth + 1),
  );
  const definition = ComponentRegistry[node.type] ?? fallbackComponent;
  const safeChildren = definition.constraints.canHaveChildren ? children : [];
  const props = {
    ...definition.defaultProps,
    ...node.props,
  };
  const canHaveChildren = definition.constraints.canHaveChildren;
  const surfaceStyle = {
    '--builder-v2-node-depth': depth,
  } as CSSProperties;
  
  // In readonly mode, never show selection
  const isSelected = readonly ? false : editorState.selectedNodeId === node.id;
  
  // Check if this node is highlighted (for suggestion feedback)
  const isHighlighted = highlightedNodeIds.includes(node.id);
  
  // Don't show hover toolbar on frame/section containers, only on leaf elements
  const showHoverToolbar = !readonly && !canHaveChildren && depth > 0;
  
  const typeLabel = getNodeTypeLabel(node.type);

  return (
    <div
      key={node.id}
      className={`builder-v2-node${readonly ? ' builder-v2-node--readonly' : ''}${
        canHaveChildren ? ' builder-v2-node--container' : ' builder-v2-node--leaf'
      }`}
      data-selected={isSelected}
      data-highlighted={isHighlighted || undefined}
      data-node-id={node.id}
      data-node-type={typeLabel}
      data-readonly={readonly || undefined}
      data-has-children={canHaveChildren || undefined}
      data-depth={depth}
      style={surfaceStyle}
    >
      <div className="builder-v2-node-overlay" aria-hidden="true" />
      
      {/* Hover toolbar for leaf elements */}
      {showHoverToolbar && (
        <div className="builder-v2-hover-toolbar">
          <span className="builder-v2-hover-toolbar-type">{typeLabel}</span>
          <div className="builder-v2-hover-toolbar-actions">
            <button 
              className="builder-v2-hover-toolbar-btn"
              onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
              title="Edit"
            >
              Edit
            </button>
            {onDeleteNode && (
              <button 
                className="builder-v2-hover-toolbar-btn builder-v2-hover-toolbar-btn--delete"
                onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                title="Delete"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      
      <div
        className="builder-v2-node-surface"
        onClick={readonly
          ? undefined
          : (event) => {
              event.stopPropagation();
              onSelectNode(node.id);
            }}
      >
        {definition.render(props, safeChildren)}
      </div>
    </div>
  );
}

/**
 * Renders a tree of nodes in read-only preview mode.
 * This is a convenience wrapper that:
 * - Disables selection
 * - Uses a no-op for onSelectNode
 * - Sets readonly: true
 */
export function renderTree(
  rootNode: CanvasNode,
  options: RenderOptions = {},
): JSX.Element {
  // Create a minimal editor state for read-only rendering
  const previewEditorState: EditorState = {
    selectedPageId: null,
    selectedNodeId: null,
    mode: 'preview',
  };
  
  // No-op select handler for readonly mode
  const noopSelectNode = () => {};
  
  return renderNode(
    rootNode,
    previewEditorState,
    noopSelectNode,
    { ...options, readonly: true },
    0,
  );
}
