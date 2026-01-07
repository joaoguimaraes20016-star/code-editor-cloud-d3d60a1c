export const editorModes = ['structure', 'canvas', 'preview'] as const;

export type EditorMode = (typeof editorModes)[number];
