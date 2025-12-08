import { useEffect, useState } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface MultiChoiceStepProps {
  content: {
    headline?: string;
    options?: Array<string | { text: string; emoji?: string }>;
    is_required?: boolean;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: any;
    next_button_text?: string;
    show_next_button?: boolean;
  };
  settings: {
    primary_color: string;
    button_text: string;
  };
  onNext: (value: string) => void;
  isActive: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function MultiChoiceStep({ content, settings, onNext, isActive, currentStep, totalSteps }: MultiChoiceStepProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Normalize options to always have text and optional emoji
  const options = (content.options || []).map(opt => {
    if (typeof opt === 'string') {
      return { text: opt, emoji: undefined };
    }
    return opt;
  });

  const showNextButton = content.show_next_button !== false;
  const nextButtonText = content.next_button_text || 'Next Question';

  useEffect(() => {
    if (isActive) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= options.length) {
          const option = options[num - 1];
          setSelectedOption(option.text);
          // If no next button, auto-advance
          if (!showNextButton) {
            setTimeout(() => onNext(option.text), 300);
          }
        }
        // Enter key to submit when option is selected
        if (e.key === 'Enter' && selectedOption) {
          onNext(selectedOption);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, options, onNext, selectedOption, showNextButton]);

  const handleOptionClick = (optionText: string) => {
    setSelectedOption(optionText);
    // If no next button shown, auto-advance after selection
    if (!showNextButton) {
      setTimeout(() => onNext(optionText), 300);
    }
  };

  const handleNextClick = () => {
    if (selectedOption) {
      onNext(selectedOption);
    }
  };

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const renderOptions = () => (
    <div className="w-full max-w-sm space-y-3">
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => handleOptionClick(option.text)}
          className={`
            w-full p-4 text-left rounded-xl
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/20
            transition-all duration-200 hover:scale-[1.02]
            flex items-center gap-4
            ${selectedOption === option.text ? 'bg-white/15 border-white/30 scale-[1.02]' : ''}
          `}
        >
          {/* Emoji on left */}
          {option.emoji && (
            <span className="text-2xl shrink-0">{option.emoji}</span>
          )}
          
          {/* Text in middle - grows to fill space */}
          <span className="flex-1 text-white font-medium text-base leading-snug">
            {option.text}
          </span>
          
          {/* Radio circle on right */}
          <div className={`
            w-6 h-6 rounded-full border-2 shrink-0
            flex items-center justify-center transition-all
            ${selectedOption === option.text 
              ? 'border-white bg-white' 
              : 'border-white/40'
            }
          `}>
            {selectedOption === option.text && (
              <div className="w-2.5 h-2.5 rounded-full bg-black" />
            )}
          </div>
        </button>
      ))}
      
      {/* Next Question Button - shows after selection */}
      {showNextButton && (
        <button
          onClick={handleNextClick}
          disabled={!selectedOption}
          className={`
            w-full p-4 mt-4 rounded-xl font-semibold text-white text-base
            transition-all duration-300
            ${selectedOption 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-2 pointer-events-none'
            }
          `}
          style={{ 
            background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.primary_color}dd)`,
            boxShadow: selectedOption ? `0 4px 20px ${settings.primary_color}40` : 'none'
          }}
        >
          {nextButtonText}
        </button>
      )}
    </div>
  );

  const renderProgressIndicator = () => {
    if (currentStep && totalSteps) {
      return (
        <p 
          className="text-sm font-semibold mb-6 tracking-wide"
          style={{ color: settings.primary_color }}
        >
          Question {currentStep} of {totalSteps}
        </p>
      );
    }
    return null;
  };

  if (hasElementOrder) {
    return (
      <div className="w-full max-w-xl text-center px-4">
        {renderProgressIndicator()}
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
      {renderProgressIndicator()}
      
      {content.headline && (
        <h2 
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-8"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {renderOptions()}
    </div>
  );
}
