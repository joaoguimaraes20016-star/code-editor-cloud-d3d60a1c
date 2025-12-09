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
}

export function EmbedStep({ content, settings, onNext, isActive, onCalendlyBooking }: EmbedStepProps) {
  const embedUrl = content.embed_url || '';
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
