import { useState, useEffect, useRef } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';
import { ChevronDown } from 'lucide-react';

interface CountryOption {
  code: string;
  flag: string;
  name: string;
}

const COUNTRIES: CountryOption[] = [
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
];

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
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isActive]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatPhone = (input: string) => {
    const digits = input.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setValue(formatted);
  };

  const handleSubmit = () => {
    const digits = value.replace(/\D/g, '');
    if (content.is_required && digits.length < 10) return;
    onNext(`${selectedCountry.code} ${value}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const digits = value.replace(/\D/g, '');
  const canSubmit = !content.is_required || digits.length >= 10;
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const design = content.design || {};
  const inputBg = design.inputBg || '#ffffff';
  const inputTextColor = design.inputTextColor || '#0a0a0a';
  const inputBorder = design.inputBorder || '#e5e7eb';
  const inputRadius = design.inputRadius || 12;

  const renderInput = () => (
    <div className="w-full max-w-sm">
      <div 
        className="relative flex items-center gap-2 px-4 py-3"
        style={{ 
          backgroundColor: inputBg,
          borderRadius: `${inputRadius}px`,
          border: `1px solid ${inputBorder}`
        }}
      >
        {/* Country Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 transition-colors"
          >
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-sm" style={{ color: inputTextColor }}>{selectedCountry.code}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[200px] max-h-[250px] overflow-y-auto">
              {COUNTRIES.map((country, idx) => (
                <button
                  key={`${country.code}-${country.flag}-${idx}`}
                  onClick={() => {
                    setSelectedCountry(country);
                    setShowDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors text-left ${
                    selectedCountry.flag === country.flag && selectedCountry.name === country.name
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700'
                  }`}
                >
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                  <span className="text-gray-400 ml-auto">({country.code})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="tel"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={content.placeholder || '(555) 123-4567'}
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: inputTextColor }}
          maxLength={14}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-6 md:mt-8 w-full px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
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
          onButtonClick={handleSubmit}
          renderInput={renderInput}
        />
      </div>
    );
  }

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
