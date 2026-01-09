import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MoreVertical,
  Pencil,
  Copy,
  ChevronUp,
  ChevronDown,
  Trash2,
  Settings,
} from 'lucide-react';
import type { Page } from '../types';

interface PageContextMenuProps {
  page: Page;
  index: number;
  onRename?: (pageId: string, newName: string) => void;
  onDuplicate?: (pageId: string) => void;
  onDelete?: (pageId: string) => void;
  onMoveUp?: (pageId: string) => void;
  onMoveDown?: (pageId: string) => void;
  onSettings?: (pageId: string) => void;
  canDelete?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function PageContextMenu({
  page,
  index,
  onRename,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onSettings,
  canDelete = true,
  canMoveUp = true,
  canMoveDown = true,
}: PageContextMenuProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(page.name);

  const handleRename = () => {
    if (newName.trim() && onRename) {
      onRename(page.id, newName.trim());
    }
    setShowRenameDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="page-context-trigger"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
            <Pencil size={14} className="mr-2" />
            Rename
          </DropdownMenuItem>
          
          {onDuplicate && (
            <DropdownMenuItem onClick={() => onDuplicate(page.id)}>
              <Copy size={14} className="mr-2" />
              Duplicate
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {onMoveUp && (
            <DropdownMenuItem 
              onClick={() => onMoveUp(page.id)}
              disabled={!canMoveUp}
            >
              <ChevronUp size={14} className="mr-2" />
              Move Up
            </DropdownMenuItem>
          )}
          
          {onMoveDown && (
            <DropdownMenuItem 
              onClick={() => onMoveDown(page.id)}
              disabled={!canMoveDown}
            >
              <ChevronDown size={14} className="mr-2" />
              Move Down
            </DropdownMenuItem>
          )}
          
          {onSettings && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSettings(page.id)}>
                <Settings size={14} className="mr-2" />
                Page Settings
              </DropdownMenuItem>
            </>
          )}
          
          {onDelete && canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(page.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete Page
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Page name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
