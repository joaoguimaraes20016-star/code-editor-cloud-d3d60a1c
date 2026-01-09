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
        "element-action-menu",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="element-action-btn"
        onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp size={14} />
      </button>
      
      <button
        type="button"
        className="element-action-btn"
        onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown size={14} />
      </button>
      
      {onDuplicate && (
        <button
          type="button"
          className="element-action-btn"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
      )}
      
      {onDelete && (
        <button
          type="button"
          className="element-action-btn element-action-btn--delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
