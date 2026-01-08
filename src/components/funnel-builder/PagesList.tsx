// @ts-nocheck - Legacy funnel builder types need refactoring
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Play, MessageSquare, List, Mail, Phone, Video, CheckCircle, Plus, Copy, UserCheck, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { FunnelStep } from '@/lib/funnel/editorTypes';
import type { EditorSelection } from './editorSelection';
import { getSelectionStepId } from './editorSelection';
import { PageContextMenu } from './PageContextMenu';

// Strip HTML tags and decode entities for display
const stripHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

interface PagesListProps {
  steps: FunnelStep[];
  selection: EditorSelection;
  onSelectStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: () => void;
  onDuplicateStep?: (stepId: string) => void;
  onRenameStep?: (stepId: string, newName: string) => void;
  onOpenPageSettings?: (stepId: string) => void;
  onMoveStep?: (stepId: string, direction: 'up' | 'down') => void;
}

const stepTypeIcons: Record<string, typeof Play> = {
  welcome: Play,
  text_question: MessageSquare,
  multi_choice: List,
  email_capture: Mail,
  phone_capture: Phone,
  opt_in: UserCheck,
  video: Video,
  embed: Code,
  thank_you: CheckCircle,
};

function PageItem({
  step,
  index,
  totalSteps,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
  onOpenSettings,
  onMoveUp,
  onMoveDown,
  canDelete,
}: {
  step: FunnelStep;
  index: number;
  totalSteps: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (newName: string) => void;
  onOpenSettings: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = stepTypeIcons[step.step_type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-100 active:scale-[0.99]",
        isSelected 
          ? "bg-primary/20 text-primary" 
          : "hover:bg-secondary text-muted-foreground hover:text-foreground active:bg-secondary/80"
      )}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <span className={cn(
        "text-sm font-medium w-5",
        isSelected ? "text-primary" : "text-muted-foreground"
      )}>
        {index + 1}
      </span>

      <Icon className={cn(
        "h-4 w-4 shrink-0",
        isSelected ? "text-primary" : "text-muted-foreground"
      )} />

      <span className={cn(
        "flex-1 truncate text-sm",
        isSelected ? "text-primary font-medium" : ""
      )}>
        {stripHtml(step.content.headline) || 'Untitled'}
      </span>

      <PageContextMenu
        step={step}
        index={index}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onOpenSettings={onOpenSettings}
        canDelete={canDelete}
        canMoveUp={index > 0}
        canMoveDown={index < totalSteps - 1}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  );
}

export function PagesList({
  steps,
  selection,
  onSelectStep,
  onDeleteStep,
  onAddStep,
  onDuplicateStep,
  onRenameStep,
  onOpenPageSettings,
  onMoveStep,
}: PagesListProps) {
  const selectedStepId = getSelectionStepId(selection);
  const stepIds = useMemo(() => steps.map((step) => step.id), [steps]);

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
        Pages
      </h3>

      <Button
        variant="outline"
        size="sm"
        className="w-full mb-3 gap-2"
        onClick={onAddStep}
      >
        <Plus className="h-4 w-4" />
        Add page
      </Button>
      
      <div className="flex-1 overflow-y-auto space-y-1">
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          {steps.map((step, index) => (
            <PageItem
              key={step.id}
              step={step}
              index={index}
              totalSteps={steps.length}
              isSelected={step.id === selectedStepId}
              onSelect={() => onSelectStep(step.id)}
              onDelete={() => onDeleteStep(step.id)}
              onDuplicate={() => onDuplicateStep?.(step.id)}
              onRename={(name) => onRenameStep?.(step.id, name)}
              onOpenSettings={() => onOpenPageSettings?.(step.id)}
              onMoveUp={() => onMoveStep?.(step.id, 'up')}
              onMoveDown={() => onMoveStep?.(step.id, 'down')}
              canDelete={steps.length > 1}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
