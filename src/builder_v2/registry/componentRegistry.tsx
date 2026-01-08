import type { ReactNode } from 'react';

import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Hero } from '../components/Hero';
import { LegacyFunnel } from '../components/LegacyFunnel';
import { Text } from '../components/Text';

// Step components
import {
  WelcomeStep,
  TextQuestionStep,
  MultiChoiceStep,
  EmailCaptureStep,
  PhoneCaptureStep,
  OptInStep,
  VideoStep,
  EmbedStep,
  ThankYouStep,
} from '../components/steps';

import type { ComponentCategory } from '../layout/presenceResolver';
import type { IntentDefaultsContext, IntentDefaultsResult } from './creationHelpers';
import {
  containerIntentDefaults,
  heroIntentDefaults,
  buttonIntentDefaults,
  textIntentDefaults,
} from './creationHelpers';

export type InspectorField = {
  label: string;
  propKey: string;
  inputType: 'text' | 'textarea' | 'color' | 'number';
  optional?: boolean;
};

/**
 * Phase 28: Component Definition
 *
 * Extended with optional intentDefaults for personality-aware creation.
 * intentDefaults is applied ONLY at creation time, never retroactively.
 *
 * Phase 34: Added presenceCategory for presence resolution.
 * presenceCategory determines elevation, surface, and emphasis tokens.
 */
export type ComponentDefinition = {
  type: string;
  displayName: string;
  defaultProps: Record<string, unknown>;
  render: (props: Record<string, unknown>, children: ReactNode[]) => JSX.Element;
  inspectorSchema: InspectorField[];
  constraints: {
    canHaveChildren: boolean;
  };
  /**
   * Phase 34: Presence category for elevation/surface/emphasis resolution.
   * Used by presenceResolver to compute CSS tokens at render time.
   * Defaults to 'body' if not specified.
   */
  presenceCategory?: ComponentCategory;
  /**
   * Phase 28: Intent defaults function.
   *
   * Returns partial props that are merged with defaultProps at creation time.
   * Applied ONLY when the node is created via user action.
   * NEVER applied on paste, hydration, or undo/redo.
   *
   * This encodes design "taste" at creation-time only.
   */
  intentDefaults?: (ctx: IntentDefaultsContext) => IntentDefaultsResult;
};

export const ComponentRegistry: Record<string, ComponentDefinition> = {
  container: {
    type: 'container',
    displayName: 'Container',
    defaultProps: {
      gap: 12,
    },
    render: (props, children) => (
      <Container gap={typeof props.gap === 'number' ? props.gap : undefined}>
        {children}
      </Container>
    ),
    inspectorSchema: [
      {
        label: 'Gap',
        propKey: 'gap',
        inputType: 'number',
        optional: true,
      },
    ],
    constraints: {
      canHaveChildren: true,
    },
    presenceCategory: 'container',
    intentDefaults: containerIntentDefaults,
  },
  text: {
    type: 'text',
    displayName: 'Text',
    defaultProps: {
      text: 'Text',
    },
    render: (props) => (
      <Text text={typeof props.text === 'string' ? props.text : undefined} />
    ),
    inspectorSchema: [
      {
        label: 'Text',
        propKey: 'text',
        inputType: 'textarea',
      },
    ],
    constraints: {
      canHaveChildren: false,
    },
    presenceCategory: 'body',
    intentDefaults: textIntentDefaults,
  },
  button: {
    type: 'button',
    displayName: 'Button',
    defaultProps: {
      label: 'Button',
    },
    render: (props) => (
      <Button label={typeof props.label === 'string' ? props.label : undefined} />
    ),
    inspectorSchema: [
      {
        label: 'Label',
        propKey: 'label',
        inputType: 'text',
      },
    ],
    constraints: {
      canHaveChildren: false,
    },
    presenceCategory: 'button',
    intentDefaults: buttonIntentDefaults,
  },
  hero: {
    type: 'hero',
    displayName: 'Hero',
    defaultProps: {
      headline: 'Hero headline',
      subheadline: 'Hero subheadline',
      backgroundColor: '#1f2937',
    },
    render: (props, children) => (
      <Hero
        headline={typeof props.headline === 'string' ? props.headline : undefined}
        subheadline={
          typeof props.subheadline === 'string' ? props.subheadline : undefined
        }
        backgroundColor={
          typeof props.backgroundColor === 'string'
            ? props.backgroundColor
            : undefined
        }
      >
        {children}
      </Hero>
    ),
    inspectorSchema: [
      {
        label: 'Headline',
        propKey: 'headline',
        inputType: 'text',
      },
      {
        label: 'Subheadline',
        propKey: 'subheadline',
        inputType: 'textarea',
        optional: true,
      },
      {
        label: 'Background color',
        propKey: 'backgroundColor',
        inputType: 'color',
        optional: true,
      },
    ],
    constraints: {
      canHaveChildren: true,
    },
    presenceCategory: 'hero',
    intentDefaults: heroIntentDefaults,
  },
  'legacy-funnel': {
    type: 'legacy-funnel',
    displayName: 'Legacy Funnel',
    defaultProps: {
      funnel: null,
      steps: [],
    },
    render: (props) => (
      <LegacyFunnel
        funnel={props.funnel as any}
        steps={(props.steps as any[]) ?? []}
      />
    ),
    inspectorSchema: [],
    constraints: {
      canHaveChildren: false,
    },
    presenceCategory: 'section',
  },

  // Step Components
  'welcome_step': {
    type: 'welcome_step',
    displayName: 'Welcome',
    defaultProps: {
      headline: 'Welcome! Let\'s get started.',
      subtext: 'We\'re excited to have you here.',
      buttonText: 'Continue',
    },
    render: (props) => (
      <WelcomeStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'hero',
  },
  'text_question_step': {
    type: 'text_question_step',
    displayName: 'Text Question',
    defaultProps: {
      headline: 'Tell us about yourself',
      subtext: 'Your answer helps us personalize your experience.',
      buttonText: 'Continue',
      placeholder: 'Type your answer...',
    },
    render: (props) => (
      <TextQuestionStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
          placeholder: props.placeholder as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text' },
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'multi_choice_step': {
    type: 'multi_choice_step',
    displayName: 'Multi Choice',
    defaultProps: {
      headline: 'Choose an option',
      subtext: 'Select the option that best describes you.',
      options: [
        { id: 'opt1', label: 'Option A', emoji: '✨' },
        { id: 'opt2', label: 'Option B', emoji: '🚀' },
        { id: 'opt3', label: 'Option C', emoji: '💡' },
      ],
    },
    render: (props) => (
      <MultiChoiceStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          options: props.options as any[],
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'email_capture_step': {
    type: 'email_capture_step',
    displayName: 'Email Capture',
    defaultProps: {
      headline: 'Enter your email',
      subtext: 'We\'ll send you important updates.',
      buttonText: 'Continue',
      placeholder: 'you@example.com',
    },
    render: (props) => (
      <EmailCaptureStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
          placeholder: props.placeholder as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text' },
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'phone_capture_step': {
    type: 'phone_capture_step',
    displayName: 'Phone Capture',
    defaultProps: {
      headline: 'Enter your phone number',
      subtext: 'We\'ll text you a confirmation.',
      buttonText: 'Continue',
      placeholder: '(555) 123-4567',
    },
    render: (props) => (
      <PhoneCaptureStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
          placeholder: props.placeholder as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text' },
      { label: 'Placeholder', propKey: 'placeholder', inputType: 'text', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'opt_in_step': {
    type: 'opt_in_step',
    displayName: 'Opt-In Form',
    defaultProps: {
      headline: 'Get instant access',
      subtext: 'Fill out the form below to continue.',
      buttonText: 'Submit',
    },
    render: (props) => (
      <OptInStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'video_step': {
    type: 'video_step',
    displayName: 'Video',
    defaultProps: {
      headline: 'Watch this first',
      subtext: 'This will only take a moment.',
      videoUrl: '',
      buttonText: 'Continue',
    },
    render: (props) => (
      <VideoStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          video_url: props.videoUrl as string,
          button_text: props.buttonText as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Video URL', propKey: 'videoUrl', inputType: 'text' },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'embed_step': {
    type: 'embed_step',
    displayName: 'Embed/Calendar',
    defaultProps: {
      headline: 'Book your call',
      subtext: 'Select a time that works for you.',
      embedUrl: '',
    },
    render: (props) => (
      <EmbedStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          embed_url: props.embedUrl as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Embed URL', propKey: 'embedUrl', inputType: 'text' },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
  'thank_you_step': {
    type: 'thank_you_step',
    displayName: 'Thank You',
    defaultProps: {
      headline: 'Thank you!',
      subtext: 'We\'ll be in touch soon.',
      buttonText: '',
    },
    render: (props) => (
      <ThankYouStep
        content={{
          headline: props.headline as string,
          subtext: props.subtext as string,
          button_text: props.buttonText as string,
        }}
        design={props.design as any}
        isSelected={false}
      />
    ),
    inspectorSchema: [
      { label: 'Headline', propKey: 'headline', inputType: 'text' },
      { label: 'Subtext', propKey: 'subtext', inputType: 'textarea', optional: true },
      { label: 'Button Text', propKey: 'buttonText', inputType: 'text', optional: true },
    ],
    constraints: { canHaveChildren: false },
    presenceCategory: 'section',
  },
};

export const fallbackComponent: ComponentDefinition = {
  type: 'fallback',
  displayName: 'Fallback Container',
  defaultProps: {
    gap: 12,
  },
  render: (_, children) => <Container>{children}</Container>,
  inspectorSchema: [],
  constraints: {
    canHaveChildren: true,
  },
  presenceCategory: 'container',
};
