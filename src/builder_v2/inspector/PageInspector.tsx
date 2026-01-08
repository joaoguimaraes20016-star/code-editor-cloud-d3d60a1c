/**
 * Phase 27: Page Inspector Component
 *
 * Displays page-level settings when no node is selected.
 * Includes the layout personality selector.
 *
 * Design principles:
 * - Minimal, calm UI
 * - No tooltips or long descriptions
 * - Instant visual feedback
 * - Seamless with existing inspector aesthetic
 */

import type { LayoutPersonality, Page } from '../types';
import { getPersonalityOptions } from '../layout/personalityResolver';

export interface PageInspectorProps {
  page: Page;
  onUpdatePersonality: (personality: LayoutPersonality) => void;
}

/**
 * Segmented control for personality selection.
 * Clean, horizontal segments with no visual clutter.
 */
function PersonalitySelector({
  value,
  onChange,
}: {
  value: LayoutPersonality;
  onChange: (personality: LayoutPersonality) => void;
}) {
  const options = getPersonalityOptions();

  return (
    <div className="builder-v2-personality-selector" role="radiogroup" aria-label="Layout personality">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`builder-v2-personality-option${value === option.value ? ' builder-v2-personality-option--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Page Inspector - shown when no node is selected.
 * Allows editing page-level properties like layout personality.
 */
export function PageInspector({ page, onUpdatePersonality }: PageInspectorProps) {
  const currentPersonality = page.layoutPersonality ?? 'clean';

  return (
    <div className="builder-v2-inspector">
      <div className="builder-v2-inspector-header">
        <div className="builder-v2-inspector-header-row">
          <h3 className="builder-v2-inspector-title">{page.name}</h3>
        </div>
        <p className="builder-v2-inspector-subtitle">Page settings</p>
      </div>

      <section className="builder-v2-inspector-section">
        <div className="builder-v2-inspector-section-header">
          <p className="builder-v2-inspector-section-title">Layout</p>
        </div>
        <div className="builder-v2-inspector-fields">
          <div className="builder-v2-field">
            <label className="builder-v2-field-label">Personality</label>
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
