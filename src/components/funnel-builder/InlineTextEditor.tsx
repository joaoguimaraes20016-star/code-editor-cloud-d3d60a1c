import { useState, useRef, useEffect, useCallback } from 'react';
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
  onEditingChange?: (isEditing: boolean) => void;
}

const PRESET_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#06b6d4', '#84cc16', '#a855f7', '#6366f1',
];

const FONT_SIZES = [
  { label: '12px', value: '1' },
  { label: '14px', value: '2' },
  { label: '16px', value: '3' },
  { label: '18px', value: '4' },
  { label: '24px', value: '5' },
  { label: '32px', value: '6' },
  { label: '48px', value: '7' },
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
  onEditingChange,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEditingRef = useRef(false);
  const lastSavedValueRef = useRef(value); // Track what we last saved to prevent revert

  // Keep isEditingRef in sync
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Only update DOM from value prop when NOT editing AND value changed externally
  useEffect(() => {
    if (!isEditingRef.current && editorRef.current) {
      // Only update if the value actually changed from external source
      if (value !== lastSavedValueRef.current) {
        editorRef.current.innerHTML = value || placeholder;
        lastSavedValueRef.current = value;
      }
    }
  }, [value, placeholder]);

  // Only show toolbar when there is an actual text selection
  const checkTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPosition({
        top: rect.top - 50,
        left: rect.left + rect.width / 2,
      });
      setHasTextSelection(true);
    } else {
      setHasTextSelection(false);
      setToolbarPosition(null);
      setActivePicker(null);
    }
  }, []);

  useEffect(() => {
    if (isEditing) {
      document.addEventListener('selectionchange', checkTextSelection);
      return () => document.removeEventListener('selectionchange', checkTextSelection);
    }
  }, [isEditing, checkTextSelection]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      onEditingChange?.(true);
      onSelect?.();
      setTimeout(() => editorRef.current?.focus(), 0);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (toolbarRef.current?.contains(e.relatedTarget as Node)) return;
    if (activePicker) return;
    
    // Flush any pending debounced save immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Save immediately on blur
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      lastSavedValueRef.current = text;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
    
    setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement) && !activePicker) {
        setIsEditing(false);
        onEditingChange?.(false);
        setHasTextSelection(false);
        setToolbarPosition(null);
        setActivePicker(null);
      }
    }, 100);
  };

  const saveContent = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      lastSavedValueRef.current = text;
      onChange(text);
      onHtmlChange?.(editorRef.current.innerHTML);
    }
  }, [onChange, onHtmlChange]);

  // Debounced save on input - prevents cursor jumping and reduces state updates
  const handleInput = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveContent();
    }, 300);
  }, [saveContent]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); execCommand('bold'); }
      else if (e.key === 'i') { e.preventDefault(); execCommand('italic'); }
      else if (e.key === 'u') { e.preventDefault(); execCommand('underline'); }
    }
    
    if (e.key === 'Escape') {
      saveContent();
      setIsEditing(false);
      onEditingChange?.(false);
      setHasTextSelection(false);
      setToolbarPosition(null);
      setActivePicker(null);
      onDeselect?.();
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    saveContent();
  };

  const applyColor = (color: string) => {
    execCommand('foreColor', color);
    setActivePicker(null);
  };

  const applyFontSize = (size: string) => {
    execCommand('fontSize', size);
    setActivePicker(null);
  };

  const applyLineHeight = (height: string) => {
    if (editorRef.current) {
      editorRef.current.style.lineHeight = height;
      saveContent();
    }
    setActivePicker(null);
  };

  const applyLetterSpacing = (spacing: string) => {
    if (editorRef.current) {
      editorRef.current.style.letterSpacing = spacing;
      saveContent();
    }
    setActivePicker(null);
  };

  const togglePicker = (pickerName: string) => {
    setActivePicker(prev => prev === pickerName ? null : pickerName);
  };

  // Only show toolbar when text is selected
  const showToolbar = hasTextSelection && toolbarPosition;

  const toolbarContent = showToolbar && createPortal(
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
          variant={activePicker === 'color' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); togglePicker('color'); }}
          title="Text Color"
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
        {activePicker === 'color' && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, width: '180px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => { e.preventDefault(); applyColor(color); }}
                />
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border">
              <input
                type="color"
                className="w-full h-8 cursor-pointer rounded"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => applyColor(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <Button
          variant={activePicker === 'fontSize' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); togglePicker('fontSize'); }}
          title="Font Size"
        >
          <Type className="h-3.5 w-3.5" />
        </Button>
        {activePicker === 'fontSize' && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '80px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {FONT_SIZES.map((size) => (
                <Button
                  key={size.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); applyFontSize(size.value); }}
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
          variant={activePicker === 'lineHeight' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); togglePicker('lineHeight'); }}
          title="Line Height"
        >
          <MoveVertical className="h-3.5 w-3.5" />
        </Button>
        {activePicker === 'lineHeight' && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '70px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {LINE_HEIGHTS.map((lh) => (
                <Button
                  key={lh.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); applyLineHeight(lh.value); }}
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
          variant={activePicker === 'letterSpacing' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); togglePicker('letterSpacing'); }}
          title="Letter Spacing"
        >
          <Space className="h-3.5 w-3.5" />
        </Button>
        {activePicker === 'letterSpacing' && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover border border-border rounded-lg shadow-xl"
            style={{ zIndex: 10000, minWidth: '90px' }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {LETTER_SPACINGS.map((ls) => (
                <Button
                  key={ls.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); applyLetterSpacing(ls.value); }}
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

  // Set initial content when component mounts
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || placeholder;
      lastSavedValueRef.current = value;
    }
  }, []);

  return (
    <>
      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        className={cn(
          "cursor-text outline-none transition-all min-h-[1.5em] w-full",
          isEditing && "ring-1 ring-primary/30 rounded px-1",
          !value && !isEditing && "text-white/30",
          className
        )}
        style={style}
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
      {toolbarContent}
    </>
  );
}
