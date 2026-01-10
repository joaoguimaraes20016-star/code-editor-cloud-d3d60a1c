import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CanvasNode } from '../types';
import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import { useEditorStore } from '../state/editorStore';
import { InspectorField } from './InspectorField';
import { PageInspector } from './PageInspector';

type InspectorSectionId = 'content' | 'layout' | 'style';

const sectionConfig: Record<InspectorSectionId, { title: string; keywords: string[] }> = {
  content: {
    title: 'Content',
    keywords: ['text', 'headline', 'subheadline', 'label', 'copy'],
  },
  layout: {
    title: 'Layout',
    keywords: ['gap', 'width', 'height', 'align', 'padding'],
  },
  style: {
    title: 'Style',
    keywords: ['color', 'background', 'tone', 'border', 'shadow'],
  },
};

function resolveSectionId(propKey: string): InspectorSectionId {
  const safeKey = propKey.toLowerCase();
  for (const [id, config] of Object.entries(sectionConfig)) {
    if (config.keywords.some((keyword) => safeKey.includes(keyword))) {
      return id as InspectorSectionId;
    }
  }
  return 'content';
}

function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Collapsible section with Framer-style "+" icon
 */
function InspectorSection({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: InspectorSectionId;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="builder-inspector-section" data-section={id}>
      <button
        type="button"
        className="builder-inspector-section-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="builder-inspector-section-title">{title}</span>
        <span className="builder-inspector-section-icon" data-open={isOpen}>
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="builder-inspector-section-content">
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
  } = useEditorStore();

  const page = pages.find((p) => p.id === activePageId) ?? null;

  // Page-level inspector when no node selected
  const handleUpdatePersonality = useCallback((personality: any) => {
    if (page) {
      updatePageProps(page.id, { layoutPersonality: personality });
    }
  }, [page, updatePageProps]);

  // No page selected
  if (!page) {
    return (
      <div className="builder-inspector builder-inspector--empty">
        <p className="builder-empty-state">No page selected</p>
      </div>
    );
  }

  // No node selected - show page inspector
  if (!selectedNodeId) {
    return <PageInspector page={page} onUpdatePersonality={handleUpdatePersonality} />;
  }

  const selectedNode = findNodeById(page.canvasRoot, selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="builder-inspector builder-inspector--empty">
        <p className="builder-empty-state">Element not found</p>
      </div>
    );
  }

  const definition = ComponentRegistry[selectedNode.type] ?? fallbackComponent;
  const fields = definition.inspectorSchema ?? [];

  // Group fields by section
  const groupedSections = (['content', 'layout', 'style'] as InspectorSectionId[])
    .map((sectionId) => ({
      id: sectionId,
      title: sectionConfig[sectionId].title,
      fields: fields.filter((field) => resolveSectionId(field.propKey) === sectionId),
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <div className="builder-inspector">
      {/* Header */}
      <header className="builder-inspector-header">
        <span className="builder-inspector-type">{definition.displayName}</span>
      </header>

      {/* Sections */}
      {groupedSections.length === 0 ? (
        <p className="builder-empty-state">No properties</p>
      ) : (
        groupedSections.map((section) => (
          <InspectorSection
            key={section.id}
            id={section.id}
            title={section.title}
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
                    updateNodeProps(selectedNode.id, { [field.propKey]: value })
                  }
                  onReset={() =>
                    updateNodeProps(selectedNode.id, { [field.propKey]: defaultValue })
                  }
                />
              );
            })}
          </InspectorSection>
        ))
      )}
    </div>
  );
}
