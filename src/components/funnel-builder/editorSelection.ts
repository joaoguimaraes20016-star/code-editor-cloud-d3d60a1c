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

export const getSelectionStepId = (selection: EditorSelection) => {
  if (selection.type === 'step') return selection.id;
  if (selection.type === 'element' || selection.type === 'block') {
    return parseSelectionId(selection.id).parentId;
  }
  return null;
};

export const getSelectionChildId = (selection: EditorSelection) => {
  if (selection.type === 'element' || selection.type === 'block') {
    return parseSelectionId(selection.id).childId;
  }
  return null;
};
