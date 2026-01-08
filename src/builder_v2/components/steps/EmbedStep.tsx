import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

export function EmbedStep({
  content,
  design,
  isSelected,
  onSelect,
}: StepComponentProps) {
  const d = { ...DEFAULT_DESIGN, ...design, ...content.design };
  const fontSize = d.fontSize || 'medium';
  const sizes = FONT_SIZE_MAP[fontSize];
  const embedUrl = content.embed_url;

  const backgroundStyle = d.useGradient && d.gradientFrom && d.gradientTo
    ? { background: `linear-gradient(${d.gradientDirection || 'to bottom'}, ${d.gradientFrom}, ${d.gradientTo})` }
    : { backgroundColor: d.backgroundColor };

  return (
    <div
      className={cn(
        "step-card step-card--embed",
        isSelected && "step-card--selected"
      )}
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        {content.headline && (
          <h2 className={cn("step-headline", sizes.headline)}>
            {content.headline}
          </h2>
        )}
        {content.subtext && (
          <p className={cn("step-subtext", sizes.subtext)}>
            {content.subtext}
          </p>
        )}
        <div
          className="step-embed-container"
          style={{ borderRadius: `${d.borderRadius}px` }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="step-embed-iframe"
              title="Embedded content"
            />
          ) : (
            <div className="step-embed-placeholder">
              <Calendar size={48} strokeWidth={1.5} />
              <span>Add Calendly or embed URL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
