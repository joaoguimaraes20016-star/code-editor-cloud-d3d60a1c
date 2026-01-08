/**
 * Primitive Component Registry
 * Registers all Frame/Section/Block primitives for the V2 canvas
 */

import type { ReactNode } from 'react';
import type { ComponentDefinition } from './componentRegistry';

import {
  Frame,
  Section,
  Heading,
  Paragraph,
  CtaButton,
  Spacer,
  Divider,
  TextInput,
  EmailInput,
  PhoneInput,
  VideoEmbed,
  CalendarEmbed,
  OptionGrid,
  Icon,
  InfoCard,
  ImageBlock,
  ConsentCheckbox,
} from '../components/primitives';

export const PrimitiveRegistry: Record<string, ComponentDefinition> = {
  // ============================================================================
  // LAYOUT PRIMITIVES
  // ============================================================================
  
  frame: {
    type: 'frame',
    displayName: 'Frame',
    defaultProps: { name: 'Frame' },
    render: (props, children) => <Frame name={props.name as string}>{children}</Frame>,
    inspectorSchema: [
      { label: 'Name', propKey: 'name', inputType: 'text' },
    ],
    constraints: { canHaveChildren: true },
    presenceCategory: 'container',
  },

  section: {
    type: 'section',
    displayName: 'Section',
    defaultProps: { variant: 'content' },
    render: (props, children) => (
      <Section variant={props.variant as 'hero' | 'content' | 'form' | 'media' | 'options' | 'cta' | 'embed'}>
        {children}
      </Section>
    ),
    inspectorSchema: [
      { label: 'Variant', propKey: 'variant', inputType: 'text' },
    ],
    constraints: { canHaveChildren: true },
    presenceCategory: 'section',
  },

  // ============================================================================
  // TYPOGRAPHY PRIMITIVES
  // ============================================================================

  heading: {
    type: 'heading',
    displayName: 'Heading',
    defaultProps: { text: 'Heading', level: 'h1' },
    render: (props) => <Heading text={props.text as string} level={props.level as 'h1' | 'h2' | 'h3'} />,
    inspectorSchema: [
      { label: 'Text', propKey: 'text', inputType: 'text' },
      { label: 'Level', propKey: 'level', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'heading',
  },

  paragraph: {
    type: 'paragraph',
    displayName: 'Paragraph',
    defaultProps: { text: 'Paragraph text' },
    render: (props) => <Paragraph text={props.text as string} />,
    inspectorSchema: [
      { label: 'Text', propKey: 'text', inputType: 'textarea' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'body',
  },

  // ============================================================================
  // ACTION PRIMITIVES
  // ============================================================================

  cta_button: {
    type: 'cta_button',
    displayName: 'Button',
    defaultProps: { label: 'Continue', variant: 'primary', action: 'next' },
    render: (props) => (
      <CtaButton 
        label={props.label as string} 
        variant={props.variant as 'primary' | 'secondary' | 'outline'} 
        action={props.action as 'next' | 'submit' | 'link'}
      />
    ),
    inspectorSchema: [
      { label: 'Label', propKey: 'label', inputType: 'text' },
      { label: 'Variant', propKey: 'variant', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'button',
  },

  // ============================================================================
  // SPACING PRIMITIVES
  // ============================================================================

  spacer: {
    type: 'spacer',
    displayName: 'Spacer',
    defaultProps: { height: 24 },
    render: (props) => <Spacer height={props.height as number} />,
    inspectorSchema: [
      { label: 'Height', propKey: 'height', inputType: 'number' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'body',
  },

  divider: {
    type: 'divider',
    displayName: 'Divider',
    defaultProps: {},
    render: () => <Divider />,
    inspectorSchema: [],
    constraints: { canHaveChildren: false },
    presenceCategory: 'body',
  },

  // ============================================================================
  // INPUT PRIMITIVES
  // ============================================================================

  text_input: {
    type: 'text_input',
    displayName: 'Text Input',
    defaultProps: { placeholder: 'Type here...', fieldName: 'text', required: false },
    render: (props) => (
      <TextInput 
        placeholder={props.placeholder as string}
        fieldName={props.fieldName as string}
        required={props.required as boolean}
      />
    ),
    inspectorSchema: [
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text' },
      { label: 'Field Name', propKey: 'fieldName', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'input',
  },

  email_input: {
    type: 'email_input',
    displayName: 'Email Input',
    defaultProps: { placeholder: 'you@example.com', fieldName: 'email', required: true },
    render: (props) => (
      <EmailInput 
        placeholder={props.placeholder as string}
        fieldName={props.fieldName as string}
        required={props.required as boolean}
      />
    ),
    inspectorSchema: [
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'input',
  },

  phone_input: {
    type: 'phone_input',
    displayName: 'Phone Input',
    defaultProps: { placeholder: '(555) 123-4567', fieldName: 'phone' },
    render: (props) => (
      <PhoneInput 
        placeholder={props.placeholder as string}
        fieldName={props.fieldName as string}
      />
    ),
    inspectorSchema: [
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'input',
  },

  // ============================================================================
  // MEDIA PRIMITIVES
  // ============================================================================

  video_embed: {
    type: 'video_embed',
    displayName: 'Video',
    defaultProps: { url: '', placeholder: 'Paste video URL' },
    render: (props) => (
      <VideoEmbed 
        url={props.url as string}
        placeholder={props.placeholder as string}
      />
    ),
    inspectorSchema: [
      { label: 'Video URL', propKey: 'url', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },

  calendar_embed: {
    type: 'calendar_embed',
    displayName: 'Calendar',
    defaultProps: { url: '', placeholder: 'Paste calendar URL' },
    render: (props) => (
      <CalendarEmbed 
        url={props.url as string}
        placeholder={props.placeholder as string}
      />
    ),
    inspectorSchema: [
      { label: 'Calendar URL', propKey: 'url', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },

  image: {
    type: 'image',
    displayName: 'Image',
    defaultProps: { src: '', alt: 'Image' },
    render: (props) => (
      <ImageBlock 
        src={props.src as string}
        alt={props.alt as string}
      />
    ),
    inspectorSchema: [
      { label: 'Image URL', propKey: 'src', inputType: 'text' },
      { label: 'Alt Text', propKey: 'alt', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },

  // ============================================================================
  // INTERACTIVE PRIMITIVES
  // ============================================================================

  option_grid: {
    type: 'option_grid',
    displayName: 'Options',
    defaultProps: {
      options: [
        { id: 'opt1', label: 'Option A', emoji: '✨' },
        { id: 'opt2', label: 'Option B', emoji: '🚀' },
      ],
      autoAdvance: true,
    },
    render: (props) => (
      <OptionGrid 
        options={props.options as Array<{ id: string; label: string; emoji?: string }>}
        autoAdvance={props.autoAdvance as boolean}
      />
    ),
    inspectorSchema: [],
    constraints: { canHaveChildren: false },
    presenceCategory: 'input',
  },

  // ============================================================================
  // DECORATIVE PRIMITIVES
  // ============================================================================

  icon: {
    type: 'icon',
    displayName: 'Icon',
    defaultProps: { name: 'check-circle', size: 48, color: '#22c55e' },
    render: (props) => (
      <Icon 
        name={props.name as string}
        size={props.size as number}
        color={props.color as string}
      />
    ),
    inspectorSchema: [
      { label: 'Icon', propKey: 'name', inputType: 'text' },
      { label: 'Size', propKey: 'size', inputType: 'number' },
      { label: 'Color', propKey: 'color', inputType: 'color' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'body',
  },

  info_card: {
    type: 'info_card',
    displayName: 'Info Card',
    defaultProps: {
      items: [
        { icon: '📧', text: 'Check your inbox' },
        { icon: '📅', text: 'Save the date' },
      ],
    },
    render: (props) => (
      <InfoCard items={props.items as Array<{ icon: string; text: string }>} />
    ),
    inspectorSchema: [],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },

  // ============================================================================
  // CONSENT PRIMITIVES
  // ============================================================================

  consent_checkbox: {
    type: 'consent_checkbox',
    displayName: 'Consent',
    defaultProps: {
      label: 'I agree to receive communications and accept the',
      linkText: 'Privacy Policy',
      linkUrl: '/privacy',
      required: true,
      fieldName: 'consent',
    },
    render: (props) => (
      <ConsentCheckbox 
        label={props.label as string}
        linkText={props.linkText as string}
        linkUrl={props.linkUrl as string}
        required={props.required as boolean}
        fieldName={props.fieldName as string}
      />
    ),
    inspectorSchema: [
      { label: 'Label', propKey: 'label', inputType: 'text' },
      { label: 'Link Text', propKey: 'linkText', inputType: 'text' },
      { label: 'Link URL', propKey: 'linkUrl', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'input',
  },
};
