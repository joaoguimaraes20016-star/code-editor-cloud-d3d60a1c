import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface ThankYouStepProps {
  content: {
    headline?: string;
    subtext?: string;
    redirect_url?: string;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: any;
  };
  settings: {
    primary_color: string;
    button_text: string;
  };
  onNext: () => void;
  isActive: boolean;
}

export function ThankYouStep({ content, settings, isActive }: ThankYouStepProps) {
  useEffect(() => {
    if (isActive && content.redirect_url) {
      const timer = setTimeout(() => {
        window.location.href = content.redirect_url!;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isActive, content.redirect_url]);

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  if (hasElementOrder) {
    return (
      <div className="w-full max-w-xl text-center px-4">
        <DynamicElementRenderer
          elementOrder={content.element_order || []}
          dynamicElements={content.dynamic_elements || {}}
          content={content}
          settings={settings}
          design={content.design}
          stepType="thank_you"
        />
        {content.redirect_url && (
          <p className="mt-6 md:mt-8 text-white/40 text-xs md:text-sm">
            Redirecting in 3 seconds...
          </p>
        )}
      </div>
    );
  }

  // Fallback to original rendering
  return (
    <div className="w-full max-w-xl text-center px-4">
      <div
        className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8"
        style={{ backgroundColor: `${settings.primary_color}20` }}
      >
        <CheckCircle
          className="w-8 h-8 md:w-10 md:h-10"
          style={{ color: settings.primary_color }}
        />
      </div>

      {content.headline && (
        <h2 
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {content.subtext && (
        <p 
          className="text-base md:text-lg lg:text-xl text-white/70"
          dangerouslySetInnerHTML={{ __html: content.subtext }}
        />
      )}

      {content.redirect_url && (
        <p className="mt-6 md:mt-8 text-white/40 text-xs md:text-sm">
          Redirecting in 3 seconds...
        </p>
      )}
    </div>
  );
}
