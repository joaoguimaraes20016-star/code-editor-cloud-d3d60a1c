import { cn } from '@/lib/utils';
import { User, Mail, Phone } from 'lucide-react';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

export function OptInStep({
  content,
  design,
  isSelected,
  onSelect,
}: StepComponentProps) {
  const d = { ...DEFAULT_DESIGN, ...design, ...content.design };
  const fontSize = d.fontSize || 'medium';
  const sizes = FONT_SIZE_MAP[fontSize];

  const backgroundStyle = d.useGradient && d.gradientFrom && d.gradientTo
    ? { background: `linear-gradient(${d.gradientDirection || 'to bottom'}, ${d.gradientFrom}, ${d.gradientTo})` }
    : { backgroundColor: d.backgroundColor };

  const inputStyle = {
    backgroundColor: d.inputBg || 'rgba(255,255,255,0.1)',
    color: d.inputTextColor || d.textColor,
    borderRadius: `${d.inputRadius || d.borderRadius}px`,
    borderColor: d.inputBorder || 'rgba(255,255,255,0.2)',
  };

  return (
    <div
      className={cn(
        "step-card step-card--opt_in",
        isSelected && "step-card--selected"
      )}
      data-step-type="Opt-In Form"
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        <h2 className={cn("step-headline", sizes.headline)}>
          {content.headline || 'Complete your registration'}
        </h2>
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        <div className="step-form">
          <div className="step-input-wrapper">
            <User className="step-input-icon" size={18} />
            <input
              type="text"
              className="step-input step-input--with-icon"
              placeholder="Full Name"
              style={inputStyle}
              readOnly
            />
          </div>
          <div className="step-input-wrapper">
            <Mail className="step-input-icon" size={18} />
            <input
              type="email"
              className="step-input step-input--with-icon"
              placeholder="Email Address"
              style={inputStyle}
              readOnly
            />
          </div>
          <div className="step-input-wrapper">
            <Phone className="step-input-icon" size={18} />
            <input
              type="tel"
              className="step-input step-input--with-icon"
              placeholder="Phone Number"
              style={inputStyle}
              readOnly
            />
          </div>
        </div>
        <button
          className={cn("step-button", sizes.button)}
          style={{
            backgroundColor: d.buttonColor,
            color: d.buttonTextColor,
            borderRadius: `${d.borderRadius}px`,
          }}
        >
          {content.button_text || 'Submit'}
        </button>
      </div>
    </div>
  );
}
