import { cn } from '@/lib/utils';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

const DEFAULT_OPTIONS = [
  { id: 'opt1', label: 'Option A', emoji: '✨' },
  { id: 'opt2', label: 'Option B', emoji: '🚀' },
  { id: 'opt3', label: 'Option C', emoji: '💡' },
];

export function MultiChoiceStep({
  content,
  design,
  isSelected,
  onSelect,
}: StepComponentProps) {
  const d = { ...DEFAULT_DESIGN, ...design, ...content.design };
  const fontSize = d.fontSize || 'medium';
  const sizes = FONT_SIZE_MAP[fontSize];
  const options = content.options?.length ? content.options : DEFAULT_OPTIONS;

  const backgroundStyle = d.useGradient && d.gradientFrom && d.gradientTo
    ? { background: `linear-gradient(${d.gradientDirection || 'to bottom'}, ${d.gradientFrom}, ${d.gradientTo})` }
    : { backgroundColor: d.backgroundColor };

  return (
    <div
      className={cn(
        "step-card step-card--multi_choice",
        isSelected && "step-card--selected"
      )}
      data-step-type="Multi Choice"
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        <h2 className={cn("step-headline", sizes.headline)}>
          {content.headline || 'Choose an option'}
        </h2>
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        <div className="step-options">
          {options.map((option) => (
            <button
              key={option.id}
              className="step-option"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: `${d.borderRadius}px`,
                color: d.textColor,
              }}
            >
              {option.emoji && <span className="step-option-emoji">{option.emoji}</span>}
              <span className="step-option-label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
