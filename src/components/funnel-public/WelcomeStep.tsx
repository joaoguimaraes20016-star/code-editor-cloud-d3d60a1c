import { useEffect, useRef } from 'react';

interface WelcomeStepProps {
  content: {
    headline?: string;
    subtext?: string;
    button_text?: string;
    video_url?: string;
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

  return (
    <div className="w-full max-w-xl text-center">
      {content.headline && (
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          {content.headline}
        </h1>
      )}

      {content.subtext && (
        <p className="text-lg md:text-xl text-white/70 mb-8">
          {content.subtext}
        </p>
      )}

      <button
        ref={buttonRef}
        onClick={onNext}
        className="px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
        style={{ backgroundColor: settings.primary_color }}
      >
        {content.button_text || settings.button_text || 'Get Started'}
      </button>

      <p className="mt-4 text-white/40 text-sm">
        Press Enter ↵
      </p>
    </div>
  );
}
