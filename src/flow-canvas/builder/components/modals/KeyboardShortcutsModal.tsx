import React from 'react';
// Updated with undo/redo feedback shortcuts
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutCategory {
  name: string;
  shortcuts: { keys: string[]; description: string }[];
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const shortcutCategories: ShortcutCategory[] = [
  {
    name: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Escape'], description: 'Deselect / Close palette' },
      { keys: ['P'], description: 'Toggle preview mode' },
      { keys: ['G'], description: 'Toggle grid overlay' },
    ],
  },
  {
    name: 'History',
    shortcuts: [
      { keys: [isMac ? '⌘' : 'Ctrl', 'Z'], description: 'Undo' },
      { keys: [isMac ? '⌘' : 'Ctrl', isMac ? '⇧' : 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    name: 'Selection',
    shortcuts: [
      { keys: ['Click'], description: 'Select element/block' },
      { keys: ['Shift', 'Click'], description: 'Multi-select elements/blocks' },
      { keys: ['Escape'], description: 'Clear selection' },
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      { keys: [isMac ? '⌘' : 'Ctrl', 'C'], description: 'Copy selected element/block' },
      { keys: [isMac ? '⌘' : 'Ctrl', 'V'], description: 'Paste element/block' },
      { keys: [isMac ? '⌘' : 'Ctrl', 'D'], description: 'Duplicate selected' },
      { keys: ['Delete'], description: 'Delete selected element(s)' },
      { keys: ['Right-click'], description: 'Open context menu' },
    ],
  },
  {
    name: 'Adding Content',
    shortcuts: [
      { keys: ['B'], description: 'Open Block Palette' },
      { keys: ['F'], description: 'Add new section/frame' },
      { keys: ['T'], description: 'Open Text Styles' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['V'], description: 'Select mode' },
      { keys: ['H'], description: 'Pan/Hand mode' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-builder-surface-active border border-builder-border text-xs font-medium text-builder-text shadow-sm">
    {children}
  </span>
);

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-builder-surface border-builder-border text-builder-text">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-builder-text">
            <Keyboard className="w-5 h-5 text-builder-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto builder-scroll">
          {shortcutCategories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold text-builder-text-muted mb-3 uppercase tracking-wide">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-builder-bg hover:bg-builder-surface-hover transition-colors"
                  >
                    <span className="text-sm text-builder-text-secondary">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <KeyBadge>{key}</KeyBadge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-builder-text-dim text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t border-builder-border">
          <p className="text-xs text-builder-text-dim text-center">
            Press <KeyBadge>?</KeyBadge> anytime to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
