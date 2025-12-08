import { useState, useEffect, useRef } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface PhoneCaptureStepProps {
  content: {
    headline?: string;
    subtext?: string;
    placeholder?: string;
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

export function PhoneCaptureStep({ content, settings, onNext, isActive }: PhoneCaptureStepProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isActive]);

  const formatPhone = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setValue(formatted);
  };

  const handleSubmit = () => {
    const digits = value.replace(/\D/g, '');
    if (content.is_required && digits.length < 10) return;
    onNext(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const digits = value.replace(/\D/g, '');
  const canSubmit = !content.is_required || digits.length >= 10;

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const renderInput = () => (
    <div className="w-full max-w-sm">
      <input
        ref={inputRef}
        type="tel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={content.placeholder || '(555) 123-4567'}
        className="w-full bg-transparent border-b-2 border-white/30 focus:border-white text-white text-xl md:text-2xl py-3 md:py-4 text-center outline-none placeholder:text-white/40 transition-colors"
        style={{ caretColor: settings.primary_color }}
        maxLength={14}
      />

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-6 md:mt-8 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: canSubmit ? settings.primary_color : 'rgba(255,255,255,0.2)' }}
      >
        Continue
      </button>

      <p className="mt-4 text-white/40 text-xs md:text-sm text-center">
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
          stepType="phone_capture"
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
