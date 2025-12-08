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
  const [hasSelection, setHasSelection] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: -48, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Update toolbar position based on selection
  useEffect(() => {
    const updateToolbarPosition = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        
        setToolbarPosition({
          top: rect.top - editorRect.top - 52,
          left: rect.left + rect.width / 2 - editorRect.left - editorRect.width / 2,
        });
        setHasSelection(true);
      } else if (editorRef.current?.contains(sel?.anchorNode || null)) {
        setHasSelection(false);
      }
    };

    document.addEventListener('selectionchange', updateToolbarPosition);
    return () => document.removeEventListener('selectionchange', updateToolbarPosition);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      onSelect?.();
    }
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
    
    // Small delay before closing to allow for clicks
    setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement)) {
        setIsEditing(false);
        setHasSelection(false);
      }
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setHasSelection(false);
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

  const showToolbar = isEditing || hasSelection;

  return (
    <div className="relative">
      {/* Rich Text Toolbar - appears on selection or editing */}
      {showToolbar && (
        <div 
          ref={toolbarRef}
          className="absolute z-[100] flex items-center gap-0.5 p-1.5 bg-background border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95"
          style={{ 
            top: toolbarPosition.top,
            left: '50%',
            transform: 'translateX(-50%)',
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
          
          {/* Color Picker */}
          <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onMouseDown={(e) => e.preventDefault()}
                title="Text Color"
              >
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2 z-[150]" 
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
                title="Font Size"
              >
                <Type className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2 z-[150]" 
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
