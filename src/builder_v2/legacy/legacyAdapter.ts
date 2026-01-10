import type { EditorDocument } from '../state/persistence';
import { EDITOR_DOC_VERSION } from '../state/persistence';

export type LegacyFunnelSettings = Record<string, unknown>;

export interface LegacyFunnelSummary {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: string;
  settings: LegacyFunnelSettings;
  domain_id?: string | null;
}

export interface LegacyFunnelStep {
  id: string;
  funnel_id: string;
  order_index: number;
  step_type: string;
  content: Record<string, unknown>;
}

export interface LegacySnapshotPayload {
  funnel: LegacyFunnelSummary;
  steps: LegacyFunnelStep[];
}

function deepClone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

function sanitizeFunnelSummary(funnel: LegacyFunnelSummary): LegacyFunnelSummary {
  return {
    id: funnel.id,
    team_id: funnel.team_id,
    name: funnel.name,
    slug: funnel.slug,
    status: funnel.status,
    settings: deepClone(funnel.settings ?? {}),
    domain_id: funnel.domain_id ?? null,
  };
}

function sanitizeSteps(steps: LegacyFunnelStep[]): LegacyFunnelStep[] {
  return deepClone(
    steps
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((step, index) => ({
        id: step.id ?? `legacy-step-${index}`,
        funnel_id: step.funnel_id,
        order_index: typeof step.order_index === 'number' ? step.order_index : index,
        step_type: step.step_type,
        content: step.content ?? {},
      })),
  );
}

export function createLegacySnapshotPayload(
  funnel: LegacyFunnelSummary,
  steps: LegacyFunnelStep[],
): LegacySnapshotPayload {
  return {
    funnel: sanitizeFunnelSummary(funnel),
    steps: sanitizeSteps(steps),
  };
}

export function createLegacyEditorDocument(
  funnel: LegacyFunnelSummary,
  steps: LegacyFunnelStep[],
): EditorDocument {
  const pageId = `legacy-page-${funnel.id}`;
  const nodeId = `legacy-node-${funnel.id}`;
  const legacyPayload = createLegacySnapshotPayload(funnel, steps);

  return {
    version: EDITOR_DOC_VERSION,
    pages: [
      {
        id: pageId,
        name: `${funnel.name ?? 'Legacy Funnel'} (Legacy)`,
        type: 'landing',
        canvasRoot: {
          id: nodeId,
          type: 'legacy-funnel',
          props: legacyPayload as unknown as Record<string, unknown>,
          children: [],
        },
      },
    ],
    activePageId: pageId,
  };
}

export function deriveLegacyPayloadFromDocument(
  document: EditorDocument,
): LegacySnapshotPayload | null {
  for (const page of document.pages) {
    const stack = [page.canvasRoot];

    while (stack.length) {
      const node = stack.pop();

      if (!node) continue;

      if (node.type === 'legacy-funnel' && node.props) {
        const payload = node.props as unknown as LegacySnapshotPayload;
        if (payload?.funnel && payload?.steps) {
          return createLegacySnapshotPayload(payload.funnel, payload.steps);
        }
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          stack.push(child);
        }
      }
    }
  }

  return null;
}
