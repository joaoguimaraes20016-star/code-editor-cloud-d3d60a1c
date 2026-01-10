import React from 'react';
import { cn } from '@/lib/utils';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  Palette,
  GripVertical,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ColorPickerPopover } from './modals';

interface ElementActionBarProps {
  elementId: string;
  elementType: string;
  currentAlign?: string;
  currentColor?: string;
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onColorChange?: (color: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  position?: 'top' | 'bottom';
  isDarkTheme?: boolean;
}

export const ElementActionBar: React.FC<ElementActionBarProps> = ({
  elementId,
  elementType,
  currentAlign = 'left',
  currentColor,
  onAlignChange,
  onColorChange,
  onDuplicate,
  onDelete,
  position = 'top',
  isDarkTheme = false,
}) => {
  // Show alignment for buttons, text elements, and form inputs
  const showAlignment = ['button', 'text', 'heading', 'input', 'select', 'checkbox', 'radio'].includes(elementType);
  // Show color picker for buttons (background) or text (text color)
  const showColorPicker = onColorChange;

  return (
    <TooltipProvider delayDuration={200}>
      {/* Invisible hover bridge - extends to cover gap between element and toolbar */}
      <div 
        className={cn(
          'absolute left-0 right-0 z-20',
          position === 'top' ? '-top-12 h-14' : '-bottom-12 h-14'
        )}
        style={{ pointerEvents: 'auto' }}
      />
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 z-30',
          'flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl border',
          'opacity-0 group-hover/element:opacity-100 transition-all duration-150',
          isDarkTheme
            ? 'bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))]'
            : 'bg-white border-gray-200',
          position === 'top' ? '-top-11' : '-bottom-11'
        )}
      >
        {/* Drag Handle */}
        <div className={cn(
          'p-1 rounded cursor-grab active:cursor-grabbing',
          isDarkTheme 
            ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]' 
            : 'bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200'
        )}>
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Divider */}
        <div className={cn('w-px h-4 mx-0.5', isDarkTheme ? 'bg-gray-700' : 'bg-gray-200')} />

        {/* Alignment buttons */}
        {showAlignment && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onAlignChange?.('left'); }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    currentAlign === 'left' || !currentAlign
                      ? 'bg-[hsl(var(--builder-accent))] text-white'
                      : isDarkTheme
                        ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]'
                        : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  )}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Align Left</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onAlignChange?.('center'); }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    currentAlign === 'center'
                      ? 'bg-[hsl(var(--builder-accent))] text-white'
                      : isDarkTheme
                        ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]'
                        : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  )}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Align Center</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onAlignChange?.('right'); }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    currentAlign === 'right'
                      ? 'bg-[hsl(var(--builder-accent))] text-white'
                      : isDarkTheme
                        ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]'
                        : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  )}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Align Right</p></TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className={cn('w-px h-4 mx-0.5', isDarkTheme ? 'bg-[hsl(var(--builder-border))]' : 'bg-gray-200')} />
          </>
        )}

        {/* Color Picker */}
        {showColorPicker && (
          <>
            <ColorPickerPopover
              color={currentColor || '#8B5CF6'}
              onChange={(color) => onColorChange?.(color)}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isDarkTheme
                    ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                )}
                title={elementType === 'button' ? 'Background Color' : 'Text Color'}
              >
                <div className="relative">
                  <Palette className="w-3.5 h-3.5" />
                  <div 
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: currentColor || '#8B5CF6' }}
                  />
                </div>
              </button>
            </ColorPickerPopover>

            {/* Divider */}
            <div className={cn('w-px h-4 mx-0.5', isDarkTheme ? 'bg-[hsl(var(--builder-border))]' : 'bg-gray-200')} />
          </>
        )}

        {/* Duplicate */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
              className={cn(
                'p-1.5 rounded transition-colors',
                isDarkTheme
                  ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))] hover:bg-[hsl(var(--builder-surface-active))]'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              )}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Duplicate</p></TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              className={cn(
                'p-1.5 rounded transition-colors',
                isDarkTheme
                  ? 'bg-[hsl(var(--builder-surface-hover))] text-[hsl(var(--builder-text-muted))] hover:text-red-400 hover:bg-red-500/15'
                  : 'bg-gray-100 text-gray-500 hover:text-red-600 hover:bg-red-50'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Delete</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
