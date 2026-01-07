import type { CanvasNode, Page } from '../types';

import {
  ComponentRegistry,
  fallbackComponent,
  type InspectorField as InspectorFieldDefinition,
} from '../registry/componentRegistry';
import { InspectorField } from './InspectorField';

type InspectorProps = {
  selectedNodeId: string | null;
  page: Page;
  onUpdateNode: (nodeId: string, partialProps: Record<string, unknown>) => void;
};

type InspectorSection = 'Content' | 'Layout' | 'Style';

type SectionMap = Record<InspectorSection, InspectorFieldDefinition[]>;

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

function groupFields(fields: InspectorFieldDefinition[]): SectionMap {
  return fields.reduce<SectionMap>((sections, field) => {
    if (field.propKey === 'gap') {
      sections.Layout.push(field);
      return sections;
    }

    if (field.inputType === 'color' || field.propKey === 'backgroundColor') {
      sections.Style.push(field);
      return sections;
    }

    sections.Content.push(field);
    return sections;
  }, {
    Content: [],
    Layout: [],
    Style: [],
  });
}

export function Inspector({ selectedNodeId, page, onUpdateNode }: InspectorProps) {
  if (!selectedNodeId) {
    return <p className="builder-v2-inspector-empty">Select an element to edit</p>;
  }

  const selectedNode = findNodeById(page.canvasRoot, selectedNodeId);

  if (!selectedNode) {
    return <p className="builder-v2-inspector-empty">Select an element to edit</p>;
  }

  const definition = ComponentRegistry[selectedNode.type] ?? fallbackComponent;
  const fields = definition.inspectorSchema;
  const sections = groupFields(fields);

  return (
    <div className="builder-v2-inspector">
      <div className="builder-v2-inspector-header">
        <h3 className="builder-v2-inspector-title">{definition.displayName}</h3>
        <p className="builder-v2-inspector-subtitle">Edit the selected element.</p>
      </div>

      {(['Content', 'Layout', 'Style'] as const).map((section) => (
        <section key={section} className="builder-v2-inspector-section">
          <h4 className="builder-v2-inspector-section-title">{section}</h4>
          {sections[section].length === 0 ? (
            <p className="builder-v2-inspector-empty">No {section.toLowerCase()} fields.</p>
          ) : (
            <div className="builder-v2-inspector-fields">
              {sections[section].map((field) => (
                <InspectorField
                  key={field.propKey}
                  field={field}
                  value={selectedNode.props[field.propKey]}
                  onChange={(value) =>
                    onUpdateNode(selectedNode.id, {
                      [field.propKey]: value,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
