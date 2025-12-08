import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Link,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'headline' | 'subtext' | 'button';
  isSelected?: boolean;
  onSelect?: () => void;
}

export function InlineTextEditor({
  value,
  onChange,
  placeholder = 'Click to edit...',
  className,
  style,
  variant = 'headline',
  isSelected,
  onSelect,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [textStyle, setTextStyle] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: 'center' as 'left' | 'center' | 'right',
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setShowToolbar(true);
    onSelect?.();
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Keep toolbar visible while selected
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setShowToolbar(false);
    }
  };

  const toggleStyle = (key: keyof typeof textStyle) => {
    if (key === 'align') return;
    setTextStyle(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    setTextStyle(prev => ({ ...prev, align }));
  };

  const getTextStyles = (): React.CSSProperties => ({
    fontWeight: textStyle.bold ? 'bold' : undefined,
    fontStyle: textStyle.italic ? 'italic' : undefined,
    textDecoration: textStyle.underline ? 'underline' : undefined,
    textAlign: textStyle.align,
  });

  return (
    <div ref={containerRef} className="relative group">
      {/* Floating Toolbar */}
      {(isSelected || showToolbar) && (
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-popover border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant={textStyle.bold ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => toggleStyle('bold')}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={textStyle.italic ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => toggleStyle('italic')}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={textStyle.underline ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => toggleStyle('underline')}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          
          <div className="w-px h-5 bg-border mx-1" />
          
          <Button
            variant={textStyle.align === 'left' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlign('left')}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={textStyle.align === 'center' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlign('center')}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={textStyle.align === 'right' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlign('right')}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Editable Content */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "bg-transparent border-none outline-none w-full",
            className
          )}
          style={{ ...style, ...getTextStyles() }}
          placeholder={placeholder}
        />
      ) : (
        <div
          className={cn(
            "cursor-text transition-all",
            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded",
            !isSelected && "hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 rounded",
            className
          )}
          style={{ ...style, ...getTextStyles() }}
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
