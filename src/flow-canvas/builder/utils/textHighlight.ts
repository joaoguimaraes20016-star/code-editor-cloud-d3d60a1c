// ============================================
// INLINE TEXT HIGHLIGHTING - {{text}} syntax
// ============================================

export interface HighlightSegment {
  text: string;
  isHighlighted: boolean;
}

/**
 * Parse text content with {{highlighted}} syntax
 * Returns array of segments with highlight flags
 * 
 * Example:
 * "Join the {{TOP 1%}} of traders" => 
 * [{ text: "Join the ", isHighlighted: false }, { text: "TOP 1%", isHighlighted: true }, { text: " of traders", isHighlighted: false }]
 */
export const parseHighlightedText = (content: string): HighlightSegment[] => {
  if (!content || typeof content !== 'string') {
    return [{ text: content || '', isHighlighted: false }];
  }
  
  const regex = /\{\{([^}]+)\}\}/g;
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before highlight
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isHighlighted: false });
    }
    // Add highlighted text (without the {{ }})
    segments.push({ text: match[1], isHighlighted: true });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last highlight
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isHighlighted: false });
  }

  return segments.length > 0 ? segments : [{ text: content, isHighlighted: false }];
};

/**
 * Check if text contains any highlight syntax
 */
export const hasHighlightSyntax = (content: string): boolean => {
  return /\{\{([^}]+)\}\}/.test(content);
};

/**
 * Wrap text in highlight syntax
 */
export const wrapInHighlight = (text: string): string => {
  return `{{${text}}}`;
};

/**
 * Remove all highlight syntax from text
 */
export const stripHighlightSyntax = (content: string): string => {
  return content.replace(/\{\{([^}]+)\}\}/g, '$1');
};
