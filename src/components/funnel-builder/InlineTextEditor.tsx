import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Palette,
  Type,
  MoveVertical,
  Space
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

const FONT_SIZES = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
  { label: '42px', value: '42px' },
  { label: '48px', value: '48px' },
  { label: '56px', value: '56px' },
  { label: '64px', value: '64px' },
];

const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.2', value: '1.2' },
  { label: '1.4', value: '1.4' },
  { label: '1.5', value: '1.5' },
  { label: '1.6', value: '1.6' },
  { label: '1.8', value: '1.8' },
  { label: '2.0', value: '2' },
];

const LETTER_SPACINGS = [
  { label: 'Tight', value: '-0.05em' },
  { label: 'Normal', value: '0' },
  { label: 'Wide', value: '0.05em' },
  { label: 'Wider', value: '0.1em' },
  { label: 'Widest', value: '0.2em' },
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
  const [showLineHeightPicker, setShowLineHeightPicker] = useState(false);
  const [showLetterSpacingPicker, setShowLetterSpacingPicker] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close all pickers
  const closeAllPickers = () => {
    setShowColorPicker(false);
    setShowFontSizePicker(false);
    setShowLineHeightPicker(false);
    setShowLetterSpacingPicker(false);
  };

  // Update toolbar position based on selection
  useEffect(() => {
    const updateToolbarPosition = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setToolbarPosition({
          top: rect.top - 56,
          left: rect.left + rect.width / 2,
        });
        setHasSelection(true);
      } else if (editorRef.current?.contains(sel?.anchorNode || null)) {
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
    if (toolbarRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }

    if (showColorPicker || showFontSizePicker || showLineHeightPicker || showLetterSpacingPicker) {
      return;
    }
    
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
    
    setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement) && !showColorPicker && !showFontSizePicker && !showLineHeightPicker && !showLetterSpacingPicker) {
        setIsEditing(false);
        setHasSelection(false);
        setToolbarPosition(null);
        closeAllPickers();
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        execCommand('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        execCommand('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        execCommand('underline');
      }
    }
    
    if (e.key === 'Escape') {
      setIsEditing(false);
      setHasSelection(false);
      closeAllPickers();
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
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size;
      range.surroundContents(span);
      handleInput();
    }
    setShowFontSizePicker(false);
    editorRef.current?.focus();
  };

  const applyLineHeight = (height: string) => {
    if (editorRef.current) {
      editorRef.current.style.lineHeight = height;
      handleInput();
    }
    setShowLineHeightPicker(false);
    editorRef.current?.focus();
  };

  const applyLetterSpacing = (spacing: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.letterSpacing = spacing;
      range.surroundContents(span);
      handleInput();
    }
    setShowLetterSpacingPicker(false);
    editorRef.current?.focus();
  };

  const showToolbar = (isEditing || hasSelection) && toolbarPosition;

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
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
        title="Underline (Ctrl+U)"
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
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllPickers();
            setShowColorPicker(!showColorPicker);
          }}
          title="Text Color"
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
        {showColorPicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '180px' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-5 gap-2" style={{ width: '150px' }}>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform flex-shrink-0"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyColor(color);
                  }}
                />
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border">
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

      {/* Font Size Dropdown */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllPickers();
            setShowFontSizePicker(!showFontSizePicker);
          }}
          title="Font Size"
        >
          <Type className="h-3.5 w-3.5" />
        </Button>
        {showFontSizePicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto"
            style={{ zIndex: 10000, minWidth: '100px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {FONT_SIZES.map((size) => (
                <Button
                  key={size.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyFontSize(size.value);
                  }}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Line Height */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllPickers();
            setShowLineHeightPicker(!showLineHeightPicker);
          }}
          title="Line Height"
        >
          <MoveVertical className="h-3.5 w-3.5" />
        </Button>
        {showLineHeightPicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '80px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {LINE_HEIGHTS.map((lh) => (
                <Button
                  key={lh.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyLineHeight(lh.value);
                  }}
                >
                  {lh.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Letter Spacing */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllPickers();
            setShowLetterSpacingPicker(!showLetterSpacingPicker);
          }}
          title="Letter Spacing"
        >
          <Space className="h-3.5 w-3.5" />
        </Button>
        {showLetterSpacingPicker && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '100px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {LETTER_SPACINGS.map((ls) => (
                <Button
                  key={ls.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyLetterSpacing(ls.value);
                  }}
                >
                  {ls.label}
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