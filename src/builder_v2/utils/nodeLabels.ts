/**
 * Centralized node type labels - user-friendly names for all component types
 * Used throughout the editor UI for consistent, clean labels
 */

const NODE_TYPE_LABELS: Record<string, string> = {
  // Layout primitives
  frame: 'Page',
  section: 'Section',
  container: 'Container',
  
  // Typography
  heading: 'Heading',
  paragraph: 'Text',
  text: 'Text',
  
  // Actions
  cta_button: 'Button',
  button: 'Button',
  
  // Media
  image: 'Image',
  image_block: 'Image',
  video_embed: 'Video',
  calendar_embed: 'Calendar',
  
  // Form elements
  email_input: 'Email Input',
  phone_input: 'Phone Input',
  text_input: 'Text Input',
  consent_checkbox: 'Consent',
  
  // Interactive
  option_grid: 'Options',
  
  // Cards & decorative
  info_card: 'Info Card',
  content_card: 'Card',
  header_bar: 'Header',
  
  // Spacing
  spacer: 'Spacer',
  divider: 'Divider',
  
  // Legacy step components
  welcome_step: 'Welcome',
  text_question_step: 'Question',
  multi_choice_step: 'Multi Choice',
  email_capture_step: 'Email Capture',
  phone_capture_step: 'Phone Capture',
  opt_in_step: 'Opt-In',
  video_step: 'Video',
  embed_step: 'Calendar',
  thank_you_step: 'Thank You',
  
  // Hero
  hero: 'Hero',
  
  // Legacy funnel
  'legacy-funnel': 'Legacy Funnel',
};

/**
 * Get a user-friendly label for a node type
 * Falls back to title-casing the type if not found
 */
export function getNodeLabel(type: string): string {
  if (NODE_TYPE_LABELS[type]) {
    return NODE_TYPE_LABELS[type];
  }
  // Fallback: convert snake_case to Title Case
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Check if a node type has a defined label
 */
export function hasNodeLabel(type: string): boolean {
  return type in NODE_TYPE_LABELS;
}
