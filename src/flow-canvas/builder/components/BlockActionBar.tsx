import React from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Trash2, 
  Plus,
  GripVertical,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BlockActionBarProps {
  blockId: string;
  blockLabel: string;
  position: 'left' | 'right';
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  trackingId?: string;
  onTrackingIdChange?: (id: string) => void;
  // Drag handle props from @dnd-kit
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
}

export const BlockActionBar: React.FC<BlockActionBarProps> = ({
  blockId,
  blockLabel,
  position,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAddAbove,
  onAddBelow,
  trackingId,
  onTrackingIdChange,
  dragHandleProps,
}) => {
  const positionClasses = position === 'left' 
    ? 'right-full mr-2' 
    : 'left-full ml-2';

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={`
          absolute top-1/2 -translate-y-1/2 ${positionClasses}
          flex flex-col gap-0.5 p-1 rounded-lg
          bg-[hsl(var(--builder-surface))] border border-[hsl(var(--builder-border))]
          shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150
          z-20
        `}
      >
        {/* Drag Handle - connected to @dnd-kit when dragHandleProps provided */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              {...(dragHandleProps?.attributes || {})}
              {...(dragHandleProps?.listeners || {})}
              className="p-1.5 rounded bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))] cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={position === 'left' ? 'left' : 'right'}>
            <p>Drag to reorder</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-full h-px bg-[hsl(var(--builder-border))]" />

        {/* Move Up */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={`
                p-1.5 rounded transition-colors
                ${canMoveUp 
                  ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]' 
                  : 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-dim))] cursor-not-allowed opacity-50'
                }
              `}
            >
              <ChevronUp size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={position === 'left' ? 'left' : 'right'}>
            <p>Move up</p>
          </TooltipContent>
        </Tooltip>

        {/* Move Down */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={`
                p-1.5 rounded transition-colors
                ${canMoveDown 
                  ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]' 
                  : 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-dim))] cursor-not-allowed opacity-50'
                }
              `}
            >
              <ChevronDown size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={position === 'left' ? 'left' : 'right'}>
            <p>Move down</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-full h-px bg-[hsl(var(--builder-border))]" />

        {/* Duplicate */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))] transition-colors"
            >
              <Copy size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={position === 'left' ? 'left' : 'right'}>
            <p>Duplicate (Cmd+D)</p>
          </TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDelete}
              className="p-1.5 rounded bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-error))] hover:bg-[hsl(var(--builder-error)/0.15)] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={position === 'left' ? 'left' : 'right'}>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-full h-px bg-[hsl(var(--builder-border))]" />

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))] transition-colors">
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side={position === 'left' ? 'left' : 'right'}
            className="bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))]"
          >
            <DropdownMenuItem 
              onClick={onAddAbove}
              className="text-[hsl(var(--builder-text))] focus:bg-[hsl(var(--builder-surface-hover))]"
            >
              <Plus size={14} className="mr-2" />
              Add block above
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onAddBelow}
              className="text-[hsl(var(--builder-text))] focus:bg-[hsl(var(--builder-surface-hover))]"
            >
              <Plus size={14} className="mr-2" />
              Add block below
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[hsl(var(--builder-border))]" />
            <DropdownMenuItem 
              onClick={onDuplicate}
              className="text-[hsl(var(--builder-text))] focus:bg-[hsl(var(--builder-surface-hover))]"
            >
              <Copy size={14} className="mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[hsl(var(--builder-border))]" />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-[hsl(var(--builder-error))] focus:bg-[hsl(var(--builder-error)/0.1)]"
            >
              <Trash2 size={14} className="mr-2" />
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
};