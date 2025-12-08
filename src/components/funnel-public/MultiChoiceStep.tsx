import { useEffect } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface MultiChoiceStepProps {
  content: {
    headline?: string;
    options?: string[];
    is_required?: boolean;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: any;
  };
  settings: {
    primary_color: string;
    button_text: string;
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

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const renderOptions = () => (
    <div className="w-full max-w-sm space-y-2 md:space-y-3">
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => onNext(option)}
          className="w-full p-3 md:p-4 text-base md:text-lg font-medium text-white bg-white/10 rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-200 hover:scale-[1.02] flex items-center gap-3 md:gap-4"
        >
          <span
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm font-bold shrink-0"
            style={{ backgroundColor: settings.primary_color }}
          >
            {index + 1}
          </span>
          <span className="text-left">{option}</span>
        </button>
      ))}
      <p className="mt-4 md:mt-6 text-white/40 text-xs md:text-sm text-center">
        Press 1-{options.length} to select
      </p>
    </div>
  );

  if (hasElementOrder) {
    return (
      <div className="w-full max-w-xl text-center px-4">
        <DynamicElementRenderer
          elementOrder={content.element_order || []}
          dynamicElements={content.dynamic_elements || {}}
          content={content}
          settings={settings}
          design={content.design}
          stepType="multi_choice"
          renderOptions={renderOptions}
        />
      </div>
    );
  }

  // Fallback to original rendering
  return (
    <div className="w-full max-w-xl text-center px-4">
      {content.headline && (
        <h2 
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-6 md:mb-8"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {renderOptions()}
    </div>
  );
}
