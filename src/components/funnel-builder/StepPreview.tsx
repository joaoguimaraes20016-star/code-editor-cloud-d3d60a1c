import { Funnel, FunnelStep, FunnelSettings } from '@/pages/FunnelEditor';
import { cn } from '@/lib/utils';
import { ElementActionMenu } from './ElementActionMenu';
import { InlineTextEditor } from './InlineTextEditor';
import { ImagePicker } from './ImagePicker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMemo, useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { 
  Plus, 
  Type, 
  Image, 
  Square, 
  Minus, 
  Video, 
  AlignLeft,
  Upload
} from 'lucide-react';
import { resolvePrivacyPolicyUrl, shouldShowConsentCheckbox } from '@/components/funnel-public/consent';
import { getDefaultElementOrder } from '@/lib/funnel/stepRegistry';

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
  useGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  imageOverlay?: boolean;
  imageOverlayColor?: string;
  imageOverlayOpacity?: number;
  // Button gradient
  useButtonGradient?: boolean;
  buttonGradientFrom?: string;
  buttonGradientTo?: string;
  buttonGradientDirection?: string;
  // Option card styling
  optionCardBg?: string;
  optionCardBorder?: string;
  optionCardBorderWidth?: number;
  optionCardSelectedBg?: string;
  optionCardSelectedBorder?: string;
  optionCardHoverEffect?: 'none' | 'scale' | 'glow' | 'lift';
  optionCardRadius?: number;
  // Input styling
  inputBg?: string;
  inputTextColor?: string;
  inputBorder?: string;
  inputBorderWidth?: number;
  inputRadius?: number;
  inputPlaceholderColor?: string;
  inputFocusBorder?: string;
  inputShowIcon?: boolean;
}

interface StepPreviewProps {
  step: FunnelStep;
  settings: FunnelSettings;
  funnel?: Funnel | null;
  selectedElement: string | null;
  onSelectElement: (element: string | null) => void;
  design?: StepDesign;
  onUpdateContent?: (field: string, value: any) => void;
  elementOrder?: string[];
  onReorderElements?: (newOrder: string[]) => void;
  dynamicContent?: Record<string, any>;
  onUpdateDynamicContent?: (elementId: string, value: any) => void;
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

const ADD_ELEMENT_OPTIONS = [
  { id: 'text', label: 'Text Block', icon: Type },
  { id: 'headline', label: 'Headline', icon: AlignLeft },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'button', label: 'Button', icon: Square },
  { id: 'divider', label: 'Divider', icon: Minus },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'embed', label: 'Embed/iFrame', icon: Square },
];

const createElementId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

// Helper to convert video URLs to embed URLs
function getVideoEmbedUrl(url?: string): string | null {
  if (!url) return null;
  
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  
  const wistiaMatch = url.match(/wistia\.com\/medias\/([a-zA-Z0-9]+)/);
  if (wistiaMatch) return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}`;
  
  if (url.includes('/embed/') || url.includes('player.vimeo.com')) return url;
  
  return null;
}

// Simple element wrapper with click-to-select action menu
function ElementWrapper({ 
  id, 
  children, 
  isSelected,
  isEditing,
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
  isEditing: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  // Get a friendly label for the element
  const getElementLabel = (elementId: string) => {
    if (elementId === 'headline') return 'Headline';
    if (elementId === 'subtext') return 'Subtext';
    if (elementId === 'button') return 'Button';
    if (elementId === 'input') return 'Input Field';
    if (elementId === 'options') return 'Options';
    if (elementId === 'video') return 'Video';
    if (elementId === 'opt_in_form') return 'Contact Form';
    if (elementId.startsWith('text_')) return 'Text Block';
    if (elementId.startsWith('headline_')) return 'Headline';
    if (elementId.startsWith('video_')) return 'Video';
    if (elementId.startsWith('image_')) return 'Image';
    if (elementId.startsWith('button_')) return 'Button';
    if (elementId.startsWith('divider_')) return 'Divider';
    if (elementId.startsWith('embed_')) return 'Embed';
    return elementId;
  };

  return (
    <div
      className={cn(
        "relative transition-all w-full cursor-pointer group",
        isSelected 
          ? "ring-2 ring-primary rounded-md shadow-lg shadow-primary/20" 
          : "hover:ring-2 hover:ring-primary/50 rounded-md"
      )}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      title={`Click to edit ${getElementLabel(id)}`}
    >
      {/* Edit indicator - shows on hover when not selected */}
      {!isSelected && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
          Click to edit
        </div>
      )}
      
      {/* Selected indicator label */}
      {isSelected && !isEditing && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded z-20 whitespace-nowrap">
          {getElementLabel(id)}
        </div>
      )}
      
      <div className="px-2 py-1">
        {children}
      </div>
      
      {/* Action menu - appears when selected but NOT when editing */}
      {isSelected && !isEditing && (
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
  funnel,
  selectedElement, 
  onSelectElement, 
  design,
  onUpdateContent,
  elementOrder,
  onReorderElements,
  dynamicContent: externalDynamicContent,
  onUpdateDynamicContent
}: StepPreviewProps) {
  const content = step.content;
  const [showAddElement, setShowAddElement] = useState(false);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState<string | null>(null);
  
  // Use external dynamic content if provided, otherwise fallback to step.content.dynamic_elements
  const dynamicContent = useMemo(() => {
    if (externalDynamicContent && Object.keys(externalDynamicContent).length > 0) {
      return externalDynamicContent;
    }
    return content.dynamic_elements || {};
  }, [externalDynamicContent, content.dynamic_elements]);

  const textColor = design?.textColor || content.design?.textColor || '#ffffff';
  const buttonColor = design?.buttonColor || content.design?.buttonColor || settings.primary_color;
  const buttonTextColor = design?.buttonTextColor || content.design?.buttonTextColor || '#ffffff';
  const fontFamily = design?.fontFamily || content.design?.fontFamily || 'system-ui';
  const fontSize = design?.fontSize || content.design?.fontSize || 'medium';
  const borderRadius = design?.borderRadius ?? content.design?.borderRadius ?? 12;

  // Compute background style
  const backgroundStyle = useMemo(() => {
    const d = (design || content.design || {}) as StepDesign;
    if (d.useGradient && d.gradientFrom && d.gradientTo) {
      return {
        background: `linear-gradient(${d.gradientDirection || 'to bottom'}, ${d.gradientFrom}, ${d.gradientTo})`
      };
    }
    return { backgroundColor: d.backgroundColor || settings.background_color };
  }, [design, content.design, settings.background_color]);

  // Use elementOrder prop, fallback to step.content.element_order, then default
  const currentOrder = useMemo(() => {
    if (elementOrder && elementOrder.length > 0) {
      return elementOrder;
    }
    if (content.element_order && content.element_order.length > 0) {
      return content.element_order;
    }
    return getDefaultElementOrder(step.step_type);
  }, [elementOrder, content.element_order, step.step_type]);

  const handleAddElement = useCallback((elementType: string) => {
    const newElementId = createElementId(elementType);
    const newOrder = [...currentOrder, newElementId];
    
    // Initialize dynamic content for the new element
    let initialValue: any = {};
    if (elementType === 'video') {
      initialValue = { video_url: '' };
    } else if (elementType === 'image') {
      initialValue = { image_url: '' };
    } else if (elementType === 'text') {
      initialValue = { text: 'New text block' };
    } else if (elementType === 'headline') {
      initialValue = { text: 'New Headline' };
    } else if (elementType === 'button') {
      initialValue = { text: 'Click me' };
    }
    
    onUpdateDynamicContent?.(newElementId, initialValue);
    onReorderElements?.(newOrder);
    setShowAddElement(false);
    onSelectElement(newElementId);
  }, [currentOrder, onReorderElements, onSelectElement, onUpdateDynamicContent]);

  const handleMoveUp = useCallback((elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    if (index > 0 && onReorderElements) {
      const newOrder = arrayMove(currentOrder, index, index - 1);
      onReorderElements(newOrder);
    }
  }, [currentOrder, onReorderElements]);

  const handleMoveDown = useCallback((elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    if (index < currentOrder.length - 1 && onReorderElements) {
      const newOrder = arrayMove(currentOrder, index, index + 1);
      onReorderElements(newOrder);
    }
  }, [currentOrder, onReorderElements]);

  const handleDuplicate = useCallback((elementId: string) => {
    const index = currentOrder.indexOf(elementId);
    const newElementId = `${elementId}_copy_${crypto.randomUUID()}`;
    const newOrder = [...currentOrder];
    newOrder.splice(index + 1, 0, newElementId);
    
    if (dynamicContent[elementId]) {
      onUpdateDynamicContent?.(newElementId, { ...dynamicContent[elementId] });
    }
    
    onReorderElements?.(newOrder);
  }, [currentOrder, onReorderElements, dynamicContent, onUpdateDynamicContent]);

  const handleDelete = useCallback((elementId: string) => {
    if (onReorderElements) {
      const newOrder = currentOrder.filter(id => id !== elementId);
      onReorderElements(newOrder);
      if (selectedElement === elementId) {
        onSelectElement(null);
      }
    }
  }, [currentOrder, onReorderElements, selectedElement, onSelectElement]);

  const handleTextChange = useCallback((field: string, value: string) => {
    onUpdateContent?.(field, value);
  }, [onUpdateContent]);

  const handleDynamicContentChange = useCallback((elementId: string, value: any) => {
    onUpdateDynamicContent?.(elementId, value);
  }, [onUpdateDynamicContent]);

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
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  };

  const renderElementContent = (elementId: string) => {
    // Dynamic text blocks
    if (elementId.startsWith('text_')) {
      const textValue = dynamicContent[elementId]?.text || 'New text block';
      return (
        <InlineTextEditor
          value={textValue}
          onChange={(val) => handleDynamicContentChange(elementId, { text: val })}
          className={cn(FONT_SIZE_MAP[fontSize].subtext, "text-center")}
          style={{ color: textColor }}
          isSelected={selectedElement === elementId}
          onSelect={() => onSelectElement(elementId)}
          onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
        />
      );
    }

    // Dynamic dividers - visible line
    if (elementId.startsWith('divider_')) {
      return (
        <div className="w-full max-w-xs mx-auto py-3">
          <div 
            className="h-[2px] w-full rounded-full"
            style={{ backgroundColor: `${textColor}40` }}
          />
        </div>
      );
    }

    // Dynamic videos
    if (elementId.startsWith('video_') && elementId !== 'video') {
      const videoUrl = dynamicContent[elementId]?.video_url || '';
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
            <div className="w-full h-full bg-white/10 flex flex-col items-center justify-center gap-2 p-4">
              <Video className="w-8 h-8 opacity-50" style={{ color: textColor }} />
              <input
                type="text"
                placeholder="Paste video URL"
                className="w-full bg-white/10 border border-white/20 px-3 py-2 text-xs text-center rounded"
                style={{ color: textColor }}
                value={videoUrl}
                onChange={(e) => handleDynamicContentChange(elementId, { video_url: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      );
    }

    // Dynamic images
    if (elementId.startsWith('image_') && !['image_top', 'image_bottom'].includes(elementId)) {
      const imageUrl = dynamicContent[elementId]?.image_url || '';
      
      return (
        <div className="w-full max-w-[200px] mx-auto">
          {imageUrl ? (
            <div className="relative group">
              <img src={imageUrl} alt="" className="w-full h-auto rounded-lg" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute inset-0 m-auto w-fit h-fit opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setImagePickerOpen(elementId); }}
              >
                Change
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full aspect-video flex flex-col items-center justify-center gap-2"
              onClick={(e) => { e.stopPropagation(); setImagePickerOpen(elementId); }}
            >
              <Upload className="w-6 h-6 opacity-60" />
              <span className="text-xs">Upload Image</span>
            </Button>
          )}
          <ImagePicker
            open={imagePickerOpen === elementId}
            onOpenChange={(open) => setImagePickerOpen(open ? elementId : null)}
            onSelect={(url) => {
              handleDynamicContentChange(elementId, { image_url: url });
              setImagePickerOpen(null);
            }}
          />
        </div>
      );
    }

    // Dynamic buttons
    if (elementId.startsWith('button_') && elementId !== 'button') {
      const buttonText = dynamicContent[elementId]?.text || 'Click me';
      return (
        <button
          className="px-6 py-3 text-sm font-semibold transition-all w-full max-w-xs"
          style={{ backgroundColor: buttonColor, color: buttonTextColor, borderRadius: `${borderRadius}px` }}
        >
          <InlineTextEditor
            value={buttonText}
            onChange={(val) => handleDynamicContentChange(elementId, { text: val })}
            className="text-center"
            style={{ color: buttonTextColor }}
            isSelected={selectedElement === elementId}
            onSelect={() => onSelectElement(elementId)}
            onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
          />
        </button>
      );
    }

    // Dynamic headlines
    if (elementId.startsWith('headline_') && elementId !== 'headline') {
      const headlineText = dynamicContent[elementId]?.text || 'New Headline';
      return (
        <InlineTextEditor
          value={headlineText}
          onChange={(val) => handleDynamicContentChange(elementId, { text: val })}
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold leading-tight text-center")}
          style={{ color: textColor }}
          isSelected={selectedElement === elementId}
          onSelect={() => onSelectElement(elementId)}
          onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
        />
      );
    }

    // Dynamic embeds (iframes) - scaled down for Calendly etc.
    if (elementId.startsWith('embed_')) {
      const embedUrl = dynamicContent[elementId]?.embed_url || '';
      const embedScale = dynamicContent[elementId]?.embed_scale || 0.75;
      const iframeHeight = 700;
      const scaledHeight = iframeHeight * embedScale;
      
      return (
        <div 
          className="w-full overflow-hidden bg-black/20"
          style={{ borderRadius: `${borderRadius}px`, height: `${scaledHeight}px` }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full origin-top-left"
              style={{
                height: `${iframeHeight}px`,
                width: `${100 / embedScale}%`,
                transform: `scale(${embedScale})`,
              }}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div 
              className="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
              style={{ color: textColor }}
            >
              <Square className="w-8 h-8 opacity-50" />
              <input
                type="text"
                placeholder="Paste embed URL (Calendly, etc.)"
                className="w-full bg-white/10 border border-white/20 px-3 py-2 text-xs text-center rounded"
                style={{ color: textColor }}
                value={embedUrl}
                onChange={(e) => handleDynamicContentChange(elementId, { ...dynamicContent[elementId], embed_url: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      );
    }

    // Standard elements
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
            onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
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
            onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
          />
        );
        
      case 'button':
        const buttonStyle: React.CSSProperties = {
          color: buttonTextColor, 
          borderRadius: `${borderRadius}px`
        };
        if (design?.useButtonGradient && design?.buttonGradientFrom && design?.buttonGradientTo) {
          buttonStyle.background = `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo})`;
        } else {
          buttonStyle.backgroundColor = buttonColor;
        }
        
        return (
          <button
            className="px-6 py-3 text-sm font-semibold transition-all w-full max-w-xs"
            style={buttonStyle}
          >
            <InlineTextEditor
              value={content.button_text || settings.button_text || 'Get Started'}
              onChange={(val) => handleTextChange('button_text', val)}
              className="text-center"
              style={{ color: buttonTextColor }}
              isSelected={selectedElement === elementId}
              onSelect={() => onSelectElement(elementId)}
              onEditingChange={(editing) => setEditingElement(editing ? elementId : null)}
            />
          </button>
        );
        
      case 'input':
        const inputType = step.step_type === 'email_capture' ? 'email' : 
                         step.step_type === 'phone_capture' ? 'tel' : 'text';
        const placeholder = content.placeholder || 
                           (step.step_type === 'email_capture' ? 'email@example.com' : 
                            step.step_type === 'phone_capture' ? '(555) 123-4567' : 'Type your answer...');
        
        // Get input styling from design
        const inputBg = design?.inputBg || '#ffffff';
        const inputTextColor = design?.inputTextColor || '#000000';
        const inputBorder = design?.inputBorder || '#e5e7eb';
        const inputBorderWidth = design?.inputBorderWidth ?? 1;
        const inputRadius = design?.inputRadius || 12;
        const inputPlaceholderColor = design?.inputPlaceholderColor || '#9ca3af';
        const showInputIcon = design?.inputShowIcon !== false;
        const submitButtonText = content.submit_button_text || 'Submit';
        
        return (
          <div className="w-full max-w-sm space-y-4">
            <div 
              className="relative flex items-start gap-3 p-4"
              style={{ 
                backgroundColor: inputBg,
                borderRadius: `${inputRadius}px`,
                border: `${inputBorderWidth}px solid ${inputBorder}`
              }}
            >
              {showInputIcon && (
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: inputPlaceholderColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
              <span style={{ color: inputPlaceholderColor }} className="flex-1 text-sm">
                {placeholder}
              </span>
            </div>
            
            {/* Submit Button */}
            <button
              className="w-full px-6 py-4 text-base font-semibold transition-all"
              style={{ 
                background: design?.useButtonGradient && design?.buttonGradientFrom
                  ? `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo || design.buttonGradientFrom})`
                  : buttonColor,
                color: buttonTextColor,
                borderRadius: `${borderRadius}px`
              }}
            >
              <InlineTextEditor
                value={submitButtonText}
                onChange={(val) => handleTextChange('submit_button_text', val)}
                className="text-center"
                style={{ color: buttonTextColor }}
                isSelected={selectedElement === 'submit_button'}
                onSelect={() => onSelectElement('submit_button')}
                onEditingChange={(editing) => setEditingElement(editing ? 'submit_button' : null)}
              />
            </button>
          </div>
        );
        
      case 'options':
        if (!content.options?.length) return null;
        const showNextBtn = content.show_next_button !== false;
        const nextBtnText = content.next_button_text || 'Next Question';
        
        const optionBg = design?.optionCardBg || 'rgba(255,255,255,0.05)';
        const optionBorder = design?.optionCardBorder || 'rgba(255,255,255,0.1)';
        const optionBorderWidth = design?.optionCardBorderWidth ?? 1;
        const optionRadius = design?.optionCardRadius ?? 12;
        const optionHoverEffect = design?.optionCardHoverEffect || 'scale';
        
        const getHoverClass = () => {
          switch (optionHoverEffect) {
            case 'scale': return 'hover:scale-[1.02]';
            case 'glow': return 'hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]';
            case 'lift': return 'hover:-translate-y-1 hover:shadow-lg';
            case 'none': return '';
            default: return 'hover:scale-[1.02]';
          }
        };
        
        return (
          <div className="w-full max-w-xs space-y-3">
            {content.options.map((option: string | { text: string; emoji?: string }, index: number) => {
              const optionText = typeof option === 'string' ? option : option.text;
              const optionEmoji = typeof option === 'string' ? undefined : option.emoji;
              
              return (
                <button
                  key={index}
                  className={`w-full p-3 text-left transition-all duration-200 flex items-center gap-3 ${getHoverClass()}`}
                  style={{
                    backgroundColor: optionBg,
                    border: `${optionBorderWidth}px solid ${optionBorder}`,
                    borderRadius: `${optionRadius}px`
                  }}
                >
                  {/* Emoji on left */}
                  {optionEmoji && (
                    <span className="text-xl shrink-0">{optionEmoji}</span>
                  )}
                  
                  {/* Text in middle */}
                  <span 
                    className="flex-1 font-medium text-sm leading-snug"
                    style={{ color: textColor }}
                  >
                    {optionText}
                  </span>
                  
                  {/* Radio circle on right */}
                  <div 
                    className="w-5 h-5 rounded-full border-2 shrink-0"
                    style={{ borderColor: optionBorder }}
                  />
                </button>
              );
            })}
            
            {/* Next Question Button preview */}
            {showNextBtn && (
              <button
                className="w-full p-3 mt-2 font-semibold text-sm transition-all opacity-50"
                style={{ 
                  background: design?.useButtonGradient && design?.buttonGradientFrom
                    ? `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo || design.buttonGradientFrom})`
                    : `linear-gradient(135deg, ${buttonColor}, ${buttonColor}dd)`,
                  color: buttonTextColor,
                  borderRadius: `${borderRadius}px`
                }}
              >
                {nextBtnText}
              </button>
            )}
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
              <div className="w-full h-full bg-white/10 flex flex-col items-center justify-center gap-2 p-4">
                <Video className="w-8 h-8 opacity-50" style={{ color: textColor }} />
                <span className="text-xs opacity-50" style={{ color: textColor }}>
                  Add video URL in sidebar
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
        
      case 'opt_in_form':
        // Get input styling from design
        const optInInputBg = design?.inputBg || '#ffffff';
        const optInInputTextColor = design?.inputTextColor || '#000000';
        const optInInputBorder = design?.inputBorder || '#e5e7eb';
        const optInInputBorderWidth = design?.inputBorderWidth ?? 1;
        const optInInputRadius = design?.inputRadius || 12;
        const optInInputPlaceholderColor = design?.inputPlaceholderColor || '#9ca3af';
        const optInShowIcon = design?.inputShowIcon !== false;
        const optInSubmitText = content.submit_button_text || 'Submit and proceed';
        const domainOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
        const optInTermsUrl = resolvePrivacyPolicyUrl({ step_type: step.step_type, content }, funnel, undefined, domainOrigin);
        const optInShowConsentCheckbox = shouldShowConsentCheckbox({ step_type: step.step_type, content }, optInTermsUrl);
        
        return (
          <div className="w-full max-w-sm space-y-3">
            {/* Name Field */}
            <div 
              className="relative flex items-center gap-3 px-4 py-3"
              style={{ 
                backgroundColor: optInInputBg,
                borderRadius: `${optInInputRadius}px`,
                border: `${optInInputBorderWidth}px solid ${optInInputBorder}`
              }}
            >
              {optInShowIcon && (
                <span className="text-base flex-shrink-0">{content.name_icon || '👋'}</span>
              )}
              <span style={{ color: optInInputPlaceholderColor }} className="flex-1 text-sm">
                {content.name_placeholder || 'Your name'}
              </span>
            </div>

            {/* Email Field */}
            <div 
              className="relative flex items-center gap-3 px-4 py-3"
              style={{ 
                backgroundColor: optInInputBg,
                borderRadius: `${optInInputRadius}px`,
                border: `${optInInputBorderWidth}px solid ${optInInputBorder}`
              }}
            >
              {optInShowIcon && (
                <span className="text-base flex-shrink-0">{content.email_icon || '✉️'}</span>
              )}
              <span style={{ color: optInInputPlaceholderColor }} className="flex-1 text-sm">
                {content.email_placeholder || 'Your email address'}
              </span>
            </div>

            {/* Phone Field */}
            <div 
              className="relative flex items-center gap-3 px-4 py-3"
              style={{ 
                backgroundColor: optInInputBg,
                borderRadius: `${optInInputRadius}px`,
                border: `${optInInputBorderWidth}px solid ${optInInputBorder}`
              }}
            >
              {optInShowIcon && (
                <span className="text-base flex-shrink-0">{content.phone_icon || '🇺🇸'}</span>
              )}
              <span style={{ color: optInInputPlaceholderColor }} className="text-xs mr-1">+1</span>
              <span style={{ color: optInInputPlaceholderColor }} className="flex-1 text-sm">
                {content.phone_placeholder || 'Your phone number'}
              </span>
            </div>

            {/* Privacy Checkbox Preview - uses canonical consent contract */}
            {optInShowConsentCheckbox && (
              <label className="flex items-start gap-2 cursor-pointer px-1">
                <div 
                  className="w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0"
                  style={{ borderColor: 'rgba(255,255,255,0.3)' }}
                />
                <span className="text-xs" style={{ color: textColor, opacity: 0.8 }}>
                  {content.privacy_text || 'I have read and accept the'}{' '}
                  <span className="underline">Privacy Policy</span>
                  .
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              className="w-full px-6 py-3 text-sm font-semibold transition-all"
              style={{ 
                background: design?.useButtonGradient && design?.buttonGradientFrom
                  ? `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo || design.buttonGradientFrom})`
                  : buttonColor,
                color: buttonTextColor,
                borderRadius: `${borderRadius}px`
              }}
            >
              <InlineTextEditor
                value={optInSubmitText}
                onChange={(val) => handleTextChange('submit_button_text', val)}
                className="text-center"
                style={{ color: buttonTextColor }}
                isSelected={selectedElement === 'submit_button'}
                onSelect={() => onSelectElement('submit_button')}
                onEditingChange={(editing) => setEditingElement(editing ? 'submit_button' : null)}
              />
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Get all elements that should be rendered
  const visibleElements = useMemo(() => {
    return currentOrder.filter(id => {
      if (id.includes('_') && /^\w+_\d+/.test(id)) return true;
      const el = renderElementContent(id);
      return el !== null;
    });
  }, [currentOrder, content, design, step.step_type]);

  return (
    <div 
      className="w-full h-full relative" 
      onClick={() => onSelectElement(null)}
      style={{ ...backgroundStyle, fontFamily }}
    >
      {/* Background image with optional overlay */}
      {design?.imagePosition === 'background' && design?.imageUrl && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${design.imageUrl})` }}
          />
          {design.imageOverlay && (
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundColor: design.imageOverlayColor || '#000000',
                opacity: design.imageOverlayOpacity || 0.5
              }}
            />
          )}
        </>
      )}

      {/* Logo */}
      {settings.logo_url && (
        <div className="absolute top-14 left-4 z-10">
          <img src={settings.logo_url} alt="Logo" className="h-5 w-auto object-contain" />
        </div>
      )}

      {/* Elements Column Layout - constrained to center */}
      <div className="flex flex-col items-center p-6 gap-3 relative z-10 min-h-[400px] w-full max-w-2xl mx-auto">
        {visibleElements.map((elementId, index) => {
          const elementContent = renderElementContent(elementId);
          if (!elementContent) return null;

          return (
            <ElementWrapper
              key={elementId}
              id={elementId}
              isSelected={selectedElement === elementId}
              isEditing={editingElement === elementId}
              onSelect={() => onSelectElement(elementId)}
              onMoveUp={() => handleMoveUp(elementId)}
              onMoveDown={() => handleMoveDown(elementId)}
              onDuplicate={() => handleDuplicate(elementId)}
              onDelete={() => handleDelete(elementId)}
              canMoveUp={index > 0}
              canMoveDown={index < visibleElements.length - 1}
            >
              {elementContent}
            </ElementWrapper>
          );
        })}

        {/* Add Element Button */}
        <Popover open={showAddElement} onOpenChange={setShowAddElement}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-dashed border-white/30 text-white/60 hover:text-white hover:border-white/50 bg-transparent hover:bg-white/10"
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
