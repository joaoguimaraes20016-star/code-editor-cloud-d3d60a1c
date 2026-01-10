// Human-readable labels for all builder types
// This file maps internal developer terminology to user-friendly display text

import { BlockType, ElementType, StepIntent, StepType, SubmitMode } from '@/types/infostack';

// Block type labels
export const blockTypeLabels: Record<BlockType, string> = {
  hero: 'Hero Section',
  'form-field': 'Form Field',
  cta: 'Call to Action',
  testimonial: 'Testimonial',
  feature: 'Feature',
  pricing: 'Pricing',
  faq: 'FAQ',
  media: 'Media',
  'text-block': 'Text Block',
  custom: 'Custom Block',
  'multiple-choice': 'Multiple Choice',
  'single-choice': 'Single Choice',
  quiz: 'Quiz',
  appointment: 'Appointment',
  'file-upload': 'File Upload',
  dropdown: 'Dropdown',
  booking: 'Booking',
  product: 'Product',
  about: 'About',
  team: 'Team',
  trust: 'Trust Badges',
  'logo-bar': 'Logo Bar',
  footer: 'Footer',
};

// Element type labels
export const elementTypeLabels: Record<ElementType, string> = {
  text: 'Text',
  heading: 'Heading',
  button: 'Button',
  input: 'Text Input',
  select: 'Select Menu',
  checkbox: 'Checkbox',
  radio: 'Radio Button',
  image: 'Image',
  video: 'Video',
  divider: 'Divider',
  spacer: 'Spacer',
  icon: 'Icon',
  'multiple-choice': 'Multiple Choice',
  'single-choice': 'Single Choice',
  'quiz-question': 'Quiz Question',
  'date-picker': 'Date Picker',
  dropdown: 'Dropdown',
  'file-upload': 'File Upload',
  'appointment-picker': 'Appointment Picker',
  'message-input': 'Message Input',
  rating: 'Rating',
  slider: 'Slider',
};

// Step intent labels
export const stepIntentLabels: Record<StepIntent, string> = {
  capture: 'Capture Info',
  qualify: 'Qualify Lead',
  schedule: 'Schedule',
  convert: 'Convert',
  complete: 'Complete',
};

// Step intent descriptions
export const stepIntentDescriptions: Record<StepIntent, string> = {
  capture: 'Collect user information like email or phone',
  qualify: 'Ask questions to understand user needs',
  schedule: 'Let users book a time with you',
  convert: 'Handle payment or final conversion',
  complete: 'Show success message and next steps',
};

// Step type labels
export const stepTypeLabels: Record<StepType, string> = {
  form: 'Form',
  content: 'Content',
  quiz: 'Quiz',
  booking: 'Booking',
  checkout: 'Checkout',
  thankyou: 'Thank You',
};

// Submit mode labels
export const submitModeLabels: Record<SubmitMode, string> = {
  next: 'Go to Next Step',
  submit: 'Submit Form',
  redirect: 'Redirect to URL',
  custom: 'Custom Action',
};

// Device mode labels
export const deviceModeLabels = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
} as const;

// Get human-readable label for any block type
export const getBlockTypeLabel = (type: BlockType): string => {
  return blockTypeLabels[type] || formatLabel(type);
};

// Get human-readable label for any element type
export const getElementTypeLabel = (type: ElementType): string => {
  return elementTypeLabels[type] || formatLabel(type);
};

// Get human-readable label for any step intent
export const getStepIntentLabel = (intent: StepIntent): string => {
  return stepIntentLabels[intent] || formatLabel(intent);
};

// Get human-readable label for any step type
export const getStepTypeLabel = (type: StepType): string => {
  return stepTypeLabels[type] || formatLabel(type);
};

// Format any string label (fallback for unknown types)
export const formatLabel = (text: string): string => {
  return text
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Format page name for display (remove slashes, capitalize)
export const formatPageName = (name: string): string => {
  if (!name) return 'Untitled Page';
  
  // Remove leading slashes
  const cleanName = name.replace(/^\/+/, '');
  
  // If empty after cleanup, return Home
  if (!cleanName) return 'Home';
  
  // Format the name
  return formatLabel(cleanName);
};

// Format timestamp to relative time
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString();
};

// Cursor options with labels
export const cursorOptions = [
  { value: 'default', label: 'Default' },
  { value: 'pointer', label: 'Pointer' },
  { value: 'grab', label: 'Grab' },
  { value: 'text', label: 'Text' },
  { value: 'move', label: 'Move' },
  { value: 'not-allowed', label: 'Not Allowed' },
  { value: 'crosshair', label: 'Crosshair' },
];

// Overflow options with labels
export const overflowOptions = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'auto', label: 'Auto' },
];
