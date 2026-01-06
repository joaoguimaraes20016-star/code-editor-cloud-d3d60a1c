import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { getDefaultElementOrder } from '@/lib/funnel/stepRegistry';

export interface CalendlyBookingData {
  event_uri?: string;
  invitee_uri?: string;
  event_start_time?: string;
  event_end_time?: string;
  invitee_name?: string;
  invitee_email?: string;
}

// Component for Calendly embeds with event detection
export function CalendlyEmbed({
  embedUrl,
  embedScale,
  iframeHeight,
  scaledHeight,
  borderRadius,
  isCalendly,
  onScheduled,
}: {
  embedUrl: string;
  embedScale: number;
  iframeHeight: number;
  scaledHeight: number;
  borderRadius: number;
  isCalendly: boolean;
  onScheduled?: (bookingData?: CalendlyBookingData) => void;
}) {
  const hasScheduledRef = useRef(false);

  useEffect(() => {
    if (!isCalendly || !onScheduled) return;

    const handleMessage = (event: MessageEvent) => {
      // Calendly sends postMessage when booking is complete
      if (event.origin.includes('calendly.com') && event.data?.event === 'calendly.event_scheduled') {
        if (!hasScheduledRef.current) {
          hasScheduledRef.current = true;
          
          // Extract booking data from Calendly event
          const payload = event.data?.payload || {};
          const bookingData: CalendlyBookingData = {
            event_uri: payload.event?.uri,
            invitee_uri: payload.invitee?.uri,
            event_start_time: payload.event?.start_time,
            event_end_time: payload.event?.end_time,
            invitee_name: payload.invitee?.name,
            invitee_email: payload.invitee?.email,
          };
          
          console.log('Calendly booking detected:', bookingData);
          
          // Small delay to let user see confirmation
          setTimeout(() => {
            onScheduled(bookingData);
          }, 1500);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isCalendly, onScheduled]);

  return (
    <div 
      className="w-full max-w-2xl mx-auto overflow-hidden"
      style={{ 
        borderRadius: `${borderRadius}px`,
        height: `${scaledHeight}px`,
      }}
    >
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
    </div>
  );
}


// Preserve color formatting from font tags and spans - DO NOT strip colors
const cleanHtmlContent = (html: string): string => {
  if (!html) return html;
  // Only remove problematic classes, keep all color and styling
  return html
    // Remove fun-font classes that cause issues
    .replace(/class="[^"]*fun-font[^"]*"/gi, '')
    // Clean up empty attributes  
    .replace(/class="\s*"/gi, '')
    .replace(/style="\s*"/gi, '');
};

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
    fontSize?: 'small' | 'medium' | 'large';
    fontFamily?: string;
    // Button gradient support
    useButtonGradient?: boolean;
    buttonGradientFrom?: string;
    buttonGradientTo?: string;
    buttonGradientDirection?: string;
    buttonHoverEffect?: 'none' | 'glow' | 'lift' | 'pulse' | 'shine';
  };
  stepType: string;
  onButtonClick?: (bookingData?: CalendlyBookingData) => void;
  onCalendlyBooking?: (bookingData?: CalendlyBookingData) => void;
  renderInput?: () => React.ReactNode;
  renderOptions?: () => React.ReactNode;
  renderForm?: () => React.ReactNode;
  isPreview?: boolean;
}

const IMAGE_ASPECT_RATIOS: Record<string, string> = {
  S: '16/9',
  M: '4/3',
  L: '5/4',
  XL: '1/1',
};

// Font size maps for editor preview (smaller) vs public funnel (larger)
const PREVIEW_FONT_SIZE_MAP = {
  small: { headline: 'text-lg', subtext: 'text-xs', text: 'text-xs' },
  medium: { headline: 'text-xl', subtext: 'text-sm', text: 'text-sm' },
  large: { headline: 'text-2xl', subtext: 'text-base', text: 'text-base' },
};

const PUBLIC_FONT_SIZE_MAP = {
  small: { headline: 'text-xl sm:text-2xl md:text-3xl', subtext: 'text-sm sm:text-base', text: 'text-sm sm:text-base' },
  medium: { headline: 'text-2xl sm:text-3xl md:text-4xl', subtext: 'text-base sm:text-lg', text: 'text-base sm:text-lg' },
  large: { headline: 'text-3xl sm:text-4xl md:text-5xl', subtext: 'text-lg sm:text-xl', text: 'text-lg sm:text-xl' },
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
  onCalendlyBooking,
  renderInput,
  renderOptions,
  renderForm,
  isPreview = false,
}: DynamicElementRendererProps) {
  const textColor = design?.textColor || '#ffffff';
  const buttonColor = design?.buttonColor || settings.primary_color;
  const buttonTextColor = design?.buttonTextColor || '#ffffff';
  const borderRadius = design?.borderRadius ?? 12;
  const fontSize = design?.fontSize || 'medium';
  const fontFamily = design?.fontFamily || 'system-ui';

  // Button gradient styling
  const getButtonStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      color: buttonTextColor,
      borderRadius: `${borderRadius}px`,
      fontFamily,
    };
    
    if (design?.useButtonGradient && design?.buttonGradientFrom && design?.buttonGradientTo) {
      style.background = `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo})`;
    } else {
      style.backgroundColor = buttonColor;
    }
    
    return style;
  };

  const buttonHoverClass = design?.buttonHoverEffect === 'glow' 
    ? 'hover:shadow-lg hover:shadow-primary/30' 
    : design?.buttonHoverEffect === 'lift'
    ? 'hover:-translate-y-1'
    : design?.buttonHoverEffect === 'pulse'
    ? 'hover:animate-pulse'
    : '';

  // Use the appropriate font size map based on context
  const fontSizeMap = isPreview ? PREVIEW_FONT_SIZE_MAP : PUBLIC_FONT_SIZE_MAP;
  const sizes = fontSizeMap[fontSize];
  
  // Simple button click handler (no booking data)
  const handleSimpleButtonClick = () => {
    if (onButtonClick) onButtonClick();
  };

  // Use element order from content or default
  const currentOrder = elementOrder?.length > 0
    ? elementOrder
    : getDefaultElementOrder(stepType);

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
    const fontStyle = { fontFamily };

    // Dynamic text blocks - don't set color on parent to allow <font color> to work
    if (elementId.startsWith('text_')) {
      const textValue = dynamicElements?.[elementId]?.text || '';
      if (!textValue) return null;
      
      // Check if the content contains color formatting, if not apply default
      const hasColorFormatting = textValue.includes('color=') || textValue.includes('color:');
      
      return (
        <div 
          className={cn(sizes.text, "text-center px-4 [&>*]:leading-relaxed")}
          style={{ 
            ...fontStyle,
            ...(hasColorFormatting ? {} : { color: textColor })
          }}
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
          onClick={handleSimpleButtonClick}
          className={cn(sizes.text, `px-5 py-2.5 font-semibold transition-all w-full max-w-xs hover:scale-105 ${buttonHoverClass}`)}
          style={getButtonStyle()}
          dangerouslySetInnerHTML={{ __html: buttonText }}
        />
      );
    }

    // Dynamic embeds (iframes) - scaled down to fit without scrolling
    if (elementId.startsWith('embed_')) {
      const embedUrl = dynamicElements?.[elementId]?.embed_url || '';
      const embedScale = dynamicElements?.[elementId]?.embed_scale || 0.75;
      if (!embedUrl) return null;
      
      // Use scaling to show the full embed at a reduced size
      const iframeHeight = 700; // Original iframe height for Calendly
      const scaledHeight = iframeHeight * embedScale;

      // Check if this is a Calendly embed for event listening
      const isCalendly = embedUrl.includes('calendly.com');
      
      const handleCalendlyScheduled = (bookingData?: CalendlyBookingData) => {
        // Call the calendly booking handler if provided
        if (onCalendlyBooking) {
          onCalendlyBooking(bookingData);
        }
        // Then advance to next step
        if (onButtonClick) {
          onButtonClick(bookingData);
        }
      };
      
      return (
        <CalendlyEmbed
          embedUrl={embedUrl}
          embedScale={embedScale}
          iframeHeight={iframeHeight}
          scaledHeight={scaledHeight}
          borderRadius={borderRadius}
          isCalendly={isCalendly}
          onScheduled={handleCalendlyScheduled}
        />
      );
    }

    // Dynamic headlines
    if (elementId.startsWith('headline_') && elementId !== 'headline') {
      const headlineText = dynamicElements?.[elementId]?.text || '';
      if (!headlineText) return null;
      const hasColorFormatting = headlineText.includes('color=') || headlineText.includes('color:');
      return (
        <h2 
          className={cn(sizes.headline, "font-bold leading-tight text-center w-full")}
          style={{ 
            ...fontStyle, 
            ...(hasColorFormatting ? {} : { color: textColor }),
          }}
          dangerouslySetInnerHTML={{ __html: headlineText.replace(/<font/g, '<font style="display:inline"') }}
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
        const cleanedHeadline = cleanHtmlContent(content.headline);
        const headlineHasColor = cleanedHeadline.includes('color=') || cleanedHeadline.includes('color:');
        return (
          <h1 
            className={cn(sizes.headline, "font-bold leading-tight text-center w-full")}
            style={{ ...fontStyle, ...(headlineHasColor ? {} : { color: textColor }) }}
            dangerouslySetInnerHTML={{ __html: cleanedHeadline.replace(/<font/g, '<font style="display:inline"') }}
          />
        );
        
      case 'subtext':
        if (!content.subtext) return null;
        const cleanedSubtext = cleanHtmlContent(content.subtext);
        const subtextHasColor = cleanedSubtext.includes('color=') || cleanedSubtext.includes('color:');
        return (
          <p 
            className={cn(sizes.subtext, "opacity-70 text-center [&>*]:leading-relaxed")}
            style={{ ...fontStyle, ...(subtextHasColor ? {} : { color: textColor }) }}
            dangerouslySetInnerHTML={{ __html: cleanedSubtext }}
          />
        );
        
      case 'button':
        return (
          <button
            onClick={handleSimpleButtonClick}
            className={cn(sizes.text, `px-5 py-2.5 font-semibold transition-all w-full max-w-xs hover:scale-105 hover:shadow-lg ${buttonHoverClass}`)}
            style={getButtonStyle()}
          >
            {content.button_text || settings.button_text || 'Get Started'}
          </button>
        );
        
      case 'input':
        return renderInput?.();
        
      case 'options':
        return renderOptions?.();

      case 'opt_in_form':
        return renderForm?.();
        
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
          <p className="text-xs text-center" style={{ color: textColor, opacity: 0.4, ...fontStyle }}>
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
    if (id.startsWith('embed_')) return !!dynamicElements?.[id]?.embed_url;
    
    // Standard elements - basic checks
    if (id === 'headline') return !!content.headline;
    if (id === 'subtext') return !!content.subtext;
    if (id === 'video') return !!getVideoEmbedUrl(content.video_url);
    if (id === 'image_top') return design?.imageUrl && design?.imagePosition === 'top';
    if (id === 'image_bottom') return design?.imageUrl && design?.imagePosition === 'bottom';
    if (id === 'button') return true;
    if (id === 'input') return true;
    if (id === 'options') return true;
    if (id === 'opt_in_form') return true;
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
