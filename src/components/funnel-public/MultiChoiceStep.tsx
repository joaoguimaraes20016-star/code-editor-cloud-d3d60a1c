import { useEffect } from 'react';

interface MultiChoiceStepProps {
  content: {
    headline?: string;
    options?: string[];
    is_required?: boolean;
  };
  settings: {
    primary_color: string;
  };
  onNext: (value: string) => void;
  isActive: boolean;
}

export function MultiChoiceStep({ content, settings, onNext, isActive }: MultiChoiceStepProps) {
  const options = content.options || [];

  useEffect(() => {
    if (isActive) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= options.length) {
          onNext(options[num - 1]);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, options, onNext]);

  return (
    <div className="w-full max-w-xl text-center">
      {content.headline && (
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
          {content.headline}
        </h2>
      )}

      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => onNext(option)}
            className="w-full p-4 text-lg font-medium text-white bg-white/10 rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-200 hover:scale-[1.02] flex items-center gap-4"
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: settings.primary_color }}
            >
              {index + 1}
            </span>
            <span className="text-left">{option}</span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-white/40 text-sm">
        Press 1-{options.length} to select
      </p>
    </div>
  );
}
