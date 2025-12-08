import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Link,
  Palette,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Track if we have a selection for color changes
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      // Select all text on edit start
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  // Check selection on selection change
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        setHasSelection(!sel.isCollapsed);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    onSelect?.();
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Do not blur if clicking on toolbar
    if (toolbarRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    
    // Save content
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
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
  };

  const isFormatActive = (command: string): boolean => {
    return document.queryCommandState(command);
  };

  return (
    <div className="relative group">
      {/* Rich Text Toolbar */}
      {isEditing && (
        <div 
          ref={toolbarRef}
          className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 p-1.5 bg-background border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur
        >
          <Button
            variant={isFormatActive('bold') ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={isFormatActive('italic') ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={isFormatActive('underline') ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          
          <div className="w-px h-5 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />
          
          {/* Color Picker */}
          <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2" 
              side="top"
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
                      applyColor(color);
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t">
                <input
                  type="color"
                  className="w-full h-8 cursor-pointer rounded"
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => applyColor(e.target.value)}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Font Size */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Type className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2" 
              side="top"
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
                      execCommand('fontSize', size.toString());
                    }}
                  >
                    <span style={{ fontSize: `${10 + size * 2}px` }}>Size {size}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Editable Content */}
      {isEditing ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={cn(
            "outline-none min-w-[50px] ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded px-1",
            className
          )}
          style={style}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <div
          className={cn(
            "cursor-text transition-all px-1",
            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded",
            !isSelected && "hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 rounded",
            className
          )}
          style={style}
          onDoubleClick={handleDoubleClick}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          {value || <span className="opacity-50">{placeholder}</span>}
        </div>
      )}
    </div>
  );
}
