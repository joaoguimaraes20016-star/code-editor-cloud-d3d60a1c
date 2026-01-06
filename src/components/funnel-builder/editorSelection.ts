export type EditorSelection = {
  type: 'funnel' | 'step' | 'block' | 'element';
  id: string;
};

const SELECTION_SEPARATOR = '::';

export const buildSelectionId = (parentId: string, childId?: string) =>
  childId ? `${parentId}${SELECTION_SEPARATOR}${childId}` : parentId;

export const parseSelectionId = (id: string) => {
  const [parentId, childId] = id.split(SELECTION_SEPARATOR);
  return {
    parentId,
    childId: childId ?? null,
  };
};
