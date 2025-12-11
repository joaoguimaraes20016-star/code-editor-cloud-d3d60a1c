import { CalendlyEmbed, CalendlyBookingData } from './DynamicElementRenderer';

interface EmbedStepProps {
  content: Record<string, any>;
  settings: {
    primary_color: string;
    button_text: string;
    [key: string]: any;
  };
  onNext: (value?: any) => void;
  isActive: boolean;
  currentStep?: number;
  totalSteps?: number;
  onCalendlyBooking?: (bookingData?: CalendlyBookingData) => void;
  // Optional team-level Calendly URL override (when calendly_enabled_for_funnels is true)
  teamCalendlyUrl?: string | null;
}

export function EmbedStep({ content, settings, onNext, isActive, onCalendlyBooking, teamCalendlyUrl }: EmbedStepProps) {
  // Determine which URL to use:
  // 1. If teamCalendlyUrl is provided (calendly_enabled_for_funnels = true), use it for Calendly embeds
  // 2. Otherwise, fall back to the step's configured embed_url (existing behavior)
  const stepEmbedUrl = content.embed_url || '';
  const isStepCalendly = stepEmbedUrl.includes('calendly.com');
  
  // Use team Calendly URL if:
  // - teamCalendlyUrl is provided (team has calendly_enabled_for_funnels = true AND has a configured URL)
  // - AND the step's embed is a Calendly embed OR has no URL (meaning it expects Calendly)
  const embedUrl = (teamCalendlyUrl && (isStepCalendly || !stepEmbedUrl)) 
    ? teamCalendlyUrl 
    : stepEmbedUrl;
  
  const embedScale = content.embed_scale || 0.75;
  const iframeHeight = 700;
  const scaledHeight = iframeHeight * embedScale;
  const isCalendly = embedUrl.includes('calendly.com');

  const handleScheduled = (bookingData?: CalendlyBookingData) => {
    // Store the booking data
    if (onCalendlyBooking) {
      onCalendlyBooking(bookingData);
    }
    // Move to next step
    onNext(bookingData ? { calendly_booked: true, ...bookingData } : undefined);
  };

  return (
    <div className="w-full space-y-6">
      {/* Headline */}
      {content.headline && (
        <h1 
          className="text-2xl md:text-3xl font-bold text-center"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}
      
      {/* Subtext */}
      {content.subtext && (
        <p 
          className="text-base md:text-lg text-center text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: content.subtext }}
        />
      )}

      {/* Embed iframe - scaled to fit without scrolling */}
      <div className="w-full">
        {embedUrl ? (
          isCalendly ? (
            <CalendlyEmbed
              embedUrl={embedUrl}
              embedScale={embedScale}
              iframeHeight={iframeHeight}
              scaledHeight={scaledHeight}
              borderRadius={8}
              isCalendly={true}
              onScheduled={handleScheduled}
            />
          ) : (
            <div 
              className="w-full rounded-lg overflow-hidden bg-black/20"
              style={{ height: `${scaledHeight}px` }}
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
          )
        ) : (
          <div 
            className="w-full rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground"
            style={{ height: `${scaledHeight}px` }}
          >
            No embed URL configured
          </div>
        )}
      </div>

      {/* Optional continue button - only show for non-Calendly embeds */}
      {content.button_text && !isCalendly && (
        <button
          onClick={() => onNext()}
          className="w-full py-4 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: settings.primary_color }}
        >
          {content.button_text}
        </button>
      )}
    </div>
  );
}
