import { Page, Step, Frame, Stack, Block, Element, SelectionState } from '@/types/infostack';

// Generate unique IDs
export const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
};

// Deep clone utility
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Find node by path
export const findNodeByPath = (
  page: Page,
  path: string[]
): Page | Step | Frame | Stack | Block | Element | null => {
  if (path.length === 0) return page;

  let current: any = page;
  
  for (let i = 0; i < path.length; i += 2) {
    const type = path[i];
    const id = path[i + 1];
    
    if (!id) return current;
    
    switch (type) {
      case 'step':
        current = current.steps?.find((s: Step) => s.id === id);
        break;
      case 'frame':
        current = current.frames?.find((f: Frame) => f.id === id);
        break;
      case 'stack':
        current = current.stacks?.find((s: Stack) => s.id === id);
        break;
      case 'block':
        current = current.blocks?.find((b: Block) => b.id === id);
        break;
      case 'element':
        current = current.elements?.find((e: Element) => e.id === id);
        break;
    }
    
    if (!current) return null;
  }
  
  return current;
};

// Find node by ID anywhere in the page tree (fallback search)
export const findNodeById = (
  page: Page,
  id: string
): { node: Step | Frame | Stack | Block | Element | null; type: string | null } => {
  // Search steps
  for (const step of page.steps) {
    if (step.id === id) return { node: step, type: 'step' };
    
    // Search frames
    for (const frame of step.frames) {
      if (frame.id === id) return { node: frame, type: 'frame' };
      
      // Search stacks
      for (const stack of frame.stacks) {
        if (stack.id === id) return { node: stack, type: 'stack' };
        
        // Search blocks
        for (const block of stack.blocks) {
          if (block.id === id) return { node: block, type: 'block' };
          
          // Search elements
          for (const element of block.elements) {
            if (element.id === id) return { node: element, type: 'element' };
          }
        }
      }
    }
  }
  
  return { node: null, type: null };
};

// Update node immutably with proper deep merge for page settings
export const updateNodeByPath = (
  page: Page,
  path: string[],
  updates: Partial<any>
): Page => {
  const newPage = deepClone(page);
  
  // Special case for page-level updates (empty path)
  if (path.length === 0) {
    // Deep merge settings if present
    if (updates.settings) {
      newPage.settings = {
        ...newPage.settings,
        ...updates.settings,
        // Deep merge nested objects within settings
        meta: {
          ...(newPage.settings?.meta || {}),
          ...(updates.settings.meta || {})
        },
        page_background: updates.settings.page_background 
          ? {
              ...(newPage.settings?.page_background || {}),
              ...updates.settings.page_background
            }
          : newPage.settings?.page_background
      };
      // Remove settings from updates to avoid double-assignment
      const { settings: _, ...restUpdates } = updates;
      Object.assign(newPage, restUpdates);
    } else {
      Object.assign(newPage, updates);
    }
    return newPage;
  }
  
  const node = findNodeByPath(newPage, path);
  if (node) {
    Object.assign(node, updates);
  }
  
  return newPage;
};

// Get selection path from ID
export const getSelectionPath = (page: Page, id: string): string[] => {
  const findPath = (node: any, currentPath: string[] = []): string[] | null => {
    if (node.id === id) return currentPath;
    
    if (node.steps) {
      for (const step of node.steps) {
        const result = findPath(step, [...currentPath, 'step', step.id]);
        if (result) return result;
      }
    }
    
    if (node.frames) {
      for (const frame of node.frames) {
        const result = findPath(frame, [...currentPath, 'frame', frame.id]);
        if (result) return result;
      }
    }
    
    if (node.stacks) {
      for (const stack of node.stacks) {
        const result = findPath(stack, [...currentPath, 'stack', stack.id]);
        if (result) return result;
      }
    }
    
    if (node.blocks) {
      for (const block of node.blocks) {
        const result = findPath(block, [...currentPath, 'block', block.id]);
        if (result) return result;
      }
    }
    
    if (node.elements) {
      for (const element of node.elements) {
        const result = findPath(element, [...currentPath, 'element', element.id]);
        if (result) return result;
      }
    }
    
    return null;
  };
  
  return findPath(page) || [];
};

// Get intent color class
export const getIntentColorClass = (intent: string): string => {
  const colors: Record<string, string> = {
    capture: 'intent-capture',
    qualify: 'intent-qualify',
    schedule: 'intent-schedule',
    convert: 'intent-convert',
    complete: 'intent-complete',
  };
  return colors[intent] || 'intent-capture';
};

// Create default step with Hero + CTA block template
// Create a blank step with no preset content
export const createBlankStep = (name?: string): Step => ({
  id: generateId(),
  name: name || 'Untitled Page',
  step_type: 'form',
  step_intent: 'capture',
  submit_mode: 'next',
  frames: [
    {
      id: generateId(),
      label: 'Section 1',
      stacks: [
        {
          id: generateId(),
          label: 'Content',
          direction: 'vertical',
          blocks: [],
          props: {},
        },
      ],
      props: {},
    },
  ],
  settings: {},
});

export const createDefaultStep = (intent: 'capture' | 'qualify' | 'schedule' | 'convert' | 'complete'): Step => {
  const stepTypes: Record<string, string> = {
    capture: 'form',
    qualify: 'quiz',
    schedule: 'booking',
    convert: 'checkout',
    complete: 'thankyou',
  };

  const stepNames: Record<string, string> = {
    capture: 'Capture Info',
    qualify: 'Qualification',
    schedule: 'Schedule Call',
    convert: 'Checkout',
    complete: 'Thank You',
  };

  // Create a default Hero + CTA block for new steps
  const defaultHeroBlock = {
    id: generateId(),
    type: 'hero' as const,
    label: 'Hero',
    elements: [
      {
        id: generateId(),
        type: 'heading' as const,
        content: intent === 'complete' ? "You're All Set!" : 'Your Compelling Headline',
        props: { level: 1 },
      },
      {
        id: generateId(),
        type: 'text' as const,
        content: intent === 'complete' 
          ? "We'll be in touch shortly with your next steps."
          : 'A powerful subheading that explains your value proposition.',
        props: {},
      },
      {
        id: generateId(),
        type: 'button' as const,
        content: intent === 'complete' ? 'Go Home' : 'Get Started',
        props: { buttonAction: { type: intent === 'complete' ? 'url' : 'next-step', value: intent === 'complete' ? '/' : '' } },
        styles: { backgroundColor: '#8B5CF6' },
      },
    ],
    props: {},
  };

  return {
    id: generateId(),
    name: stepNames[intent],
    step_type: stepTypes[intent] as any,
    step_intent: intent,
    submit_mode: intent === 'complete' ? 'redirect' : 'next',
    frames: [
      {
        id: generateId(),
        label: 'Main Section',
        stacks: [
          {
            id: generateId(),
            label: 'Content Stack',
            direction: 'vertical',
            blocks: [defaultHeroBlock],
            props: {},
          },
        ],
        props: {},
      },
    ],
    settings: {},
  };
};

// Create sample page for demo
export const createSamplePage = (): Page => {
  return {
    id: generateId(),
    name: 'Lead Capture Funnel',
    slug: 'lead-capture',
    steps: [
      {
        id: generateId(),
        name: 'Get Started',
        step_type: 'form',
        step_intent: 'capture',
        submit_mode: 'next',
        frames: [
          {
            id: generateId(),
            label: 'Hero Section',
            stacks: [
              {
                id: generateId(),
                label: 'Hero Stack',
                direction: 'vertical',
                blocks: [
                  {
                    id: generateId(),
                    type: 'hero',
                    label: 'Hero Block',
                    elements: [
                      {
                        id: generateId(),
                        type: 'heading',
                        content: 'Transform Your Business Today',
                        props: { level: 1 },
                      },
                      {
                        id: generateId(),
                        type: 'text',
                        content: 'Join thousands of companies scaling with our platform',
                        props: {},
                      },
                    ],
                    props: {},
                  },
                  {
                    id: generateId(),
                    type: 'form-field',
                    label: 'Email Input',
                    elements: [
                      {
                        id: generateId(),
                        type: 'input',
                        content: '',
                        props: { 
                          placeholder: 'Enter your email',
                          type: 'email',
                          required: true,
                        },
                      },
                    ],
                    props: {},
                  },
                  {
                    id: generateId(),
                    type: 'cta',
                    label: 'Submit Button',
                    elements: [
                      {
                        id: generateId(),
                        type: 'button',
                        content: 'Get Started Free',
                        props: { variant: 'primary' },
                      },
                    ],
                    props: {},
                  },
                ],
                props: {},
              },
            ],
            props: {},
          },
        ],
        settings: {},
      },
      {
        id: generateId(),
        name: 'Qualification',
        step_type: 'quiz',
        step_intent: 'qualify',
        submit_mode: 'next',
        frames: [
          {
            id: generateId(),
            label: 'Quiz Section',
            stacks: [
              {
                id: generateId(),
                label: 'Question Stack',
                direction: 'vertical',
                blocks: [
                  {
                    id: generateId(),
                    type: 'text-block',
                    label: 'Question',
                    elements: [
                      {
                        id: generateId(),
                        type: 'heading',
                        content: 'What best describes your company?',
                        props: { level: 2 },
                      },
                    ],
                    props: {},
                  },
                ],
                props: {},
              },
            ],
            props: {},
          },
        ],
        settings: {},
      },
      {
        id: generateId(),
        name: 'Thank You',
        step_type: 'thankyou',
        step_intent: 'complete',
        submit_mode: 'redirect',
        frames: [
          {
            id: generateId(),
            label: 'Thank You Section',
            stacks: [
              {
                id: generateId(),
                label: 'Message Stack',
                direction: 'vertical',
                blocks: [
                  {
                    id: generateId(),
                    type: 'hero',
                    label: 'Success Message',
                    elements: [
                      {
                        id: generateId(),
                        type: 'heading',
                        content: "You're All Set!",
                        props: { level: 1 },
                      },
                      {
                        id: generateId(),
                        type: 'text',
                        content: "We'll be in touch shortly with your next steps.",
                        props: {},
                      },
                    ],
                    props: {},
                  },
                ],
                props: {},
              },
            ],
            props: {},
          },
        ],
        settings: {
          redirect_url: '/',
        },
      },
    ],
    settings: {
      theme: 'light',
      font_family: 'Inter',
      primary_color: '#00d4ff',
      page_background: {
        type: 'solid',
        color: '#ffffff',
      },
      meta: {
        title: 'Get Started | Your Brand',
        description: 'Sign up and transform your business today.',
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};
