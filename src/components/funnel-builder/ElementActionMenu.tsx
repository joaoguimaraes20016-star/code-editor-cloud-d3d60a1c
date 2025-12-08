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
        // Changed: now positioned at top-right corner INSIDE the element, not outside
        "absolute -top-1 -right-1 z-50 flex flex-row gap-0.5 p-0.5 bg-popover/95 backdrop-blur-sm border border-border rounded-md shadow-lg animate-in fade-in-0 zoom-in-95",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-sm"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
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
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
