import { cn } from '@/lib/utils';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

export function TextQuestionStep({
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
        "step-card step-card--text_question",
        isSelected && "step-card--selected"
      )}
      data-step-type="Question"
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        <h2 className={cn("step-headline", sizes.headline)}>
          {content.headline || 'What is your name?'}
        </h2>
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        <div className="step-input-wrapper">
          <input
            type="text"
            className="step-input"
            placeholder={content.placeholder || 'Type your answer...'}
            style={{
              backgroundColor: d.inputBg || 'rgba(255,255,255,0.1)',
              color: d.inputTextColor || d.textColor,
              borderRadius: `${d.inputRadius || d.borderRadius}px`,
              borderColor: d.inputBorder || 'rgba(255,255,255,0.2)',
            }}
            readOnly
          />
        </div>
        <button
          className={cn("step-button", sizes.button)}
          style={{
            backgroundColor: d.buttonColor,
            color: d.buttonTextColor,
            borderRadius: `${d.borderRadius}px`,
          }}
        >
          {content.button_text || 'Continue'}
        </button>
      </div>
    </div>
  );
}
