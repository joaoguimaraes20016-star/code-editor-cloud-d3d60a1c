/**
 * Page Templates - Framer/Perspective-style composable templates
 * Each template returns a complete CanvasNode tree (Frame + Sections + Blocks)
 */

import type { CanvasNode } from '../types';

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'welcome' | 'question' | 'capture' | 'booking' | 'thank_you';
  thumbnail?: string;
  createNodes: () => CanvasNode;
}

let templateNodeId = 1000;
function genId(prefix: string) {
  templateNodeId += 1;
  return `${prefix}-${templateNodeId}`;
}

// ============================================================================
// WELCOME TEMPLATES
// ============================================================================

export const welcomeHeroTemplate: PageTemplate = {
  id: 'welcome-hero',
  name: 'Hero + CTA',
  description: 'Clean hero with headline, subtext, and button',
  category: 'welcome',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Welcome' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Welcome! Let\'s get started.', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'We\'re excited to have you here. This will only take a few minutes.' },
            children: [],
          },
          {
            id: genId('spacer'),
            type: 'spacer',
            props: { height: 24 },
            children: [],
          },
          {
            id: genId('button'),
            type: 'cta_button',
            props: { label: 'Continue', variant: 'primary', action: 'next' },
            children: [],
          },
        ],
      },
    ],
  }),
};

export const welcomeVideoTemplate: PageTemplate = {
  id: 'welcome-video',
  name: 'Video + Hero',
  description: 'Introduction video with headline and CTA',
  category: 'welcome',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Welcome' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'content' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Watch this first', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'This short video explains everything you need to know.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'media' },
        children: [
          {
            id: genId('video'),
            type: 'video_embed',
            props: { url: '', placeholder: 'Paste your video URL' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'cta' },
        children: [
          {
            id: genId('button'),
            type: 'cta_button',
            props: { label: 'Continue', variant: 'primary', action: 'next' },
            children: [],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// QUESTION TEMPLATES
// ============================================================================

export const questionTextTemplate: PageTemplate = {
  id: 'question-text',
  name: 'Text Question',
  description: 'Open-ended text input question',
  category: 'question',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Question' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'content' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Tell us about yourself', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'Your answer helps us personalize your experience.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'form' },
        children: [
          {
            id: genId('input'),
            type: 'text_input',
            props: { placeholder: 'Type your answer...', fieldName: 'answer' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'cta' },
        children: [
          {
            id: genId('button'),
            type: 'cta_button',
            props: { label: 'Continue', variant: 'primary', action: 'next' },
            children: [],
          },
        ],
      },
    ],
  }),
};

export const questionChoiceTemplate: PageTemplate = {
  id: 'question-choice',
  name: 'Multiple Choice',
  description: 'Selection from predefined options',
  category: 'question',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Choose Option' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'content' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Choose an option', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'Select the option that best describes you.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'options' },
        children: [
          {
            id: genId('options'),
            type: 'option_grid',
            props: {
              options: [
                { id: 'opt1', label: 'Option A', emoji: '✨' },
                { id: 'opt2', label: 'Option B', emoji: '🚀' },
                { id: 'opt3', label: 'Option C', emoji: '💡' },
              ],
              autoAdvance: true,
            },
            children: [],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// CAPTURE TEMPLATES
// ============================================================================

export const captureEmailTemplate: PageTemplate = {
  id: 'capture-email',
  name: 'Email Capture',
  description: 'Simple email collection form',
  category: 'capture',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Email' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Enter your email', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'We\'ll send you important updates and next steps.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'form' },
        children: [
          {
            id: genId('input'),
            type: 'email_input',
            props: { placeholder: 'you@example.com', fieldName: 'email', required: true },
            children: [],
          },
          {
            id: genId('spacer'),
            type: 'spacer',
            props: { height: 16 },
            children: [],
          },
          {
            id: genId('button'),
            type: 'cta_button',
            props: { label: 'Continue', variant: 'primary', action: 'next' },
            children: [],
          },
        ],
      },
    ],
  }),
};

export const captureOptInTemplate: PageTemplate = {
  id: 'capture-optin',
  name: 'Opt-In Form',
  description: 'Full contact form with name, email, phone',
  category: 'capture',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Opt-In' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Get instant access', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'Fill out the form below to continue.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'form' },
        children: [
          {
            id: genId('input'),
            type: 'text_input',
            props: { placeholder: 'Your name', fieldName: 'name', required: true },
            children: [],
          },
          {
            id: genId('input'),
            type: 'email_input',
            props: { placeholder: 'Email address', fieldName: 'email', required: true },
            children: [],
          },
          {
            id: genId('input'),
            type: 'phone_input',
            props: { placeholder: 'Phone number', fieldName: 'phone' },
            children: [],
          },
          {
            id: genId('spacer'),
            type: 'spacer',
            props: { height: 16 },
            children: [],
          },
          {
            id: genId('button'),
            type: 'cta_button',
            props: { label: 'Submit', variant: 'primary', action: 'submit' },
            children: [],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// BOOKING TEMPLATES
// ============================================================================

export const bookingCalendarTemplate: PageTemplate = {
  id: 'booking-calendar',
  name: 'Calendar Booking',
  description: 'Embedded calendar with headline',
  category: 'booking',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Book Call' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Book your call', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'Select a time that works for you.' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'embed' },
        children: [
          {
            id: genId('embed'),
            type: 'calendar_embed',
            props: { url: '', placeholder: 'Paste your Calendly or Cal.com link' },
            children: [],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// THANK YOU TEMPLATES
// ============================================================================

export const thankYouSimpleTemplate: PageTemplate = {
  id: 'thank-you-simple',
  name: 'Simple Thank You',
  description: 'Clean confirmation message',
  category: 'thank_you',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Thank You' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('icon'),
            type: 'icon',
            props: { name: 'check-circle', size: 64, color: '#22c55e' },
            children: [],
          },
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'Thank you!', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'We\'ve received your information and will be in touch soon.' },
            children: [],
          },
        ],
      },
    ],
  }),
};

export const thankYouNextStepsTemplate: PageTemplate = {
  id: 'thank-you-next-steps',
  name: 'Thank You + Next Steps',
  description: 'Confirmation with follow-up instructions',
  category: 'thank_you',
  createNodes: () => ({
    id: genId('frame'),
    type: 'frame',
    props: { name: 'Thank You' },
    children: [
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'hero' },
        children: [
          {
            id: genId('icon'),
            type: 'icon',
            props: { name: 'check-circle', size: 64, color: '#22c55e' },
            children: [],
          },
          {
            id: genId('heading'),
            type: 'heading',
            props: { text: 'You\'re all set!', level: 'h1' },
            children: [],
          },
          {
            id: genId('paragraph'),
            type: 'paragraph',
            props: { text: 'Here\'s what happens next...' },
            children: [],
          },
        ],
      },
      {
        id: genId('section'),
        type: 'section',
        props: { variant: 'content' },
        children: [
          {
            id: genId('card'),
            type: 'info_card',
            props: {
              items: [
                { icon: '📧', text: 'Check your inbox for a confirmation email' },
                { icon: '📅', text: 'Save the date - we\'ll remind you before your call' },
                { icon: '💡', text: 'Prepare any questions you\'d like to discuss' },
              ],
            },
            children: [],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const PAGE_TEMPLATES: PageTemplate[] = [
  welcomeHeroTemplate,
  welcomeVideoTemplate,
  questionTextTemplate,
  questionChoiceTemplate,
  captureEmailTemplate,
  captureOptInTemplate,
  bookingCalendarTemplate,
  thankYouSimpleTemplate,
  thankYouNextStepsTemplate,
];

export function getTemplateById(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PageTemplate['category']): PageTemplate[] {
  return PAGE_TEMPLATES.filter((t) => t.category === category);
}

// Map step types to template categories
export function getDefaultTemplateForStepType(stepType: string): PageTemplate {
  const categoryMap: Record<string, PageTemplate['category']> = {
    welcome: 'welcome',
    video: 'welcome',
    text_question: 'question',
    multi_choice: 'question',
    email_capture: 'capture',
    phone_capture: 'capture',
    opt_in: 'capture',
    embed: 'booking',
    thank_you: 'thank_you',
  };

  const category = categoryMap[stepType] || 'welcome';
  const templates = getTemplatesByCategory(category);
  return templates[0] || welcomeHeroTemplate;
}
