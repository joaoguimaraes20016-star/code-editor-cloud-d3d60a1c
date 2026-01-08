import type { CSSProperties, ReactNode } from 'react';

import type { EditorState, Page } from '../types';
import type { EditorMode } from '../editorMode';
import type { Funnel, FunnelSettings, FunnelStep } from '@/lib/funnel/editorTypes';
import type { EditorSelection } from '@/components/funnel-builder/editorSelection';

import './canvas.css';
import '../styles/visual-parity.css';
import { resolveFunnelLayout } from '../layout/funnelLayout';
import { generatePersonalityVariables } from '../layout/personalityResolver';
import { resolvePageIntent, generateIntentVariables } from '../layout/stepIntentResolver';
import { SPACING, INTERACTIVITY_MODE } from '../layout/layoutTokens';
import { renderNode } from './renderNode';
import { StepPreview } from '@/components/funnel-builder/StepPreview';

type CanvasEditorProps = {
  page: Page;
  editorState: EditorState;
  mode: EditorMode;
  onSelectNode: (nodeId: string) => void;
  /** Node IDs to highlight (for suggestion preview/feedback) */
  highlightedNodeIds?: string[];
  /** Position in funnel for intent inference */
  funnelPosition?: number;
  /** Total pages in funnel for intent inference */
  totalPages?: number;
};

export function CanvasEditor({ 
  page, 
  editorState, 
  onSelectNode, 
  mode,
  highlightedNodeIds = [],
  funnelPosition,
  totalPages,
}: CanvasEditorProps) {
  const isPreview = mode === 'preview';
  const interactivity = isPreview ? INTERACTIVITY_MODE.preview : INTERACTIVITY_MODE.canvas;

  if (!page?.canvasRoot) {
    return <div className="builder-v2-placeholder">Empty page</div>;
  }

  const layout = resolveFunnelLayout(page);
  
  // Phase 27: Generate personality-specific CSS variables (DECORATIVE ONLY per Phase 38)
  const personalityVars = generatePersonalityVariables(layout.personality);
  
  // Phase 37: Resolve step intent (DECORATIVE ONLY per Phase 38 — no geometry changes)
  const resolvedIntent = resolvePageIntent(page, {
    funnelPosition,
    totalPages,
    mode: isPreview ? 'preview' : 'editor',
  });
  const intentVars = generateIntentVariables(resolvedIntent, isPreview ? 'preview' : 'editor');
  
  // Phase 38: LOCKED spacing values — ignore personality/intent overrides for geometry
  const layoutVars = {
    '--funnel-section-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-block-gap': `${SPACING.BLOCK_GAP}px`,
    '--funnel-text-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-cta-gap': `${SPACING.CTA_GAP}px`,
    // Legacy vars (locked to new values)
    '--funnel-step-gap': `${SPACING.SECTION_GAP}px`,
    '--funnel-content-gap': `${SPACING.TEXT_GAP}px`,
    '--funnel-action-gap': `${SPACING.CTA_GAP}px`,
    // Inject personality variables (DECORATIVE ONLY — opacity, color, scale ≤ 1.03)
    ...personalityVars,
    // Phase 37: Intent vars (DECORATIVE ONLY)
    ...intentVars,
  } as CSSProperties;
  
  // Phase 38: Guides only in canvas mode with editable flag
  const shouldShowGuides = interactivity.hoverGuides && resolvedIntent.orchestration.showCompositionGuides;

  const legacyPreview = buildLegacyPreview(page, page.canvasRoot, editorState.selectedNodeId, onSelectNode);

  // Phase 38: Canonical viewport frame structure (MUST be identical in canvas/preview/runtime)
  return (
    <div className="builder-root" data-mode={isPreview ? 'preview' : 'canvas'}>
      <div className="builder-canvas-frame">
        <div 
          className={`builder-page builder-v2-canvas${isPreview ? ' builder-v2-canvas--readonly' : ''}`}
          data-mode={mode}
          data-intent={layout.intent}
          data-step-intent={resolvedIntent.intent}
          data-step-intent-source={resolvedIntent.source}
          data-width={layout.width}
          data-personality={layout.personality.personality}
          style={layoutVars}
        >
          {shouldShowGuides && (
            <div className="builder-v2-canvas-guides" aria-hidden="true">
              <div className="builder-v2-canvas-guide builder-v2-canvas-guide--center" />
              <div
                className="builder-v2-canvas-guide builder-v2-canvas-guide--bounds"
                style={{ '--builder-v2-guide-width': `${layout.maxWidth}px` } as CSSProperties}
              />
            </div>
          )}
          {legacyPreview ?? renderNode(page.canvasRoot, editorState, onSelectNode, { 
            readonly: !interactivity.editable,
            highlightedNodeIds,
          })}
        </div>
      </div>
    </div>
  );
}

type LegacyPreviewData = {
  step: FunnelStep;
  settings: FunnelSettings;
  selection: EditorSelection;
  elementBindings: Record<string, string>;
};

function buildLegacyPreview(
  page: Page,
  root: Page['canvasRoot'],
  selectedNodeId: string | null,
  onSelectNode: (nodeId: string) => void,
): JSX.Element | null {
  const preview = mapNodesToLegacy(page, root, selectedNodeId);
  if (!preview) {
    return (
      <div className="builder-v2-legacy-preview">
        <div className="builder-v2-legacy-empty">Empty page</div>
      </div>
    );
  }

  const { step, settings, selection, elementBindings } = preview;

  const handleSelectElement = (elementId: string) => {
    const nodeId = elementBindings[elementId];
    if (nodeId) {
      onSelectNode(nodeId);
    }
  };

  return (
    <div className="builder-v2-legacy-preview">
      <StepPreview
        step={step as FunnelStep}
        settings={settings as FunnelSettings}
        selection={selection}
        onSelectElement={handleSelectElement}
        onSelectStep={() => onSelectNode(root.id)}
        onUpdateContent={() => {}}
        onUpdateDynamicContent={() => {}}
      />
    </div>
  );
}

function mapNodesToLegacy(
  page: Page,
  root: Page['canvasRoot'],
  selectedNodeId: string | null,
): LegacyPreviewData | null {
  const elementBindings: Record<string, string> = {};

  // Map PageType to valid StepType - 'appointment' and 'landing' become 'welcome'
  const stepType = (() => {
    const pageType = page.type ?? 'landing';
    if (pageType === 'appointment' || pageType === 'landing') return 'welcome';
    if (pageType === 'optin') return 'opt_in';
    if (pageType === 'thank_you') return 'thank_you';
    return 'welcome';
  })();

  const contentData = {
    headline: '',
    subtext: '',
    button_text: '',
    element_order: [] as string[],
    dynamic_elements: {} as Record<string, any>,
    design: {
      textColor: '#ffffff',
      buttonColor: '#6366f1',
      buttonTextColor: '#ffffff',
    },
  };

  const step: FunnelStep = {
    id: page.id,
    funnel_id: '',
    order_index: 0,
    step_type: stepType,
    content: contentData,
  };

  const addElement = (id: string, nodeId: string) => {
    if (!contentData.element_order.includes(id)) {
      contentData.element_order.push(id);
    }
    elementBindings[id] = nodeId;
  };

  const walk = (node: Page['canvasRoot']) => {
    switch (node.type) {
      case 'container': {
        node.children.forEach(walk);
        break;
      }
      case 'hero': {
        contentData.headline = (node.props as any)?.headline ?? 'Hero headline';
        contentData.subtext = (node.props as any)?.subheadline ?? 'Hero subheadline';
        contentData.button_text = (node.props as any)?.buttonLabel ?? 'Button';
        addElement('headline', node.id);
        addElement('subtext', node.id);
        addElement('button', node.id);
        node.children.forEach(walk);
        break;
      }
      case 'text': {
        const id = `text_${node.id}`;
        addElement(id, node.id);
        contentData.dynamic_elements[id] = {
          text: (node.props as any)?.text ?? 'Text',
        };
        break;
      }
      case 'image': {
        const id = `image_${node.id}`;
        addElement(id, node.id);
        contentData.dynamic_elements[id] = {
          image_url: (node.props as any)?.src ?? (node.props as any)?.url ?? '',
        };
        break;
      }
      case 'video': {
        const id = `video_${node.id}`;
        addElement(id, node.id);
        contentData.dynamic_elements[id] = {
          video_url: (node.props as any)?.src ?? (node.props as any)?.url ?? '',
        };
        break;
      }
      case 'button': {
        const id = `button_${node.id}`;
        addElement(id, node.id);
        contentData.dynamic_elements[id] = {
          text: (node.props as any)?.label ?? 'Button',
        };
        break;
      }
      default: {
        node.children.forEach(walk);
        break;
      }
    }
  };

  walk(root);

  if (contentData.element_order.length === 0) {
    return null;
  }

  const settings: FunnelSettings = {
    primary_color: '#6366f1',
    background_color: '#0b0b0b',
    button_text: 'Continue',
  } as FunnelSettings;

  const matchedElementId = Object.entries(elementBindings).find(([, nodeId]) => nodeId === selectedNodeId)?.[0];
  const selection: EditorSelection = matchedElementId
    ? { type: 'element', id: `${step.id}::${matchedElementId}` }
    : { type: 'step', id: step.id };

  return {
    step,
    settings,
    selection,
    elementBindings,
  };
}
