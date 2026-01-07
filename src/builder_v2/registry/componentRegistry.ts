import type { ReactNode } from 'react';

import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Hero } from '../components/Hero';
import { Text } from '../components/Text';

export type InspectorField = {
  label: string;
  propKey: string;
  inputType: 'text' | 'textarea' | 'color' | 'number';
  optional?: boolean;
};

export type ComponentDefinition = {
  type: string;
  displayName: string;
  defaultProps: Record<string, unknown>;
  render: (props: Record<string, unknown>, children: ReactNode[]) => JSX.Element;
  inspectorSchema: InspectorField[];
  constraints: {
    canHaveChildren: boolean;
  };
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
};
