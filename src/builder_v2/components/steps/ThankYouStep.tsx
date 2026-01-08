import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

export function ThankYouStep({
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

  return (
    <div
      className={cn(
        "step-card step-card--thank-you",
        isSelected && "step-card--selected"
      )}
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content step-content--centered">
        <div className="step-success-icon" style={{ color: d.buttonColor }}>
          <CheckCircle size={64} strokeWidth={1.5} />
        </div>
        <h2 className={cn("step-headline", sizes.headline)}>
          {content.headline || 'Thank you!'}
        </h2>
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        {content.button_text && (
          <button
            className={cn("step-button", sizes.button)}
            style={{
              backgroundColor: d.buttonColor,
              color: d.buttonTextColor,
              borderRadius: `${d.borderRadius}px`,
            }}
          >
            {content.button_text}
          </button>
        )}
      </div>
    </div>
  );
}
