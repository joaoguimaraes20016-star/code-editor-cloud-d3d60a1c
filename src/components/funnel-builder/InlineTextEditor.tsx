import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Palette,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface InlineTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onHtmlChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'headline' | 'subtext' | 'button';
  isSelected?: boolean;
  onSelect?: () => void;
  onDeselect?: () => void;
}

const PRESET_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#06b6d4', '#84cc16', '#a855f7', '#6366f1',
];

export function InlineTextEditor({
  value,
  onChange,
  onHtmlChange,
  placeholder = 'Click to edit...',
  className,
  style,
  variant = 'headline',
  isSelected,
  onSelect,
  onDeselect,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Update toolbar position based on selection - render in fixed position on screen
  useEffect(() => {
    const updateToolbarPosition = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position toolbar above the selection in viewport coordinates
        setToolbarPosition({
          top: rect.top - 56,
          left: rect.left + rect.width / 2,
        });
        setHasSelection(true);
      } else if (editorRef.current?.contains(sel?.anchorNode || null)) {
        // Keep toolbar visible if editing, use editor position
        if (isEditing && editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          setToolbarPosition({
            top: editorRect.top - 56,
            left: editorRect.left + editorRect.width / 2,
          });
        }
        setHasSelection(false);
      }
    };

    document.addEventListener('selectionchange', updateToolbarPosition);
    return () => document.removeEventListener('selectionchange', updateToolbarPosition);
  }, [isEditing]);

  // Update toolbar position when editing starts
  useEffect(() => {
    if (isEditing && editorRef.current) {
      const editorRect = editorRef.current.getBoundingClientRect();
      setToolbarPosition({
        top: editorRect.top - 56,
        left: editorRect.left + editorRect.width / 2,
      });
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      onSelect?.();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Do not blur if clicking on toolbar or any popover
    if (toolbarRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }

    // Don't close if a popover is open
    if (showColorPicker || showFontSizePicker) {
      return;
    }
    
    // Save content
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
    
    // Small delay before closing to allow for clicks
    setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement) && !showColorPicker && !showFontSizePicker) {
        setIsEditing(false);
        setHasSelection(false);
        setToolbarPosition(null);
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setHasSelection(false);
      setShowColorPicker(false);
      setShowFontSizePicker(false);
      setToolbarPosition(null);
      onDeselect?.();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const applyColor = (color: string) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
    editorRef.current?.focus();
  };

  const applyFontSize = (size: string) => {
    execCommand('fontSize', size);
    setShowFontSizePicker(false);
    editorRef.current?.focus();
  };

  const showToolbar = (isEditing || hasSelection) && toolbarPosition;

  // Render toolbar in a portal so it's not clipped by overflow:hidden containers
  const toolbarContent = showToolbar && toolbarPosition && createPortal(
    <div 
      ref={toolbarRef}
      className="fixed flex items-center gap-0.5 p-1.5 bg-popover border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{ 
        top: Math.max(8, toolbarPosition.top),
        left: toolbarPosition.left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
      
      <div className="w-px h-5 bg-border mx-1" />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }}
        title="Align Left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }}
        title="Align Center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }}
        title="Align Right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />
      
      {/* Color Picker - using dropdown instead of popover to avoid portal issues */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowColorPicker(!showColorPicker);
            setShowFontSizePicker(false);
          }}
          title="Text Color"
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
        {showColorPicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyColor(color);
                  }}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <input
                type="color"
                className="w-full h-8 cursor-pointer rounded"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  applyColor(e.target.value);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowFontSizePicker(!showFontSizePicker);
            setShowColorPicker(false);
          }}
          title="Font Size"
        >
          <Type className="h-3.5 w-3.5" />
        </Button>
        {showFontSizePicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((size) => (
                <Button
                  key={size}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyFontSize(size.toString());
                  }}
                >
                  <span style={{ fontSize: `${10 + size * 2}px` }}>Size {size}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative">
      {toolbarContent}

      {/* Editable Content - Always contentEditable for click-to-edit */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "outline-none min-w-[50px] transition-all cursor-text",
          isEditing && "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded px-1",
          !isEditing && isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded",
          !isEditing && !isSelected && "hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 rounded",
          className
        )}
        style={style}
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value || `<span style="opacity:0.5">${placeholder}</span>` }}
      />
    </div>
  );
}
