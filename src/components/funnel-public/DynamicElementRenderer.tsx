import { cn } from '@/lib/utils';

interface DynamicElementRendererProps {
  elementOrder: string[];
  dynamicElements: Record<string, any>;
  content: Record<string, any>;
  settings: {
    primary_color: string;
    button_text: string;
  };
  design?: {
    textColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    borderRadius?: number;
    imageUrl?: string;
    imageSize?: 'S' | 'M' | 'L' | 'XL';
    imagePosition?: 'top' | 'bottom' | 'background';
  };
  stepType: string;
  onButtonClick?: () => void;
  renderInput?: () => React.ReactNode;
  renderOptions?: () => React.ReactNode;
}

const DEFAULT_ELEMENT_ORDERS: Record<string, string[]> = {
  welcome: ['image_top', 'headline', 'subtext', 'button', 'hint'],
  text_question: ['image_top', 'headline', 'input', 'hint'],
  multi_choice: ['image_top', 'headline', 'options'],
  email_capture: ['image_top', 'headline', 'subtext', 'input', 'hint'],
  phone_capture: ['image_top', 'headline', 'subtext', 'input', 'hint'],
  video: ['headline', 'video', 'button'],
  thank_you: ['image_top', 'headline', 'subtext'],
};

const IMAGE_ASPECT_RATIOS: Record<string, string> = {
  S: '16/9',
  M: '4/3',
  L: '5/4',
  XL: '1/1',
};

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

export function DynamicElementRenderer({
  elementOrder,
  dynamicElements,
  content,
  settings,
  design,
  stepType,
  onButtonClick,
  renderInput,
  renderOptions,
}: DynamicElementRendererProps) {
  const textColor = design?.textColor || '#ffffff';
  const buttonColor = design?.buttonColor || settings.primary_color;
  const buttonTextColor = design?.buttonTextColor || '#ffffff';
  const borderRadius = design?.borderRadius ?? 12;

  // Use element order from content or default
  const currentOrder = elementOrder?.length > 0 
    ? elementOrder 
    : DEFAULT_ELEMENT_ORDERS[stepType] || ['headline', 'subtext', 'button'];

  const renderImage = () => {
    if (!design?.imageUrl || design?.imagePosition === 'background') return null;
    
    const aspectRatio = IMAGE_ASPECT_RATIOS[design.imageSize || 'M'];
    
    return (
      <div 
        className="w-full max-w-xs mx-auto rounded-lg overflow-hidden"
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

  const renderElement = (elementId: string) => {
    // Dynamic text blocks
    if (elementId.startsWith('text_')) {
      const textValue = dynamicElements?.[elementId]?.text || '';
      if (!textValue) return null;
      return (
        <div 
          className="text-sm sm:text-base md:text-lg lg:text-xl text-center px-4 [&>*]:leading-relaxed"
          style={{ color: textColor }}
          dangerouslySetInnerHTML={{ __html: textValue }}
        />
      );
    }

    // Dynamic dividers
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
      const videoUrl = dynamicElements?.[elementId]?.video_url || '';
      const embedUrl = getVideoEmbedUrl(videoUrl);
      if (!embedUrl) return null;
      
      return (
        <div 
          className="w-full max-w-2xl mx-auto aspect-video overflow-hidden"
          style={{ borderRadius: `${borderRadius}px` }}
        >
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    // Dynamic images
    if (elementId.startsWith('image_') && !['image_top', 'image_bottom'].includes(elementId)) {
      const imageUrl = dynamicElements?.[elementId]?.image_url || '';
      if (!imageUrl) return null;
      
      return (
        <div className="w-full max-w-xs mx-auto">
          <img src={imageUrl} alt="" className="w-full h-auto rounded-lg" />
        </div>
      );
    }

    // Dynamic buttons
    if (elementId.startsWith('button_') && elementId !== 'button') {
      const buttonText = dynamicElements?.[elementId]?.text || 'Click';
      return (
        <button
          onClick={onButtonClick}
          className="px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-semibold transition-all w-full max-w-xs hover:scale-105"
          style={{ backgroundColor: buttonColor, color: buttonTextColor, borderRadius: `${borderRadius}px` }}
          dangerouslySetInnerHTML={{ __html: buttonText }}
        />
      );
    }

    // Dynamic headlines
    if (elementId.startsWith('headline_') && elementId !== 'headline') {
      const headlineText = dynamicElements?.[elementId]?.text || '';
      if (!headlineText) return null;
      return (
        <h2 
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold leading-tight text-center [&>*]:leading-tight"
          style={{ color: textColor }}
          dangerouslySetInnerHTML={{ __html: headlineText }}
        />
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
        if (!content.headline) return null;
        return (
          <h1 
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight text-center [&>*]:leading-tight"
            style={{ color: textColor }}
            dangerouslySetInnerHTML={{ __html: content.headline }}
          />
        );
        
      case 'subtext':
        if (!content.subtext) return null;
        return (
          <p 
            className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-70 text-center [&>*]:leading-relaxed"
            style={{ color: textColor }}
            dangerouslySetInnerHTML={{ __html: content.subtext }}
          />
        );
        
      case 'button':
        return (
          <button
            onClick={onButtonClick}
            className="px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-semibold transition-all w-full max-w-xs hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: buttonColor, color: buttonTextColor, borderRadius: `${borderRadius}px` }}
          >
            {content.button_text || settings.button_text || 'Get Started'}
          </button>
        );
        
      case 'input':
        return renderInput?.();
        
      case 'options':
        return renderOptions?.();
        
      case 'video':
        const videoUrl = content.video_url;
        const embedUrl = getVideoEmbedUrl(videoUrl);
        if (!embedUrl) return null;
        
        return (
          <div 
            className="w-full max-w-2xl mx-auto aspect-video overflow-hidden"
            style={{ borderRadius: `${borderRadius}px` }}
          >
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
        
      case 'hint':
        return (
          <p className="text-xs md:text-sm text-center" style={{ color: textColor, opacity: 0.4 }}>
            Press Enter ↵
          </p>
        );
        
      default:
        return null;
    }
  };

  // Filter out elements that don't render anything
  const visibleElements = currentOrder.filter(id => {
    // Dynamic elements - check if they have content
    if (id.startsWith('text_')) return !!dynamicElements?.[id]?.text;
    if (id.startsWith('video_') && id !== 'video') return !!getVideoEmbedUrl(dynamicElements?.[id]?.video_url);
    if (id.startsWith('image_') && !['image_top', 'image_bottom'].includes(id)) return !!dynamicElements?.[id]?.image_url;
    if (id.startsWith('button_') && id !== 'button') return true;
    if (id.startsWith('headline_') && id !== 'headline') return !!dynamicElements?.[id]?.text;
    if (id.startsWith('divider_')) return true;
    
    // Standard elements - basic checks
    if (id === 'headline') return !!content.headline;
    if (id === 'subtext') return !!content.subtext;
    if (id === 'video') return !!getVideoEmbedUrl(content.video_url);
    if (id === 'image_top') return design?.imageUrl && design?.imagePosition === 'top';
    if (id === 'image_bottom') return design?.imageUrl && design?.imagePosition === 'bottom';
    if (id === 'button') return true;
    if (id === 'input') return true;
    if (id === 'options') return true;
    if (id === 'hint') return true;
    
    return false;
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 md:gap-6 w-full">
      {visibleElements.map((elementId) => {
        const element = renderElement(elementId);
        if (!element) return null;
        return (
          <div key={elementId} className="w-full flex justify-center">
            {element}
          </div>
        );
      })}
    </div>
  );
}
