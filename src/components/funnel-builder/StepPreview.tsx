import { FunnelStep, FunnelSettings } from '@/pages/FunnelEditor';
import { cn } from '@/lib/utils';
import { ElementActionMenu } from './ElementActionMenu';
import { InlineTextEditor } from './InlineTextEditor';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMemo, useState } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, 
  Type, 
  Image, 
  Square, 
  Minus, 
  Video, 
  AlignLeft 
} from 'lucide-react';

interface StepDesign {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  borderRadius?: number;
  padding?: number;
  imageUrl?: string;
  imageSize?: 'S' | 'M' | 'L' | 'XL';
  imagePosition?: 'top' | 'bottom' | 'background';
}

interface StepPreviewProps {
  step: FunnelStep;
  settings: FunnelSettings;
  selectedElement: string | null;
  onSelectElement: (element: string | null) => void;
  design?: StepDesign;
  onUpdateContent?: (field: string, value: any) => void;
  elementOrder?: string[];
  onReorderElements?: (newOrder: string[]) => void;
}

const IMAGE_ASPECT_RATIOS = {
  S: '16/9',
  M: '4/3',
  L: '5/4',
  XL: '1/1',
};

const FONT_SIZE_MAP = {
  small: { headline: 'text-lg', subtext: 'text-xs' },
  medium: { headline: 'text-xl', subtext: 'text-sm' },
  large: { headline: 'text-2xl', subtext: 'text-base' },
};

const DEFAULT_ELEMENT_ORDERS: Record<string, string[]> = {
  welcome: ['image_top', 'headline', 'subtext', 'button', 'hint'],
  text_question: ['image_top', 'headline', 'input', 'hint'],
  multi_choice: ['image_top', 'headline', 'options'],
  email_capture: ['image_top', 'headline', 'subtext', 'input', 'hint'],
  phone_capture: ['image_top', 'headline', 'subtext', 'input', 'hint'],
  video: ['headline', 'video', 'button'],
  thank_you: ['image_top', 'headline', 'subtext'],
};

const ADD_ELEMENT_OPTIONS = [
  { id: 'text', label: 'Text Block', icon: Type },
  { id: 'headline', label: 'Headline', icon: AlignLeft },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'button', label: 'Button', icon: Square },
  { id: 'divider', label: 'Divider', icon: Minus },
  { id: 'video', label: 'Video', icon: Video },
];

// Helper to convert video URLs to embed URLs
function getVideoEmbedUrl(url?: string): string | null {
  if (!url) return null;
  
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  
  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return `https://www.loom.com/embed/${loomMatch[1]}`;
  }
  
  // Wistia
  const wistiaMatch = url.match(/wistia\.com\/medias\/([a-zA-Z0-9]+)/);
  if (wistiaMatch) {
    return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}`;
  }
  
  // If already an embed URL, return as-is
  if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
    return url;
  }
  
  return null;
}

// Sortable Element Wrapper - improved for smoother drag
function SortableElement({ 
  id, 
  children, 
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  canMoveUp,
  canMoveDown,
}: { 
  id: string; 
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    transition: {
      duration: 200,
      easing: 'ease',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : 'transform 250ms ease',
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-all group py-1",
        isSelected 
          ? "ring-2 ring-primary rounded bg-primary/5" 
          : "hover:ring-2 hover:ring-primary/40 rounded hover:bg-primary/5",
        isDragging && "shadow-2xl cursor-grabbing"
      )}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="px-2">
        {children}
      </div>
      
      {/* Action menu - appears above the element when selected */}
      {isSelected && (
        <ElementActionMenu
          elementId={id}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      )}
    </div>
  );
}

export function StepPreview({ 
  step, 
  settings, 
  selectedElement, 
  onSelectElement, 
  design,
  onUpdateContent,
  elementOrder,
  onReorderElements
}: StepPreviewProps) {
  const content = step.content;
  const [showAddElement, setShowAddElement] = useState(false);

  const textColor = design?.textColor || '#ffffff';
  const buttonColor = design?.buttonColor || settings.primary_color;
  const buttonTextColor = design?.buttonTextColor || '#ffffff';
  const fontFamily = design?.fontFamily || 'system-ui';
  const fontSize = design?.fontSize || 'medium';
  const borderRadius = design?.borderRadius ?? 12;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 25, // Much higher distance to prevent accidental drags
        delay: 200,   // Longer delay before drag starts
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentOrder = useMemo(() => {
    if (elementOrder && elementOrder.length > 0) {
      return elementOrder;
    }
    return DEFAULT_ELEMENT_ORDERS[step.step_type] || ['headline', 'subtext', 'button'];
  }, [elementOrder, step.step_type]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      onReorderElements?.(newOrder);
    }
  };

  const handleAddElement = (elementType: string) => {
    const newElementId = `${elementType}_${Date.now()}`;
    const newOrder = [...currentOrder, newElementId];
    onReorderElements?.(newOrder);
    setShowAddElement(false);
  };

  const handleMoveUp = (elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    if (index > 0 && onReorderElements) {
      const newOrder = arrayMove(currentOrder, index, index - 1);
      onReorderElements(newOrder);
    }
  };

  const handleMoveDown = (elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    if (index < currentOrder.length - 1 && onReorderElements) {
      const newOrder = arrayMove(currentOrder, index, index + 1);
      onReorderElements(newOrder);
    }
  };

  const handleDuplicate = (elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    const newElementId = `${elementId}_copy_${Date.now()}`;
    const newOrder = [...currentOrder];
    newOrder.splice(index + 1, 0, newElementId);
    onReorderElements?.(newOrder);
  };

  const handleDelete = (elementId: string) => {
    if (onReorderElements) {
      const newOrder = currentOrder.filter(id => id !== elementId);
      onReorderElements(newOrder);
    }
  };

  const handleTextChange = (field: string, value: string) => {
    onUpdateContent?.(field, value);
  };

  const renderImage = () => {
    if (!design?.imageUrl || design?.imagePosition === 'background') return null;
    
    const aspectRatio = IMAGE_ASPECT_RATIOS[design.imageSize || 'M'];
    
    return (
      <div 
        className="w-full max-w-[200px] mx-auto rounded-lg overflow-hidden"
        style={{ aspectRatio }}
      >
        <img 
          src={design.imageUrl} 
          alt="" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  const renderElementContent = (elementId: string) => {
    // Handle dynamically added elements
    if (elementId.startsWith('text_')) {
      return (
        <InlineTextEditor
          value="New text block"
          onChange={(val) => handleTextChange(elementId, val)}
          className={cn(FONT_SIZE_MAP[fontSize].subtext, "text-center")}
          style={{ color: textColor }}
          isSelected={selectedElement === elementId}
          onSelect={() => onSelectElement(elementId)}
        />
      );
    }

    if (elementId.startsWith('divider_')) {
      return (
        <div 
          className="w-full max-w-xs mx-auto py-4 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelectElement(elementId); }}
        >
          <div className="h-px bg-white/30" />
        </div>
      );
    }

    switch (elementId) {
      case 'image_top':
        if (!design?.imageUrl || design?.imagePosition !== 'top') return null;
        return renderImage();
        
      case 'image_bottom':
        if (!design?.imageUrl || design?.imagePosition !== 'bottom') return null;
        return renderImage();
        
      case 'headline':
        return (
          <InlineTextEditor
            value={content.headline || ''}
            onChange={(val) => handleTextChange('headline', val)}
            placeholder="Add headline..."
            className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold leading-tight text-center")}
            style={{ color: textColor }}
            isSelected={selectedElement === elementId}
            onSelect={() => onSelectElement(elementId)}
          />
        );
        
      case 'subtext':
        return (
          <InlineTextEditor
            value={content.subtext || ''}
            onChange={(val) => handleTextChange('subtext', val)}
            placeholder="Add subtext..."
            className={cn(FONT_SIZE_MAP[fontSize].subtext, "opacity-70 text-center")}
            style={{ color: textColor }}
            isSelected={selectedElement === elementId}
            onSelect={() => onSelectElement(elementId)}
          />
        );
        
      case 'button':
        return (
          <button
            className="px-6 py-3 text-sm font-semibold transition-all w-full max-w-xs"
            style={{ 
              backgroundColor: buttonColor, 
              color: buttonTextColor,
              borderRadius: `${borderRadius}px`
            }}
          >
            <InlineTextEditor
              value={content.button_text || settings.button_text || 'Get Started'}
              onChange={(val) => handleTextChange('button_text', val)}
              className="text-center"
              style={{ color: buttonTextColor }}
              isSelected={selectedElement === elementId}
              onSelect={() => onSelectElement(elementId)}
            />
          </button>
        );
        
      case 'input':
        const inputType = step.step_type === 'email_capture' ? 'email' : 
                         step.step_type === 'phone_capture' ? 'tel' : 'text';
        const placeholder = content.placeholder || 
                           (step.step_type === 'email_capture' ? 'email@example.com' : 
                            step.step_type === 'phone_capture' ? '(555) 123-4567' : 'Type here...');
        return (
          <div className="w-full max-w-xs">
            <input
              type={inputType}
              placeholder={placeholder}
              className="w-full bg-white/10 border border-white/20 px-4 py-3 text-center"
              style={{ 
                color: textColor, 
                borderRadius: `${borderRadius}px`
              }}
              readOnly
            />
          </div>
        );
        
      case 'options':
        if (!content.options?.length) return null;
        return (
          <div className="w-full max-w-xs space-y-2">
            {content.options.map((option: string, index: number) => (
              <button
                key={index}
                className="w-full px-4 py-3 hover:opacity-80 transition-colors text-sm font-medium"
                style={{ 
                  backgroundColor: buttonColor,
                  color: buttonTextColor,
                  borderRadius: `${borderRadius}px`
                }}
              >
                {option}
              </button>
            ))}
          </div>
        );
        
      case 'video':
        const videoUrl = content.video_url;
        const embedUrl = getVideoEmbedUrl(videoUrl);
        
        return (
          <div 
            className="w-full aspect-video overflow-hidden"
            style={{ borderRadius: `${borderRadius}px` }}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div 
                className="w-full h-full bg-white/10 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); onSelectElement('video'); }}
              >
                <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>
                  {videoUrl ? 'Invalid video URL' : 'Click to add video URL'}
                </span>
              </div>
            )}
          </div>
        );
        
      case 'hint':
        return (
          <p className="text-xs text-center" style={{ color: textColor, opacity: 0.4 }}>
            Press Enter ↵
          </p>
        );
        
      default:
        return null;
    }
  };

  // Filter out null elements
  const visibleElements = currentOrder.filter(id => {
    const content = renderElementContent(id);
    return content !== null;
  });

  return (
    <div 
      className="w-full h-full relative" 
      onClick={() => onSelectElement(null)}
      style={{ fontFamily }}
    >
      {/* Background image overlay */}
      {design?.imagePosition === 'background' && design?.imageUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${design.imageUrl})` }}
        />
      )}

      {/* Logo */}
      {settings.logo_url && (
        <div className="absolute top-14 left-4 z-10">
          <img
            src={settings.logo_url}
            alt="Logo"
            className="h-5 w-auto object-contain"
          />
        </div>
      )}

      {/* Drag and Drop Column Layout - NO height limit */}
      <div className="flex flex-col items-center p-6 gap-4 relative z-10 min-h-[400px]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleElements} strategy={verticalListSortingStrategy}>
            {visibleElements.map((elementId) => {
              const index = visibleElements.indexOf(elementId);
              const elementContent = renderElementContent(elementId);
              
              if (!elementContent) return null;

              return (
                <SortableElement
                  key={elementId}
                  id={elementId}
                  isSelected={selectedElement === elementId}
                  onSelect={() => onSelectElement(elementId)}
                  onMoveUp={() => handleMoveUp(elementId)}
                  onMoveDown={() => handleMoveDown(elementId)}
                  onDuplicate={() => handleDuplicate(elementId)}
                  onDelete={() => handleDelete(elementId)}
                  canMoveUp={index > 0}
                  canMoveDown={index < visibleElements.length - 1}
                >
                  {elementContent}
                </SortableElement>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Add Element Button */}
        <Popover open={showAddElement} onOpenChange={setShowAddElement}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-dashed border-white/30 text-white/60 hover:text-white hover:border-white/50 bg-transparent hover:bg-white/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Element
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" side="top">
            <div className="grid gap-1">
              {ADD_ELEMENT_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddElement(option.id)}
                >
                  <option.icon className="h-4 w-4 mr-2" />
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
