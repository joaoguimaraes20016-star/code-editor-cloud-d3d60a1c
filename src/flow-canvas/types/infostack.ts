// InfoStack Data Contract - The single source of truth for the builder

export type StepIntent = 'capture' | 'qualify' | 'schedule' | 'convert' | 'complete';
export type StepType = 'form' | 'content' | 'quiz' | 'booking' | 'checkout' | 'thankyou';
export type SubmitMode = 'next' | 'submit' | 'redirect' | 'custom';

export type ElementType = 
  | 'text' 
  | 'heading' 
  | 'button' 
  | 'input' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'image' 
  | 'video' 
  | 'divider'
  | 'spacer'
  | 'icon'
  // Interactive elements
  | 'multiple-choice'
  | 'single-choice'
  | 'quiz-question'
  | 'date-picker'
  | 'dropdown'
  | 'file-upload'
  | 'appointment-picker'
  | 'message-input'
  | 'rating'
  | 'slider';

export type BlockType = 
  | 'hero' 
  | 'form-field' 
  | 'cta' 
  | 'testimonial' 
  | 'feature' 
  | 'pricing' 
  | 'faq'
  | 'media'
  | 'text-block'
  | 'custom'
  // Interactive blocks
  | 'multiple-choice'
  | 'single-choice'
  | 'quiz'
  | 'appointment'
  | 'file-upload'
  | 'dropdown'
  | 'booking'
  // Section templates
  | 'product'
  | 'about'
  | 'team'
  | 'trust'
  | 'logo-bar'
  | 'footer';

// Conditional visibility rule
export interface ConditionalRule {
  field: string;       // Field key of input element
  operator: 'equals' | 'notEquals' | 'contains' | 'notEmpty' | 'isEmpty';
  value: string;       // Expected value
  action: 'show' | 'hide';
}

// Visibility settings for conditional logic
export interface VisibilitySettings {
  conditions: ConditionalRule[];
  logic: 'and' | 'or';
}

// Animation settings for scroll-triggered animations
export interface AnimationSettings {
  effect: string;           // 'fade-in', 'slide-up', etc.
  trigger: 'load' | 'scroll' | 'hover';
  delay: number;            // ms
  duration: number;         // ms
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  threshold: number;        // 0-1, for scroll trigger
}

// State-based styling for Framer-like control
export type ElementState = 'base' | 'hover' | 'active' | 'disabled' | 'focus';

export interface ElementStateStyles {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  opacity?: string;
  transform?: string;
  shadow?: string;
  scale?: string;
}

export interface ElementStyles {
  base: ElementStateStyles;
  hover?: ElementStateStyles;
  active?: ElementStateStyles;
  disabled?: ElementStateStyles;
  focus?: ElementStateStyles;
}

// Responsive styling per device
export type DeviceModeType = 'desktop' | 'tablet' | 'mobile';

// Extended responsive overrides with typography
export interface ResponsiveTypography {
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

export interface ResponsiveOverrides {
  desktop?: Partial<ElementStateStyles> & ResponsiveTypography;
  tablet?: Partial<ElementStateStyles> & ResponsiveTypography;
  mobile?: Partial<ElementStateStyles> & ResponsiveTypography;
}

// Page background settings (Framer-level control)
export interface PageBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
  image?: string;
  blur?: number;
  overlay?: string;
  overlayOpacity?: number;
}

// Block animation with stagger support
export interface BlockAnimationSettings {
  effect: string;
  trigger: 'load' | 'scroll';
  delay: number;
  duration: number;
  stagger?: {
    enabled: boolean;
    delay: number;
  };
}

export interface Element {
  id: string;
  type: ElementType;
  content?: string;
  props: Record<string, unknown>;
  styles?: Record<string, string>;
  visibility?: VisibilitySettings;
  animation?: AnimationSettings;
  stateStyles?: ElementStyles;
  responsive?: ResponsiveOverrides;
}

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  elements: Element[];
  props: Record<string, unknown>;
  styles?: Record<string, string>;
  animation?: BlockAnimationSettings;
}

export interface Stack {
  id: string;
  label: string;
  direction: 'vertical' | 'horizontal';
  blocks: Block[];
  props: Record<string, unknown>;
  styles?: Record<string, string>;
}

export type FrameBackgroundType = 'transparent' | 'white' | 'dark' | 'glass' | 'custom' | 'gradient' | 'image';

export interface Frame {
  id: string;
  label: string;
  stacks: Stack[];
  props: Record<string, unknown>;
  styles?: Record<string, string>;
  // Frame-specific background settings
  background?: FrameBackgroundType;
  backgroundColor?: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
  backgroundImage?: string;
}

export interface Step {
  id: string;
  name: string;
  step_type: StepType;
  step_intent: StepIntent;
  submit_mode: SubmitMode;
  frames: Frame[];
  // Per-step background (overrides page background)
  background?: PageBackground;
  settings: {
    redirect_url?: string;
    validation_rules?: Record<string, unknown>;
  };
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  steps: Step[];
  settings: {
    theme?: 'light' | 'dark';
    font_family?: string;
    primary_color?: string;
    page_background?: PageBackground;
    meta?: {
      title?: string;
      description?: string;
      og_image?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

// Selection state for the builder
export interface SelectionState {
  type: 'page' | 'step' | 'frame' | 'stack' | 'block' | 'element' | null;
  id: string | null;
  path: string[];
}

// Builder props contract
export interface BuilderProps {
  initialState: Page;
  onChange: (updatedState: Page) => void;
  onSelect: (selection: SelectionState) => void;
  onPublish?: (page: Page) => void;
  readOnly?: boolean;
}

// AI Copilot types
export interface AIsuggestion {
  id: string;
  type: 'step' | 'copy' | 'layout' | 'next-action';
  title: string;
  description: string;
  preview?: Partial<Step | Block>;
  confidence: number;
}

export interface AICopilotProps {
  currentPage: Page;
  selection: SelectionState;
  onApplySuggestion: (suggestion: AIsuggestion) => void;
}

// Text styling for inline editor (extended for Framer-level features)
export interface TextStyles {
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  fontFamily?: string;
  textColor?: string;
  textFillType?: 'solid' | 'gradient';
  textGradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
  textShadow?: string;
  highlightColor?: string;
  highlightGradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
  highlightUseGradient?: boolean;
}

// Block action operations
export interface BlockAction {
  type: 'move-up' | 'move-down' | 'duplicate' | 'delete' | 'add-above' | 'add-below';
  blockId: string;
  stackId?: string;
}
