import { useState, useEffect, useRef } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';
import { Checkbox } from '@/components/ui/checkbox';
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

interface OptInStepProps {
  content: {
    headline?: string;
    subtext?: string;
    name_placeholder?: string;
    email_placeholder?: string;
    phone_placeholder?: string;
    name_icon?: string;
    email_icon?: string;
    phone_icon?: string;
    privacy_text?: string;
    privacy_link?: string;
    is_required?: boolean;
    submit_button_text?: string;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: any;
  };
  settings: {
    primary_color: string;
    button_text: string;
  };
  onNext: (value: { name: string; email: string; phone: string }) => void;
  isActive: boolean;
  termsUrl: string;
  showConsentCheckbox?: boolean;
  consentChecked: boolean;
  consentError: string | null;
  onConsentChange: (checked: boolean) => void;
}

export function OptInStep({
  content,
  settings,
  onNext,
  isActive,
  termsUrl,
  showConsentCheckbox,
  consentChecked,
  consentError,
  onConsentChange,
}: OptInStepProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && nameRef.current) {
      setTimeout(() => nameRef.current?.focus(), 100);
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

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (content.is_required) {
      if (!name.trim()) newErrors.name = 'Name is required';
      if (!email.trim()) newErrors.email = 'Email is required';
      else if (!validateEmail(email)) newErrors.email = 'Invalid email';
      if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
        newErrors.phone = 'Valid phone required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    console.log("[OPTIN_SUBMIT_CLICK]", { consentChecked, showConsentCheckbox, termsUrl });

    onNext({ name, email, phone });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const design = content.design || {};
  const inputBg = design.inputBg || '#ffffff';
  const inputTextColor = design.inputTextColor || '#0a0a0a';
  const inputBorder = design.inputBorder || '#e5e7eb';
  const inputBorderWidth = design.inputBorderWidth ?? 1;
  const inputRadius = design.inputRadius || 12;
  const inputPlaceholderColor = design.inputPlaceholderColor || '#9ca3af';
  const showInputIcon = design.inputShowIcon !== false;

  const buttonColor = design.useButtonGradient && design.buttonGradientFrom
    ? `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom}, ${design.buttonGradientTo || design.buttonGradientFrom})`
    : (design.buttonColor || settings.primary_color);
  const buttonTextColor = design.buttonTextColor || '#ffffff';
  const borderRadius = design.borderRadius || 12;

  // Button hover effect classes
  const buttonHoverClass = design.buttonHoverEffect === 'glow' 
    ? 'hover:shadow-lg hover:shadow-primary/30' 
    : design.buttonHoverEffect === 'lift'
    ? 'hover:-translate-y-1'
    : design.buttonHoverEffect === 'pulse'
    ? 'hover:animate-pulse'
    : '';

  const hasElementOrder = content.element_order && content.element_order.length > 0;

  const renderForm = () => (
    <div className="w-full max-w-sm space-y-4">
      {/* Name Field */}
      <div 
        className="relative flex items-center gap-3 px-4 py-3"
        style={{ 
          backgroundColor: inputBg,
          borderRadius: `${inputRadius}px`,
          border: `${inputBorderWidth}px solid ${errors.name ? '#ef4444' : inputBorder}`
        }}
      >
        {showInputIcon && (
          <span className="text-lg flex-shrink-0">{content.name_icon || '👋'}</span>
        )}
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
          onKeyDown={handleKeyDown}
          placeholder={content.name_placeholder || 'Your name'}
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: inputTextColor }}
        />
      </div>
      {errors.name && <p className="text-red-400 text-xs -mt-2">{errors.name}</p>}

      {/* Email Field */}
      <div 
        className="relative flex items-center gap-3 px-4 py-3"
        style={{ 
          backgroundColor: inputBg,
          borderRadius: `${inputRadius}px`,
          border: `${inputBorderWidth}px solid ${errors.email ? '#ef4444' : inputBorder}`
        }}
      >
        {showInputIcon && (
          <span className="text-lg flex-shrink-0">{content.email_icon || '✉️'}</span>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
          onKeyDown={handleKeyDown}
          placeholder={content.email_placeholder || 'Your email address'}
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: inputTextColor }}
        />
      </div>
      {errors.email && <p className="text-red-400 text-xs -mt-2">{errors.email}</p>}

      {/* Phone Field */}
      <div 
        className="relative flex items-center gap-3 px-4 py-3"
        style={{ 
          backgroundColor: inputBg,
          borderRadius: `${inputRadius}px`,
          border: `${inputBorderWidth}px solid ${errors.phone ? '#ef4444' : inputBorder}`
        }}
      >
        {showInputIcon && (
          <span className="text-lg flex-shrink-0">{content.phone_icon || '🇺🇸'}</span>
        )}
        <span style={{ color: inputPlaceholderColor }} className="text-sm">+1</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(formatPhone(e.target.value)); setErrors(prev => ({ ...prev, phone: '' })); }}
          onKeyDown={handleKeyDown}
          placeholder={content.phone_placeholder || 'Your phone number'}
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: inputTextColor }}
          maxLength={14}
        />
      </div>
      {errors.phone && <p className="text-red-400 text-xs -mt-2">{errors.phone}</p>}

      {/* Privacy Checkbox */}
      {showConsentCheckbox && (
        <div
          id="consent-container"
          className="mt-2 rounded-md px-1 py-1 flex items-start gap-3 cursor-pointer"
          style={{ border: `1px solid ${consentError ? '#ef4444' : 'rgba(148,163,184,0.4)'}` }}
        >
          <Checkbox
            id="funnel-consent"
            checked={consentChecked}
            onCheckedChange={(checked) => onConsentChange?.(checked === true)}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="text-sm text-white/80">
            {content.privacy_text || 'I have read and accept the'}{' '}
            {termsUrl ? (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white hover:text-white/90"
              >
                Privacy Policy
              </a>
            ) : (
              <span className="underline">Privacy Policy</span>
            )}
            .
          </span>
        </div>
      )}
      {consentError && (
        <p
          id="consent-error"
          aria-live="polite"
          className="mt-2 text-sm text-red-400"
        >
          {consentError}
        </p>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        className={`w-full px-6 py-4 text-base font-semibold transition-all duration-200 ${buttonHoverClass}`}
        style={{ 
          background: buttonColor,
          color: buttonTextColor,
          borderRadius: `${borderRadius}px`
        }}
      >
        {content.submit_button_text || 'Submit and proceed'}
      </button>
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
          stepType="opt_in"
          onButtonClick={handleSubmit}
          renderForm={renderForm}
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

      {renderForm()}
    </div>
  );
}
