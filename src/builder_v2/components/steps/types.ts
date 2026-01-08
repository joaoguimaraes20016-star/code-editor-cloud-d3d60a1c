// Types for step components in Builder V2

export interface StepDesign {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  borderRadius?: number;
  useGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  inputBg?: string;
  inputTextColor?: string;
  inputBorder?: string;
  inputRadius?: number;
}

export interface StepContent {
  headline?: string;
  subtext?: string;
  button_text?: string;
  placeholder?: string;
  video_url?: string;
  embed_url?: string;
  options?: Array<{ id: string; label: string; emoji?: string }>;
  fields?: Array<{ id: string; label: string; type: string; required?: boolean }>;
  element_order?: string[];
  dynamic_elements?: Record<string, any>;
  design?: StepDesign;
  intent?: 'capture' | 'collect' | 'schedule' | 'complete';
}

export interface StepComponentProps {
  content: StepContent;
  design?: StepDesign;
  isSelected?: boolean;
  isEditing?: boolean;
  onContentChange?: (field: string, value: any) => void;
  onSelect?: () => void;
}

export const FONT_SIZE_MAP = {
  small: { headline: 'text-lg', subtext: 'text-xs', button: 'text-sm' },
  medium: { headline: 'text-xl', subtext: 'text-sm', button: 'text-base' },
  large: { headline: 'text-2xl', subtext: 'text-base', button: 'text-lg' },
};

export const DEFAULT_DESIGN: StepDesign = {
  backgroundColor: '#0f0f0f',
  textColor: '#ffffff',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  fontSize: 'medium',
  borderRadius: 12,
};
