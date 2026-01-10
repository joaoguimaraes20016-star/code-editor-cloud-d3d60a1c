/**
 * Section Templates - Pre-built section blocks for the builder
 * Each template creates a section with pre-configured content
 */

import type { CanvasNode } from '../types';

let sectionIdCounter = 5000;
function genId(prefix: string) {
  sectionIdCounter += 1;
  return `${prefix}-${sectionIdCounter}`;
}

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'hero' | 'content' | 'cta' | 'media' | 'form' | 'social_proof' | 'features';
  icon: string;
  createNode: () => CanvasNode;
}

// ============================================================================
// HERO SECTIONS
// ============================================================================

export const heroSimple: SectionTemplate = {
  id: 'hero-simple',
  name: 'Simple Hero',
  description: 'Headline + subtext',
  category: 'hero',
  icon: 'type',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'hero' },
    children: [
      {
        id: genId('heading'),
        type: 'heading',
        props: { text: 'Your headline here', level: 'h1' },
        children: [],
      },
      {
        id: genId('paragraph'),
        type: 'paragraph',
        props: { text: 'Add a compelling subtext that supports your headline.' },
        children: [],
      },
    ],
  }),
};

export const heroWithButton: SectionTemplate = {
  id: 'hero-button',
  name: 'Hero + CTA',
  description: 'Headline, subtext, and button',
  category: 'hero',
  icon: 'layout',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'hero' },
    children: [
      {
        id: genId('heading'),
        type: 'heading',
        props: { text: 'Your headline here', level: 'h1' },
        children: [],
      },
      {
        id: genId('paragraph'),
        type: 'paragraph',
        props: { text: 'Add a compelling subtext that supports your headline.' },
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
        props: { label: 'Get Started', variant: 'primary', action: 'next' },
        children: [],
      },
    ],
  }),
};

export const heroCardWithImage: SectionTemplate = {
  id: 'hero-card-image',
  name: 'Hero Card + Image',
  description: 'Clean card hero (Framer-style)',
  category: 'hero',
  icon: 'layout',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'hero-card' },
    children: [
      {
        id: genId('card'),
        type: 'content_card',
        props: { backgroundColor: '#ffffff', borderRadius: 20, shadow: true, padding: 0 },
        children: [
          {
            id: genId('header'),
            type: 'header_bar',
            props: { backgroundColor: '#111827' },
            children: [],
          },
          {
            id: genId('body'),
            type: 'section',
            props: { variant: 'content', padding: 28, gap: 14 },
            children: [
              {
                id: genId('heading'),
                type: 'heading',
                props: { text: 'More Success with Less Effort', level: 'h1' },
                children: [],
              },
              {
                id: genId('paragraph'),
                type: 'paragraph',
                props: { text: 'With our tailored solutions, reach your goals faster.' },
                children: [],
              },
              {
                id: genId('spacer'),
                type: 'spacer',
                props: { height: 12 },
                children: [],
              },
              {
                id: genId('button'),
                type: 'cta_button',
                props: { label: 'Learn more', variant: 'primary', fullWidth: false },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }),
};

// ============================================================================
// CONTENT SECTIONS
// ============================================================================

export const contentText: SectionTemplate = {
  id: 'content-text',
  name: 'Text Block',
  description: 'Simple text content',
  category: 'content',
  icon: 'align-left',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'content' },
    children: [
      {
        id: genId('paragraph'),
        type: 'paragraph',
        props: { text: 'Add your content here. This is a simple text section for longer form content.' },
        children: [],
      },
    ],
  }),
};

export const contentHeadingText: SectionTemplate = {
  id: 'content-heading-text',
  name: 'Heading + Text',
  description: 'Section title with text',
  category: 'content',
  icon: 'text',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'content' },
    children: [
      {
        id: genId('heading'),
        type: 'heading',
        props: { text: 'Section Title', level: 'h2' },
        children: [],
      },
      {
        id: genId('paragraph'),
        type: 'paragraph',
        props: { text: 'Add your content here to explain this section in more detail.' },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// CTA SECTIONS
// ============================================================================

export const ctaSimple: SectionTemplate = {
  id: 'cta-simple',
  name: 'Simple CTA',
  description: 'Just a button',
  category: 'cta',
  icon: 'mouse-pointer-click',
  createNode: () => ({
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
  }),
};

export const ctaWithText: SectionTemplate = {
  id: 'cta-text',
  name: 'CTA + Text',
  description: 'Button with supporting text',
  category: 'cta',
  icon: 'square-mouse-pointer',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'cta' },
    children: [
      {
        id: genId('paragraph'),
        type: 'paragraph',
        props: { text: 'Ready to get started? Click below.' },
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
        props: { label: 'Get Started', variant: 'primary', action: 'next' },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// MEDIA SECTIONS
// ============================================================================

export const mediaVideo: SectionTemplate = {
  id: 'media-video',
  name: 'Video',
  description: 'Embedded video player',
  category: 'media',
  icon: 'play',
  createNode: () => ({
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
  }),
};

export const mediaImage: SectionTemplate = {
  id: 'media-image',
  name: 'Image',
  description: 'Full-width image',
  category: 'media',
  icon: 'image',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'media' },
    children: [
      {
        id: genId('image'),
        type: 'image',
        props: { src: '', alt: 'Image description' },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// FORM SECTIONS
// ============================================================================

export const formEmail: SectionTemplate = {
  id: 'form-email',
  name: 'Email Input',
  description: 'Email capture field',
  category: 'form',
  icon: 'mail',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'form' },
    children: [
      {
        id: genId('input'),
        type: 'email_input',
        props: { placeholder: 'Enter your email', fieldName: 'email', required: true },
        children: [],
      },
    ],
  }),
};

export const formPhone: SectionTemplate = {
  id: 'form-phone',
  name: 'Phone Input',
  description: 'Phone number field',
  category: 'form',
  icon: 'phone',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'form' },
    children: [
      {
        id: genId('input'),
        type: 'phone_input',
        props: { placeholder: 'Enter your phone', fieldName: 'phone' },
        children: [],
      },
    ],
  }),
};

export const formFull: SectionTemplate = {
  id: 'form-full',
  name: 'Contact Form',
  description: 'Name, email, phone fields',
  category: 'form',
  icon: 'clipboard-list',
  createNode: () => ({
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
    ],
  }),
};

export const formMultiChoice: SectionTemplate = {
  id: 'form-multi-choice',
  name: 'Multiple Choice',
  description: 'Selection options',
  category: 'form',
  icon: 'list',
  createNode: () => ({
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
  }),
};

export const formCalendar: SectionTemplate = {
  id: 'form-calendar',
  name: 'Calendar Booking',
  description: 'Embedded calendar widget',
  category: 'form',
  icon: 'calendar',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'embed' },
    children: [
      {
        id: genId('calendar'),
        type: 'calendar_embed',
        props: { url: '', placeholder: 'Paste your Calendly or Cal.com link' },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// SOCIAL PROOF SECTIONS
// ============================================================================

export const socialProofBadges: SectionTemplate = {
  id: 'social-badges',
  name: 'Trust Badges',
  description: 'Info cards with icons',
  category: 'social_proof',
  icon: 'shield-check',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'content' },
    children: [
      {
        id: genId('info'),
        type: 'info_card',
        props: {
          items: [
            { icon: '✓', text: '100% Satisfaction Guaranteed' },
            { icon: '🔒', text: 'Your data is secure' },
            { icon: '⚡', text: 'Instant access' },
          ],
        },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// FEATURES SECTIONS
// ============================================================================

export const featuresList: SectionTemplate = {
  id: 'features-list',
  name: 'Features List',
  description: 'Benefits with checkmarks',
  category: 'features',
  icon: 'check-circle',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'content' },
    children: [
      {
        id: genId('heading'),
        type: 'heading',
        props: { text: 'What you get', level: 'h2' },
        children: [],
      },
      {
        id: genId('info'),
        type: 'info_card',
        props: {
          items: [
            { icon: '✓', text: 'Feature one explained here' },
            { icon: '✓', text: 'Feature two explained here' },
            { icon: '✓', text: 'Feature three explained here' },
          ],
        },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// LEGAL / CONSENT SECTIONS
// ============================================================================

export const legalConsent: SectionTemplate = {
  id: 'legal-consent',
  name: 'Privacy Consent',
  description: 'GDPR-compliant consent checkbox',
  category: 'form',
  icon: 'shield-check',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'form' },
    children: [
      {
        id: genId('consent'),
        type: 'consent_checkbox',
        props: {
          label: 'I agree to receive communications and accept the',
          linkText: 'Privacy Policy',
          linkUrl: '/legal/privacy',
          required: true,
          fieldName: 'consent',
        },
        children: [],
      },
    ],
  }),
};

export const legalOptInForm: SectionTemplate = {
  id: 'legal-optin',
  name: 'Opt-In Form',
  description: 'Email + consent + CTA',
  category: 'form',
  icon: 'clipboard-list',
  createNode: () => ({
    id: genId('section'),
    type: 'section',
    props: { variant: 'form' },
    children: [
      {
        id: genId('heading'),
        type: 'heading',
        props: { text: 'Get instant access', level: 'h2' },
        children: [],
      },
      {
        id: genId('input'),
        type: 'email_input',
        props: { placeholder: 'Enter your email', fieldName: 'email', required: true },
        children: [],
      },
      {
        id: genId('consent'),
        type: 'consent_checkbox',
        props: {
          label: 'I agree to receive emails and accept the',
          linkText: 'Privacy Policy',
          linkUrl: '/legal/privacy',
          required: true,
          fieldName: 'consent',
        },
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
        props: { label: 'Get Access Now', variant: 'primary', action: 'submit' },
        children: [],
      },
    ],
  }),
};

// ============================================================================
// EXPORTS
// ============================================================================

export const allSectionTemplates: SectionTemplate[] = [
  // Hero
  heroSimple,
  heroWithButton,
  heroCardWithImage,
  // Content
  contentText,
  contentHeadingText,
  // CTA
  ctaSimple,
  ctaWithText,
  // Media
  mediaVideo,
  mediaImage,
  // Form
  formEmail,
  formPhone,
  formFull,
  formMultiChoice,
  formCalendar,
  legalConsent,
  legalOptInForm,
  // Social Proof
  socialProofBadges,
  // Features
  featuresList,
];

export const sectionTemplatesByCategory = {
  hero: [heroSimple, heroWithButton, heroCardWithImage],
  content: [contentText, contentHeadingText],
  cta: [ctaSimple, ctaWithText],
  media: [mediaVideo, mediaImage],
  form: [formEmail, formPhone, formFull, formMultiChoice, formCalendar, legalConsent, legalOptInForm],
  social_proof: [socialProofBadges],
  features: [featuresList],
};

export const categoryLabels: Record<string, string> = {
  hero: 'Hero Sections',
  content: 'Content',
  cta: 'Call to Action',
  media: 'Media',
  form: 'Forms & Inputs',
  social_proof: 'Social Proof',
  features: 'Features',
};

export const categoryIcons: Record<string, string> = {
  hero: 'layout',
  content: 'type',
  cta: 'mouse-pointer-click',
  media: 'play',
  form: 'clipboard-list',
  social_proof: 'shield-check',
  features: 'check-circle',
};
