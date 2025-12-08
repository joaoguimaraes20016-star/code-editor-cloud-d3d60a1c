import { Button } from '@/components/ui/button';
import { 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ElementActionMenuProps {
  elementId: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
}

export function ElementActionMenu({
  elementId,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  canMoveUp = true,
  canMoveDown = true,
  className,
}: ElementActionMenuProps) {
  return (
    <div 
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -right-14 z-50 flex flex-col gap-0.5 p-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-left-2",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-sm"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-sm"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      
      <div className="w-full h-px bg-border my-0.5" />
      
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-sm"
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
          className="h-7 w-7 rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}