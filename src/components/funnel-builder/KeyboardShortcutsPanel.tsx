import { Keyboard } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const shortcuts = [
  { key: '↑ / ↓', action: 'Navigate elements' },
  { key: 'Delete', action: 'Remove element' },
  { key: 'Ctrl+D', action: 'Duplicate element' },
  { key: 'Escape', action: 'Deselect' },
  { key: 'Ctrl+Z', action: 'Undo' },
  { key: 'Ctrl+Shift+Z', action: 'Redo' },
];

export function KeyboardShortcutsPanel() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="w-56 p-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Keyboard Shortcuts
            </p>
            {shortcuts.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{shortcut.action}</span>
                <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-mono">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
