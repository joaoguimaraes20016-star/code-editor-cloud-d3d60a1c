export type EditorSelection =
  | { type: 'funnel' }
  | { type: 'step'; stepId: string }
  | { type: 'block'; stepId: string; blockId: string }
  | { type: 'element'; stepId: string; elementId: string };
