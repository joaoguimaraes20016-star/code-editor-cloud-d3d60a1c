import { useState, useEffect, useRef } from 'react';

interface EmailCaptureStepProps {
  content: {
    headline?: string;
    subtext?: string;
    placeholder?: string;
    is_required?: boolean;
  };
  settings: {
    primary_color: string;
  };
  onNext: (value: string) => void;
  isActive: boolean;
}

export function EmailCaptureStep({ content, settings, onNext, isActive }: EmailCaptureStepProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isActive]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = () => {
    if (!value.trim()) {
      if (content.is_required) {
        setError('Email is required');
        return;
      }
      onNext('');
      return;
    }

    if (!validateEmail(value)) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    onNext(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const canSubmit = !content.is_required || (value.trim().length > 0 && validateEmail(value));

  return (
    <div className="w-full max-w-xl text-center">
      {content.headline && (
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {content.headline}
        </h2>
      )}

      {content.subtext && (
        <p className="text-lg text-white/70 mb-8">
          {content.subtext}
        </p>
      )}

      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        onKeyDown={handleKeyDown}
        placeholder={content.placeholder || 'email@example.com'}
        className="w-full bg-transparent border-b-2 border-white/30 focus:border-white text-white text-2xl py-4 text-center outline-none placeholder:text-white/40 transition-colors"
        style={{ caretColor: settings.primary_color }}
      />

      {error && (
        <p className="mt-2 text-red-400 text-sm">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-8 px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: canSubmit ? settings.primary_color : 'rgba(255,255,255,0.2)' }}
      >
        Continue
      </button>

      <p className="mt-4 text-white/40 text-sm">
        Press Enter ↵
      </p>
    </div>
  );
}
