import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Pencil, 
  Copy, 
  Link, 
  Settings, 
  Code,
  PartyPopper,
  Trash2,
  FileUp,
  FileDown
} from 'lucide-react';
import { FunnelStep } from '@/pages/FunnelEditor';

interface PageContextMenuProps {
  step: FunnelStep;
  index: number;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function PageContextMenu({
  step,
  index,
  onRename,
  onDuplicate,
  onDelete,
  onOpenSettings,
  canDelete,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: PageContextMenuProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(step.content.headline || '');

  const handleRename = () => {
    onRename(newName);
    setShowRenameDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => {
            setNewName(step.content.headline || '');
            setShowRenameDialog(true);
          }}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
            <FileUp className="h-4 w-4 mr-2" />
            Move Up
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
            <FileDown className="h-4 w-4 mr-2" />
            Move Down
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="h-4 w-4 mr-2" />
            Page Settings
          </DropdownMenuItem>
          
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Page
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Enter a new name for this page
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Page name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}