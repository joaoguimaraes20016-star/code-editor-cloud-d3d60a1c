/**
 * Layout Suggestions Panel
 *
 * Phase 26 — Suggestion Surfacing & One-Click Taste
 *
 * A collapsible section in the Inspector that surfaces layout suggestions.
 * Renders max 3 suggestions with calm, design-oriented copy.
 *
 * Design Intent:
 * - Suggestions should feel rare, accurate, and respectful
 * - The system should feel like a senior designer offering help
 * - Calm > clever
 * - Taste > automation
 */

import { useState, useCallback } from 'react';

import type { Page } from '../types';
import type { LayoutSuggestion } from '../ai/layoutIntelligence';
import { applySuggestion, getSuggestionTypeLabel, getSuggestionIcon } from '../ai/suggestionApply';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestionsPanelProps {
  suggestions: LayoutSuggestion[];
  page: Page;
  onApply: (nodeId: string, props: Record<string, unknown>) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
}

interface SuggestionItemProps {
  suggestion: LayoutSuggestion;
  page: Page;
  onApply: (nodeId: string, props: Record<string, unknown>) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum suggestions to display at once */
const MAX_SUGGESTIONS = 3;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Individual suggestion item with apply button.
 */
function SuggestionItem({
  suggestion,
  page,
  onApply,
  onHighlightNodes,
}: SuggestionItemProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = useCallback(() => {
    setIsApplying(true);

    // Apply the suggestion
    const result = applySuggestion(page, suggestion);

    if (result.success) {
      // Highlight affected nodes
      onHighlightNodes(result.modifiedNodeIds);

      // Apply each prop change through the editor store
      for (const [nodeId, props] of result.propsChanges) {
        onApply(nodeId, props);
      }
    }

    // Reset applying state after brief delay
    setTimeout(() => setIsApplying(false), 300);
  }, [page, suggestion, onApply, onHighlightNodes]);

  const handleMouseEnter = useCallback(() => {
    // Preview highlight on hover
    onHighlightNodes(suggestion.affectedNodeIds);
  }, [suggestion.affectedNodeIds, onHighlightNodes]);

  const handleMouseLeave = useCallback(() => {
    // Clear preview highlight
    onHighlightNodes([]);
  }, [onHighlightNodes]);

  const typeLabel = getSuggestionTypeLabel(suggestion.type);
  const icon = getSuggestionIcon(suggestion.type);

  return (
    <div
      className="builder-v2-suggestion-item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="builder-v2-suggestion-content">
        <span className="builder-v2-suggestion-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="builder-v2-suggestion-text">
          <span className="builder-v2-suggestion-type">{typeLabel}</span>
          <span className="builder-v2-suggestion-message">{suggestion.message}</span>
        </div>
      </div>
      <button
        type="button"
        className="builder-v2-suggestion-apply"
        onClick={handleApply}
        disabled={isApplying}
        aria-label={`Apply ${typeLabel.toLowerCase()} suggestion`}
      >
        {isApplying ? '...' : 'Apply'}
      </button>
    </div>
  );
}

/**
 * Collapsible suggestions panel.
 * Only renders when suggestions exist.
 */
export function SuggestionsPanel({
  suggestions,
  page,
  onApply,
  onHighlightNodes,
}: SuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no suggestions
  if (suggestions.length === 0) {
    return null;
  }

  // Limit to max suggestions, sorted by confidence
  const visibleSuggestions = [...suggestions]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <section className="builder-v2-suggestions-panel">
      <button
        type="button"
        className="builder-v2-suggestions-header"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls="suggestions-content"
      >
        <div className="builder-v2-suggestions-header-left">
          <span
            className="builder-v2-suggestions-chevron"
            data-expanded={isExpanded}
            aria-hidden="true"
          >
            ›
          </span>
          <span className="builder-v2-suggestions-title">Suggestions</span>
          <span className="builder-v2-suggestions-count">{suggestions.length}</span>
        </div>
      </button>

      {isExpanded && (
        <div
          id="suggestions-content"
          className="builder-v2-suggestions-content"
        >
          {visibleSuggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              page={page}
              onApply={onApply}
              onHighlightNodes={onHighlightNodes}
            />
          ))}
          
          {suggestions.length > MAX_SUGGESTIONS && (
            <p className="builder-v2-suggestions-more">
              +{suggestions.length - MAX_SUGGESTIONS} more
            </p>
          )}
        </div>
      )}
    </section>
  );
}
