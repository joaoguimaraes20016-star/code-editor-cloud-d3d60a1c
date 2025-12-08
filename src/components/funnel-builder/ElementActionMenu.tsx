import { Button } from '@/components/ui/button';
import { 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Trash2,
  GripVertical,
  Settings,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ElementActionMenuProps {
  elementId: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onOpenSettings?: () => void;
  onOpenStyle?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
  position?: 'right' | 'left';
}

export function ElementActionMenu({
  elementId,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onOpenSettings,
  onOpenStyle,
  canMoveUp = true,
  canMoveDown = true,
  className,
  position = 'right',
}: ElementActionMenuProps) {
  return (
    <div 
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 p-1.5 bg-popover border rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-left-2",
        position === 'right' ? "-right-14" : "-left-14",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      
      <div className="w-full h-px bg-border my-0.5" />
      
      {onOpenStyle && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onOpenStyle}
          title="Style element"
        >
          <Palette className="h-4 w-4" />
        </Button>
      )}
      
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDuplicate}
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
      )}
      
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}