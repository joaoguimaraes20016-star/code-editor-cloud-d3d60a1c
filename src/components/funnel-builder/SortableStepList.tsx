import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStepItem } from './SortableStepItem';
import type { EditorSelection } from './editorSelection';
import { getSelectionStepId } from './editorSelection';
import type { FunnelStep } from '@/lib/funnel/editorTypes';

interface SortableStepListProps {
  steps: FunnelStep[];
  selection: EditorSelection;
  onSelectStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
}

export function SortableStepList({
  steps,
  selection,
  onSelectStep,
  onDeleteStep,
}: SortableStepListProps) {
  const selectedStepId = getSelectionStepId(selection);

  return (
    <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <SortableStepItem
            key={step.id}
            step={step}
            index={index}
            isSelected={step.id === selectedStepId}
            onSelect={() => onSelectStep(step.id)}
            onDelete={() => onDeleteStep(step.id)}
            canDelete={step.step_type !== 'welcome' && step.step_type !== 'thank_you'}
          />
        ))}
      </div>
    </SortableContext>
  );
}
