import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStepItem } from './SortableStepItem';
import { FunnelStep } from '@/pages/FunnelEditor';

interface SortableStepListProps {
  steps: FunnelStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
}

export function SortableStepList({
  steps,
  selectedStepId,
  onSelectStep,
  onDeleteStep,
}: SortableStepListProps) {
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
