import { Button } from '@/components/ui/button';
import { 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Trash2,
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
  position?: 'right' | 'left' | 'top';
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
  position = 'top',
}: ElementActionMenuProps) {
  return (
    <div 
      className={cn(
        "absolute z-50 flex items-center gap-0.5 p-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95",
        position === 'top' && "left-1/2 -translate-x-1/2 -top-10",
        position === 'right' && "top-1/2 -translate-y-1/2 left-full ml-2",
        position === 'left' && "top-1/2 -translate-y-1/2 right-full mr-2",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      
      <div className="w-px h-4 bg-border" />
      
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-sm"
          onClick={onDuplicate}
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
      
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}