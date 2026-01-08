import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CanvasNode, LayoutPersonality, StepIntent } from '../types';

import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import { useEditorStore } from '../state/editorStore';
import { InspectorField } from './InspectorField';
import { PageInspector } from './PageInspector';
import { SuggestionsPanel } from './SuggestionsPanel';
import { 
  resolvePageIntent, 
  getInspectorSectionOrder, 
  getInspectorCollapseHints,
} from '../layout/stepIntentResolver';

type InspectorSectionId = 'content' | 'layout' | 'style';

const sectionDefinitions: Array<{
  id: InspectorSectionId;
  title: string;
  description: string;
  keywords: string[];
}> = [
  {
    id: 'content',
    title: 'Content',
    description: 'Textual inputs and messaging.',
    keywords: ['text', 'headline', 'subheadline', 'label', 'copy'],
  },
  {
    id: 'layout',
    title: 'Layout',
    description: 'Spacing, sizing, and flow.',
    keywords: ['gap', 'width', 'height', 'align', 'padding'],
  },
  {
    id: 'style',
    title: 'Style',
    description: 'Color and visual treatments.',
    keywords: ['color', 'background', 'tone', 'border', 'shadow'],
  },
];

function resolveSectionId(propKey: string): InspectorSectionId {
  const safeKey = propKey.toLowerCase();

  for (const section of sectionDefinitions) {
    if (section.keywords.some((keyword) => safeKey.includes(keyword))) {
      return section.id;
    }
  }

  return 'content';
}

function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Subtle indicator for layout suggestions.
 * Shows a soft dot when suggestions exist, with tooltip on hover.
 */
function LayoutSuggestionIndicator({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span
      className="builder-v2-inspector-suggestion-indicator"
      title="Layout suggestions available"
      aria-label={`${count} layout suggestion${count === 1 ? '' : 's'} available`}
    />
  );
}

/**
 * Phase 37: Collapsible section wrapper for intent-driven inspector.
 */
function CollapsibleSection({
  id,
  title,
  description,
  defaultCollapsed,
  children,
}: {
  id: InspectorSectionId;
  title: string;
  description: string;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <section 
      className={`builder-v2-inspector-section ${isCollapsed ? 'builder-v2-inspector-section--collapsed' : ''}`}
      data-section={id}
      data-collapsed={isCollapsed}
    >
      <button
        type="button"
        className="builder-v2-inspector-section-header builder-v2-inspector-section-header--clickable"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <div className="builder-v2-inspector-section-header-content">
          <p className="builder-v2-inspector-section-title">{title}</p>
          <p className="builder-v2-inspector-section-description">{description}</p>
        </div>
        <span 
          className="builder-v2-inspector-section-chevron"
          aria-hidden="true"
        >
          {isCollapsed ? '▸' : '▾'}
        </span>
      </button>
      {!isCollapsed && (
        <div className="builder-v2-inspector-fields">
          {children}
        </div>
      )}
    </section>
  );
}

export function Inspector() {
  const { 
    pages, 
    activePageId, 
    selectedNodeId, 
    updateNodeProps,
    updatePageProps,
    mode, 
    layoutSuggestions,
    filteredSuggestions,
    highlightNodes,
    highlightedNodeIds,
  } = useEditorStore();
  const isPreview = mode === 'preview';
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const page = pages.find((candidate) => candidate.id === activePageId) ?? null;

  // Phase 37: Resolve step intent for inspector orchestration
  const resolvedIntent = useMemo(() => {
    if (!page) return null;
    return resolvePageIntent(page, { mode: 'editor' });
  }, [page]);

  // Phase 37: Get intent-driven section ordering and collapse hints
  const sectionOrder = useMemo(() => {
    return resolvedIntent 
      ? getInspectorSectionOrder(resolvedIntent.intent)
      : ['content', 'layout', 'style'] as const;
  }, [resolvedIntent]);

  const collapseHints = useMemo(() => {
    return resolvedIntent
      ? getInspectorCollapseHints(resolvedIntent.intent)
      : { content: false, layout: false, style: false };
  }, [resolvedIntent]);

  // Phase 27: Handler for personality updates
  const handleUpdatePersonality = useCallback((personality: LayoutPersonality) => {
    if (page) {
      updatePageProps(page.id, { layoutPersonality: personality });
    }
  }, [page, updatePageProps]);

  // Auto-clear highlights after 600ms (visual feedback duration)
  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    // Clear any existing timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }

    // Set new highlight
    highlightNodes(nodeIds);

    // If we're highlighting nodes (not clearing), schedule auto-clear
    if (nodeIds.length > 0) {
      highlightTimeoutRef.current = setTimeout(() => {
        highlightNodes([]);
        highlightTimeoutRef.current = null;
      }, 600);
    }
  }, [highlightNodes]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  if (isPreview) {
    return (
      <div className="builder-v2-inspector builder-v2-inspector--disabled">
        <div className="builder-v2-inspector-preview">
          <p className="builder-v2-inspector-preview-title">Preview mode</p>
          <p className="builder-v2-inspector-preview-description">
            Inspector controls are locked while previewing. Switch back to Canvas to continue
            editing.
          </p>
        </div>
      </div>
    );
  }

  if (!page) {
    return <p className="builder-v2-inspector-empty">No active page.</p>;
  }

  // Phase 27: Show PageInspector when no node is selected
  if (!selectedNodeId) {
    return (
      <PageInspector
        page={page}
        onUpdatePersonality={handleUpdatePersonality}
      />
    );
  }

  const selectedNode = findNodeById(page.canvasRoot, selectedNodeId);

  if (!selectedNode) {
    return <p className="builder-v2-inspector-empty">Selected element not found.</p>;
  }

  const definition = ComponentRegistry[selectedNode.type] ?? fallbackComponent;
  const fields = definition.inspectorSchema ?? [];

  if (fields.length === 0) {
    return (
      <div className="builder-v2-inspector" data-step-intent={resolvedIntent?.intent}>
        <div className="builder-v2-inspector-header">
          <div className="builder-v2-inspector-header-row">
            <h3 className="builder-v2-inspector-title">{definition.displayName}</h3>
            <LayoutSuggestionIndicator count={layoutSuggestions.length} />
          </div>
          <p className="builder-v2-inspector-subtitle">No editable properties.</p>
        </div>
        <p className="builder-v2-inspector-empty">No editable properties.</p>
      </div>
    );
  }

  // Phase 37: Group and order sections based on step intent
  const groupedSections = sectionDefinitions
    .map((section) => ({
      ...section,
      fields: fields.filter((field) => resolveSectionId(field.propKey) === section.id),
    }))
    .filter((section) => section.fields.length > 0);

  // Phase 37: Reorder sections based on intent priority
  const orderedSections = [...groupedSections].sort((a, b) => {
    const aIndex = sectionOrder.indexOf(a.id);
    const bIndex = sectionOrder.indexOf(b.id);
    return aIndex - bIndex;
  });

  return (
    <div className="builder-v2-inspector" data-step-intent={resolvedIntent?.intent}>
      <div className="builder-v2-inspector-header">
        <div className="builder-v2-inspector-header-row">
          <h3 className="builder-v2-inspector-title">{definition.displayName}</h3>
          <LayoutSuggestionIndicator count={filteredSuggestions.length} />
        </div>
        <p className="builder-v2-inspector-subtitle">Edit the selected element.</p>
      </div>

      {orderedSections.map((section) => (
        <CollapsibleSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          defaultCollapsed={collapseHints[section.id] ?? false}
        >
          {section.fields.map((field) => {
            const defaultValue = definition.defaultProps?.[field.propKey];

            return (
              <InspectorField
                key={field.propKey}
                field={field}
                value={selectedNode.props[field.propKey]}
                defaultValue={defaultValue}
                onChange={(value) =>
                  updateNodeProps(selectedNode.id, {
                    [field.propKey]: value,
                  })
                }
                onReset={() =>
                  updateNodeProps(selectedNode.id, {
                    [field.propKey]: defaultValue,
                  })
                }
              />
            );
          })}
        </CollapsibleSection>
      ))}

      {/* Layout Suggestions Panel - Phase 26, Phase 33: filtered by guided mode */}
      <SuggestionsPanel
        suggestions={filteredSuggestions}
        page={page}
        onApply={updateNodeProps}
        onHighlightNodes={handleHighlightNodes}
      />
    </div>
  );
}
