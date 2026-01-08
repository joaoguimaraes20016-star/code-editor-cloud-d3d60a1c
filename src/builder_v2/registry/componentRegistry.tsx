import type { ReactNode } from 'react';

import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Hero } from '../components/Hero';
import { LegacyFunnel } from '../components/LegacyFunnel';
import { Text } from '../components/Text';
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
