/**
 * Guided Mode Switcher
 *
 * Phase 33 — Guided Modes & Progressive Disclosure
 *
 * A minimal 3-pill toggle for switching between Build, Refine, and Convert modes.
 * Placed in the canvas header to guide user intent without overwhelming complexity.
 *
 * Design Intent:
 * - Framer/Perspective-style authoring modes
 * - Subtle glow for active mode
 * - No modals, no tooltips required
 * - Instant feel (150-220ms transitions)
 */

import { useCallback } from 'react';
import { guidedModes, type GuidedMode } from '../editorMode';

interface GuidedModeSwitcherProps {
  activeMode: GuidedMode;
  onModeChange: (mode: GuidedMode) => void;
  disabled?: boolean;
}

const modeLabels: Record<GuidedMode, string> = {
  build: 'Build',
  refine: 'Refine',
  convert: 'Convert',
};

export function GuidedModeSwitcher({
  activeMode,
  onModeChange,
  disabled = false,
}: GuidedModeSwitcherProps) {
  const handleModeClick = useCallback(
    (mode: GuidedMode) => {
      if (!disabled && mode !== activeMode) {
        onModeChange(mode);
      }
    },
    [activeMode, onModeChange, disabled],
  );

  return (
    <div
      className="builder-v2-guided-mode-switcher"
      role="tablist"
      aria-label="Editor mode"
    >
      {guidedModes.map((mode) => {
        const isActive = mode === activeMode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={disabled}
            className={`builder-v2-guided-mode-pill${isActive ? ' builder-v2-guided-mode-pill--active' : ''}`}
            onClick={() => handleModeClick(mode)}
            disabled={disabled}
          >
            {modeLabels[mode]}
          </button>
        );
      })}
    </div>
  );
}
