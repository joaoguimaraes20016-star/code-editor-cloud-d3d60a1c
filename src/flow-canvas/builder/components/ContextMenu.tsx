import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { 
  Copy, 
  Clipboard, 
  Trash2, 
  CopyPlus, 
  ArrowUp, 
  ArrowDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface ContextMenuProps {
  children: React.ReactNode;
  type: 'block' | 'element';
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canPaste?: boolean;
  disabled?: boolean;
}

export const BuilderContextMenu: React.FC<ContextMenuProps> = ({
  children,
  type,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  canPaste = true,
  disabled = false,
}) => {
  if (disabled) {
    return <>{children}</>;
  }

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl+';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))] z-[9999] shadow-xl">
        <ContextMenuItem 
          onClick={onCopy}
          className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy {type}
          <ContextMenuShortcut>{modKey}C</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={onPaste}
          disabled={!canPaste}
          className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover disabled:opacity-50"
        >
          <Clipboard className="w-4 h-4 mr-2" />
          Paste
          <ContextMenuShortcut>{modKey}V</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={onDuplicate}
          className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover"
        >
          <CopyPlus className="w-4 h-4 mr-2" />
          Duplicate
          <ContextMenuShortcut>{modKey}D</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="bg-builder-border" />
        
        {(onMoveUp || onMoveDown) && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover">
                <ArrowUp className="w-4 h-4 mr-2" />
                Move
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))] z-[9999] shadow-xl">
                <ContextMenuItem 
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover disabled:opacity-50"
                >
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Move Up
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  className="text-builder-text hover:bg-builder-hover focus:bg-builder-hover disabled:opacity-50"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Move Down
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator className="bg-builder-border" />
          </>
        )}
        
        <ContextMenuItem 
          onClick={onDelete}
          className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
