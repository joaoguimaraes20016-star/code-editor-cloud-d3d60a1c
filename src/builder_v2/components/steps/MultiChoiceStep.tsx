import { cn } from '@/lib/utils';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

const DEFAULT_OPTIONS = [
  { id: 'opt1', label: "I'm ready", emoji: '💪', image: '' },
  { id: 'opt2', label: 'Not yet', emoji: '😴', image: '' },
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

  // Check if any options have images for perspective card layout
  const hasImages = options.some((opt: any) => opt.image);

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
        
        {/* Perspective-style image cards like the inspiration */}
        <div className={cn(
          "step-options",
          hasImages && "step-options--perspective"
        )}>
          {options.map((option: any) => (
            <button
              key={option.id}
              className={cn(
                "step-option",
                hasImages && option.image && "step-option--card"
              )}
              style={{
                backgroundColor: hasImages ? 'transparent' : 'rgba(255,255,255,0.08)',
                borderRadius: `${d.borderRadius}px`,
                color: d.textColor,
              }}
            >
              {/* Image card layout */}
              {hasImages && option.image && (
                <div 
                  className="step-option-image"
                  style={{
                    backgroundImage: `url(${option.image})`,
                    borderRadius: `${d.borderRadius}px ${d.borderRadius}px 0 0`,
                  }}
                />
              )}
              
              {/* Label area with optional emoji */}
              <div className={cn(
                "step-option-content",
                hasImages && option.image && "step-option-content--card"
              )}
              style={hasImages && option.image ? {
                backgroundColor: d.buttonColor || '#f59e0b',
                borderRadius: `0 0 ${d.borderRadius}px ${d.borderRadius}px`,
              } : undefined}
              >
                {option.emoji && !hasImages && (
                  <span className="step-option-emoji">{option.emoji}</span>
                )}
                <span className="step-option-label">{option.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}