/**
 * Page Inspector - shown when no element is selected
 * Displays page-level settings with Framer-style layout
 */

import type { LayoutPersonality, Page } from '../types';
import { getPersonalityOptions } from '../layout/personalityResolver';

export interface PageInspectorProps {
  page: Page;
  onUpdatePersonality: (personality: LayoutPersonality) => void;
}

function PersonalitySelector({
  value,
  onChange,
}: {
  value: LayoutPersonality;
  onChange: (personality: LayoutPersonality) => void;
}) {
  const options = getPersonalityOptions();

  return (
    <div className="builder-segment-control" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`builder-segment${value === option.value ? ' builder-segment--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PageInspector({ page, onUpdatePersonality }: PageInspectorProps) {
  const currentPersonality = page.layoutPersonality ?? 'clean';

  return (
    <div className="builder-inspector">
      <header className="builder-inspector-header">
        <span className="builder-inspector-type">{page.name}</span>
      </header>

      <section className="builder-inspector-section">
        <div className="builder-inspector-section-header builder-inspector-section-header--static">
          <span className="builder-inspector-section-title">Layout</span>
        </div>
        <div className="builder-inspector-section-content">
          <div className="builder-field">
            <label className="builder-field-label">Style</label>
            <PersonalitySelector
              value={currentPersonality}
              onChange={onUpdatePersonality}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
