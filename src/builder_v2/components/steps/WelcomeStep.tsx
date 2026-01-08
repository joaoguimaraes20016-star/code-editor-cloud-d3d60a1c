import { cn } from '@/lib/utils';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

export function WelcomeStep({
  content,
  design,
  isSelected,
  onContentChange,
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
        "step-card step-card--welcome",
        isSelected && "step-card--selected"
      )}
      data-step-type="Welcome"
      style={{
        ...backgroundStyle,
        color: d.textColor,
        fontFamily: d.fontFamily,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        <h2 className={cn("step-headline", sizes.headline)}>
          {content.headline || 'Welcome!'}
        </h2>
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        <button
          className={cn("step-button", sizes.button)}
          style={{
            backgroundColor: d.buttonColor,
            color: d.buttonTextColor,
            borderRadius: `${d.borderRadius}px`,
          }}
        >
          {content.button_text || 'Get Started'}
        </button>
      </div>
    </div>
  );
}
