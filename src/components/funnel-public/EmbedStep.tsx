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
}

export function EmbedStep({ content, settings, onNext, isActive }: EmbedStepProps) {
  const embedUrl = content.embed_url || '';
  const embedHeight = content.embed_height || 600;

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

      {/* Embed iframe */}
      <div className="w-full">
        {embedUrl ? (
          <div 
            className="w-full rounded-lg overflow-hidden bg-black/20"
            style={{ height: `${embedHeight}px` }}
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : (
          <div 
            className="w-full rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground"
            style={{ height: `${embedHeight}px` }}
          >
            No embed URL configured
          </div>
        )}
      </div>

      {/* Optional continue button */}
      {content.button_text && (
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
