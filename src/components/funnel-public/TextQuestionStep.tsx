import { useState, useEffect, useRef } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';
import { MessageCircle } from 'lucide-react';

interface StepDesign {
  buttonColor?: string;
  buttonTextColor?: string;
  useButtonGradient?: boolean;
  buttonGradientFrom?: string;
  buttonGradientTo?: string;
  buttonGradientDirection?: string;
  buttonHoverEffect?: 'none' | 'glow' | 'lift' | 'pulse' | 'shine';
  // Input styling
  inputBg?: string;
  inputTextColor?: string;
  inputBorder?: string;
  inputBorderWidth?: number;
  inputRadius?: number;
  inputPlaceholderColor?: string;
  inputFocusBorder?: string;
  inputShowIcon?: boolean;
}

interface TextQuestionStepProps {
  content: {
    headline?: string;
    subtext?: string;
    placeholder?: string;
    is_required?: boolean;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: StepDesign;
    submit_button_text?: string;
  };
  settings: {
    primary_color: string;
    button_text: string;
  };
  onNext: (value: string) => void;
  isActive: boolean;
}

// Button hover effect classes
const BUTTON_HOVER_CLASSES: Record<string, string> = {
  none: '',
  glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]',
  lift: 'hover:-translate-y-1 hover:shadow-xl',
  pulse: 'hover:animate-pulse',
  shine: 'hover:before:translate-x-full overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500',
};

export function TextQuestionStep({ content, settings, onNext, isActive }: TextQuestionStepProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isActive]);

  const handleSubmit = () => {
    if (content.is_required && !value.trim()) return;
    onNext(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = !content.is_required || value.trim().length > 0;
  const design = content.design || {};

  // Input styling
  const inputBg = design.inputBg || '#ffffff';
  const inputTextColor = design.inputTextColor || '#000000';
  const inputBorder = design.inputBorder || '#e5e7eb';
  const inputBorderWidth = design.inputBorderWidth ?? 1;
  const inputRadius = design.inputRadius || 12;
  const inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
  const inputFocusBorder = design.inputFocusBorder || settings.primary_color;
  const showIcon = design.inputShowIcon !== false;

  // Button styling
  const buttonStyle: React.CSSProperties = {};
  if (design.useButtonGradient && design.buttonGradientFrom && design.buttonGradientTo) {
    buttonStyle.background = `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo})`;
  } else {
    buttonStyle.backgroundColor = canSubmit ? (design.buttonColor || settings.primary_color) : 'rgba(255,255,255,0.2)';
  }
  buttonStyle.color = design.buttonTextColor || '#ffffff';

  const buttonHoverClass = BUTTON_HOVER_CLASSES[design.buttonHoverEffect || 'none'] || '';

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const renderInput = () => (
    <div className="w-full max-w-md">
      {/* Styled Textarea Container */}
      <div 
        className="relative flex items-start gap-3 p-4 transition-all duration-200"
        style={{ 
          backgroundColor: inputBg,
          borderRadius: `${inputRadius}px`,
          border: `${inputBorderWidth}px solid ${isFocused ? inputFocusBorder : inputBorder}`,
          boxShadow: isFocused ? `0 0 0 3px ${inputFocusBorder}20` : undefined,
        }}
      >
        {showIcon && (
          <MessageCircle 
            className="w-5 h-5 mt-0.5 flex-shrink-0" 
            style={{ color: inputPlaceholderColor }}
          />
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={content.placeholder || 'Type here'}
          rows={4}
          className="flex-1 resize-none bg-transparent outline-none text-base leading-relaxed"
          style={{ 
            color: inputTextColor,
            caretColor: inputFocusBorder,
          }}
        />
        <style>{`
          textarea::placeholder {
            color: ${inputPlaceholderColor};
          }
        `}</style>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`relative mt-6 w-full px-6 py-4 text-base font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${buttonHoverClass}`}
        style={buttonStyle}
      >
        {content.submit_button_text || 'Submit'}
      </button>

      <p className="mt-4 text-white/40 text-xs text-center">
        Press Enter ↵
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
          stepType="text_question"
          onButtonClick={handleSubmit}
          renderInput={renderInput}
        />
      </div>
    );
  }

  // Fallback to original rendering
  return (
    <div className="w-full max-w-xl text-center px-4">
      {content.headline && (
        <h2 
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {content.subtext && (
        <p 
          className="text-base md:text-lg text-white/70 mb-6 md:mb-8"
          dangerouslySetInnerHTML={{ __html: content.subtext }}
        />
      )}

      {renderInput()}
    </div>
  );
}
