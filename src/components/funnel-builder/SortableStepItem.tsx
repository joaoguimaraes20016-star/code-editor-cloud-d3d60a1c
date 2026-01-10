// @ts-nocheck - Legacy funnel builder types need refactoring
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Trash2, Play, MessageSquare, List, Mail, Phone, Video, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FunnelStep } from '@/lib/funnel/editorTypes';

interface SortableStepItemProps {
  step: FunnelStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const stepTypeIcons = {
  welcome: Play,
  text_question: MessageSquare,
  multi_choice: List,
  email_capture: Mail,
  phone_capture: Phone,
  video: Video,
  thank_you: CheckCircle,
};

const stepTypeLabels = {
  welcome: 'Welcome',
  text_question: 'Text Question',
  multi_choice: 'Multi Choice',
  email_capture: 'Email',
  phone_capture: 'Phone',
  video: 'Video',
  thank_you: 'Thank You',
};

export function SortableStepItem({
  step,
  index,
  isSelected,
  onSelect,
  onDelete,
  canDelete,
}: SortableStepItemProps) {
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
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary border-primary',
        isDragging && 'shadow-lg'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Step {index + 1}</span>
              <Badge variant="secondary" className="text-xs">
                {stepTypeLabels[step.step_type]}
              </Badge>
            </div>
            <p className="font-medium truncate">
              {step.content.headline || 'Untitled'}
            </p>
          </div>

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
