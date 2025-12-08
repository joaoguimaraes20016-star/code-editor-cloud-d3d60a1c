import { useEffect, useRef } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface WelcomeStepProps {
  content: {
    headline?: string;
    subtext?: string;
    button_text?: string;
    video_url?: string;
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

export function WelcomeStep({ content, settings, onNext, isActive }: WelcomeStepProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          onNext();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, onNext]);

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
          stepType="welcome"
          onButtonClick={onNext}
        />
      </div>
    );
  }

  // Fallback to original rendering
  return (
    <div className="w-full max-w-xl text-center px-4">
      {content.headline && (
        <h1 
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 leading-tight"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {content.subtext && (
        <p 
          className="text-base md:text-lg lg:text-xl text-white/70 mb-6 md:mb-8"
          dangerouslySetInnerHTML={{ __html: content.subtext }}
        />
      )}

      <button
        ref={buttonRef}
        onClick={onNext}
        className="px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
        style={{ backgroundColor: settings.primary_color }}
      >
        {content.button_text || settings.button_text || 'Get Started'}
      </button>

      <p className="mt-4 text-white/40 text-xs md:text-sm">
        Press Enter ↵
      </p>
    </div>
  );
}
