import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import { Step, Frame, Stack, Block, Element, SelectionState, Page, VisibilitySettings, AnimationSettings, ElementStateStyles, DeviceModeType, PageBackground } from '../../types/infostack';
import { cn } from '@/lib/utils';
import { Type, Image, Video, Minus, ArrowRight, ArrowUpRight, ChevronRight, Plus, GripVertical, Check, Circle, Play, Eye, Sparkles, Download, Smartphone, MousePointer2, Layout } from 'lucide-react';
import { DeviceMode } from './TopToolbar';
import { BlockActionBar } from './BlockActionBar';
import { ElementActionBar } from './ElementActionBar';
import { AddSectionPopover } from './AddSectionPopover';
import { InlineTextEditor, TextStyles } from './InlineTextEditor';
import { evaluateVisibility } from '../hooks/useScrollAnimation';
import { gradientToCSS, GradientValue } from './modals';
import { BuilderContextMenu } from './ContextMenu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Multi-selection type
interface MultiSelection {
  type: 'element' | 'block';
  ids: Set<string>;
}

// Helper to generate page background styles
const getPageBackgroundStyles = (bg: PageBackground | undefined, isDarkTheme: boolean): React.CSSProperties => {
  // Always return a visible background - never leave blank
  const defaultBg = isDarkTheme ? '#111827' : '#ffffff';
  
  if (!bg || !bg.type) {
    return { backgroundColor: defaultBg };
  }
  
  const styles: React.CSSProperties = {};
  
  switch (bg.type) {
    case 'solid':
      styles.backgroundColor = bg.color || defaultBg;
      break;
    case 'gradient':
      if (bg.gradient && bg.gradient.stops && bg.gradient.stops.length >= 2) {
        styles.background = gradientToCSS(bg.gradient);
      } else {
        // Fallback gradient if none defined
        styles.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }
      break;
    case 'image':
      if (bg.image) {
        styles.backgroundImage = `url(${bg.image})`;
        styles.backgroundSize = 'cover';
        styles.backgroundPosition = 'center';
      } else {
        // Fallback if no image set
        styles.backgroundColor = defaultBg;
      }
      break;
    default:
      styles.backgroundColor = defaultBg;
  }
  
  return styles;
};

// Helper to get overlay styles
const getOverlayStyles = (bg: PageBackground | undefined): React.CSSProperties | null => {
  if (!bg?.overlay || bg.overlay === 'none') return null;
  
  const opacity = (bg.overlayOpacity || 50) / 100;
  
  switch (bg.overlay) {
    case 'dark':
      return { backgroundColor: `rgba(0, 0, 0, ${opacity})` };
    case 'light':
      return { backgroundColor: `rgba(255, 255, 255, ${opacity})` };
    case 'gradient-dark':
      return { background: `linear-gradient(to bottom, transparent, rgba(0, 0, 0, ${opacity}))` };
    case 'gradient-light':
      return { background: `linear-gradient(to bottom, transparent, rgba(255, 255, 255, ${opacity}))` };
    default:
      return null;
  }
};

// Form state context for preview mode
interface FormStateContextValue {
  values: Record<string, string>;
  checkboxValues: Record<string, Set<string>>; // For multi-select checkboxes
  setValue: (key: string, value: string) => void;
  toggleCheckbox: (groupKey: string, value: string) => void;
  isChecked: (groupKey: string, value: string) => boolean;
  isPreviewMode: boolean;
}

const FormStateContext = createContext<FormStateContextValue>({
  values: {},
  checkboxValues: {},
  setValue: () => {},
  toggleCheckbox: () => {},
  isChecked: () => false,
  isPreviewMode: false,
});

interface CanvasRendererProps {
  step: Step | null;
  selection: SelectionState;
  multiSelection?: MultiSelection | null;
  onSelect: (selection: SelectionState, isShiftHeld?: boolean) => void;
  deviceMode: DeviceMode;
  readOnly?: boolean;
  designMode?: 'select' | 'pan';
  onReorderBlocks?: (stackId: string, fromIndex: number, toIndex: number) => void;
  onReorderElements?: (blockId: string, fromIndex: number, toIndex: number) => void;
  onOpenBlockPalette?: () => void;
  onAddBlock?: (block: Block, position?: { stackId: string; index: number }) => void;
  onUpdateElement?: (elementId: string, updates: Partial<Element>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  pageSettings?: Page['settings'];
  replayAnimationKey?: number;
  onNextStep?: () => void;
  onGoToStep?: (stepId: string) => void;
  onFormSubmit?: (values: Record<string, string>) => void;
  showGrid?: boolean;
  onOpenAIGenerate?: () => void;
}

// Button Action type
interface ButtonAction {
  type: 'url' | 'next-step' | 'go-to-step' | 'scroll' | 'submit' | 'download' | 'phone' | 'email';
  value?: string;
  openNewTab?: boolean;
}

// Theme context for passing dark mode state and primary color down
interface ThemeContextValue {
  isDarkTheme: boolean;
  primaryColor: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDarkTheme: false,
  primaryColor: '#8B5CF6',
});

const deviceWidths: Record<DeviceMode, string> = {
  desktop: 'max-w-5xl',
  tablet: 'max-w-2xl',
  mobile: 'max-w-sm',
};

// Effect CSS class mapping - comprehensive mapping for all effect IDs
const effectClasses: Record<string, string> = {
  'fade-in': 'animate-fade-in',
  'slide-up': 'animate-slide-up',
  'slide-down': 'animate-slide-down',
  'slide-left': 'animate-slide-left',
  'slide-right': 'animate-slide-right',
  'bounce': 'animate-bounce',
  'bounce-in': 'effect-bounce-in',
  'pulse': 'animate-pulse',
  'scale': 'animate-scale-in',
  'flip': 'animate-flip-in',
  'flip-in': 'effect-flip-in',
  'rotate': 'animate-rotate-in',
  // Attention effects
  'shake': 'effect-shake',
  'wiggle': 'effect-wiggle',
  'glow': 'effect-glow',
  // Icon effects
  'icon-spin': 'effect-spin',
  'icon-pulse': 'effect-pulse',
  'icon-bounce': 'effect-bounce-in',
  'icon-shake': 'effect-shake',
  'icon-wobble': 'effect-wiggle',
  // Text effects - now with proper CSS classes
  'typewriter': 'effect-typewriter',
  'word-fade': 'effect-word-fade',
  'text-blur': 'effect-blur-in',
  'text-glow': 'effect-glow',
  'text-gradient': 'shimmer',
  'blur-in': 'effect-blur-in',
};

// Convert video URL to embed URL
const getEmbedUrl = (url: string, platform: string): string => {
  if (platform === 'youtube') {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (platform === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  if (platform === 'loom') {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return `https://www.loom.com/embed/${match[1]}`;
  }
  return url;
};

// Sortable Element Renderer with inline editing and hover toolbar
interface SortableElementRendererProps {
  element: Element;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onUpdate?: (updates: Partial<Element>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  readOnly?: boolean;
  replayAnimationKey?: number;
  selectionId?: string | null;
  deviceMode?: DeviceMode;
  onNextStep?: () => void;
  onGoToStep?: (stepId: string) => void;
  onFormSubmit?: (values: Record<string, string>) => void;
}

const SortableElementRenderer: React.FC<SortableElementRendererProps> = ({ 
  element, 
  isSelected,
  isMultiSelected = false,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
  onCopy,
  onPaste,
  canPaste = false,
  readOnly = false,
  replayAnimationKey = 0,
  selectionId,
  deviceMode = 'desktop',
  onNextStep,
  onGoToStep,
  onFormSubmit,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });
  
  // Access form state for conditional visibility and interactive elements
  const { values: formValues, setValue, toggleCheckbox, isChecked, isPreviewMode } = useContext(FormStateContext);
  
  // Access theme context for button colors
  const { isDarkTheme, primaryColor } = useContext(ThemeContext);
  
  // State for hover/active interactions
  const [currentInteractionState, setCurrentInteractionState] = useState<'base' | 'hover' | 'active'>('base');
  
  // Animation replay ref for forcing reflow
  const elementRef = React.useRef<HTMLDivElement>(null);
  
  // Style resolver: merges base → stateStyles → responsive overrides
  const resolveElementStyles = useCallback((): React.CSSProperties => {
    const base: React.CSSProperties = {};
    
    // Apply base styles from element.styles
    if (element.styles?.opacity) base.opacity = element.styles.opacity;
    if (element.styles?.backgroundColor) base.backgroundColor = element.styles.backgroundColor;
    if (element.styles?.borderRadius) base.borderRadius = element.styles.borderRadius;
    if (element.styles?.cursor) base.cursor = element.styles.cursor;
    if (element.styles?.display) base.display = element.styles.display;
    if (element.styles?.overflow) base.overflow = element.styles.overflow;
    
    // Apply state-based overrides (hover, active)
    if (currentInteractionState !== 'base' && element.stateStyles?.[currentInteractionState]) {
      const stateOverrides = element.stateStyles[currentInteractionState];
      if (stateOverrides?.backgroundColor) base.backgroundColor = stateOverrides.backgroundColor;
      if (stateOverrides?.textColor) base.color = stateOverrides.textColor;
      if (stateOverrides?.borderColor) base.borderColor = stateOverrides.borderColor;
      if (stateOverrides?.borderWidth) base.borderWidth = stateOverrides.borderWidth;
      if (stateOverrides?.opacity) base.opacity = stateOverrides.opacity;
      if (stateOverrides?.transform) base.transform = stateOverrides.transform;
      if (stateOverrides?.scale) base.transform = `scale(${stateOverrides.scale})`;
    }
    
    // Apply responsive overrides based on deviceMode
    if (deviceMode !== 'desktop' && element.responsive?.[deviceMode]) {
      const deviceOverrides = element.responsive[deviceMode];
      if (deviceOverrides?.backgroundColor) base.backgroundColor = deviceOverrides.backgroundColor;
      if (deviceOverrides?.textColor) base.color = deviceOverrides.textColor;
      if (deviceOverrides?.borderColor) base.borderColor = deviceOverrides.borderColor;
      if (deviceOverrides?.opacity) base.opacity = deviceOverrides.opacity;
      // Responsive typography
      if (deviceOverrides?.fontSize) {
        const sizeMap: Record<string, string> = { sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' };
        base.fontSize = sizeMap[deviceOverrides.fontSize] || deviceOverrides.fontSize;
      }
      if (deviceOverrides?.lineHeight) base.lineHeight = deviceOverrides.lineHeight;
      if (deviceOverrides?.letterSpacing) {
        const spacingMap: Record<string, string> = { tighter: '-0.05em', tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em' };
        base.letterSpacing = spacingMap[deviceOverrides.letterSpacing] || '0';
      }
    }
    
    return base;
  }, [element.styles, element.stateStyles, element.responsive, currentInteractionState, deviceMode]);
  
  // Evaluate conditional visibility
  const visibility = element.visibility as VisibilitySettings | undefined;
  if (isPreviewMode && visibility?.conditions && visibility.conditions.length > 0) {
    const isVisible = evaluateVisibility(visibility.conditions, visibility.logic || 'and', formValues);
    if (!isVisible) return null;
  }

  const resolvedStyles = resolveElementStyles();
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease, opacity 200ms ease',
    ...resolvedStyles,
  };
  
  // Hover and active handlers for state-based styling
  const stateHandlers = element.stateStyles ? {
    onMouseEnter: () => setCurrentInteractionState('hover'),
    onMouseLeave: () => setCurrentInteractionState('base'),
    onMouseDown: () => setCurrentInteractionState('active'),
    onMouseUp: () => setCurrentInteractionState('hover'),
  } : {};

  // Get effect class - prefer element.animation.effect over legacy element.props.effect
  const animationSettings = element.animation as AnimationSettings | undefined;
  const effectId = animationSettings?.effect || element.props?.effect as string | undefined;
  const effectClass = effectId ? effectClasses[effectId] : '';
  
  // Animation timing styles
  const animationStyle: React.CSSProperties = animationSettings ? {
    animationDelay: `${animationSettings.delay || 0}ms`,
    animationDuration: `${animationSettings.duration || 500}ms`,
    animationTimingFunction: animationSettings.easing || 'ease-out',
  } : {};
  
  // Check for visual indicators
  const hasConditionalLogic = visibility?.conditions && visibility.conditions.length > 0;
  const hasAnimation = !!effectId || !!animationSettings?.effect;
  const hasResponsiveOverrides = element.responsive && (element.responsive.tablet || element.responsive.mobile);
  const hasStateStyles = element.stateStyles && (
    (element.stateStyles.hover && Object.keys(element.stateStyles.hover).length > 0) ||
    (element.stateStyles.active && Object.keys(element.stateStyles.active).length > 0) ||
    (element.stateStyles.disabled && Object.keys(element.stateStyles.disabled).length > 0)
  );
  
  // Replay animation state - re-trigger animation when key changes for this element
  const [animationKey, setAnimationKey] = useState(0);
  useEffect(() => {
    if (replayAnimationKey && replayAnimationKey > 0 && selectionId === element.id) {
      // Force CSS animation restart by removing and re-adding animation
      if (elementRef.current) {
        elementRef.current.style.animation = 'none';
        // Force reflow
        void elementRef.current.offsetHeight;
        elementRef.current.style.animation = '';
      }
      setAnimationKey(prev => prev + 1);
    }
  }, [replayAnimationKey, selectionId, element.id]);

  const baseClasses = cn(
    'builder-selectable rounded-lg transition-all group/element relative',
    isSelected && 'builder-selected',
    isMultiSelected && !isSelected && 'ring-2 ring-builder-accent/50 ring-offset-1 ring-offset-builder-bg',
    isDragging && 'opacity-50 z-50',
    animationKey >= 0 && effectClass // Include key to force re-render
  );
  
  // Helper to render visual indicator badges
  const renderIndicatorBadges = () => {
    if (readOnly || (!hasConditionalLogic && !hasAnimation && !hasResponsiveOverrides && !hasStateStyles)) {
      return null;
    }
    return (
      <div className="absolute -top-2 -right-2 flex gap-0.5 z-10">
        {hasConditionalLogic && (
          <span className="indicator-badge bg-blue-500" title="Has conditional visibility">
            <Eye className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {hasAnimation && (
          <span className="indicator-badge bg-purple-500" title="Has animation">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {hasResponsiveOverrides && (
          <span className="indicator-badge bg-green-500" title="Has responsive overrides">
            <Smartphone className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {hasStateStyles && (
          <span className="indicator-badge bg-orange-500" title="Has state-based styles (hover/active)">
            <MousePointer2 className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
    );
  };
  
  // Button click action handler
  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    if (!isPreviewMode) {
      e.stopPropagation();
      onSelect();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const action = element.props?.buttonAction as ButtonAction | undefined;
    if (!action || !action.type) return;
    
    switch (action.type) {
      case 'url':
        if (action.value) {
          if (action.openNewTab) {
            window.open(action.value, '_blank');
          } else {
            window.location.href = action.value;
          }
        }
        break;
      case 'next-step':
        onNextStep?.();
        break;
      case 'go-to-step':
        if (action.value) {
          onGoToStep?.(action.value);
        }
        break;
      case 'scroll':
        if (action.value) {
          document.querySelector(action.value)?.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'phone':
        if (action.value) {
          window.location.href = `tel:${action.value}`;
        }
        break;
      case 'email':
        if (action.value) {
          window.location.href = `mailto:${action.value}`;
        }
        break;
      case 'download':
        if (action.value) {
          window.open(action.value, '_blank');
        }
        break;
      case 'submit':
        onFormSubmit?.(formValues);
        break;
    }
  }, [isPreviewMode, element.props?.buttonAction, onSelect, onNextStep, onGoToStep, onFormSubmit, formValues]);

  // Handle content + styles from InlineTextEditor
  // Only update properties that are explicitly provided (not undefined)
  const handleContentChange = useCallback((newContent: string, textStyles?: Partial<TextStyles>) => {
    if (textStyles && Object.keys(textStyles).length > 0) {
      // Only update properties that are explicitly provided
      const propsUpdate: Record<string, unknown> = { ...element.props };
      if (textStyles.fontSize !== undefined) propsUpdate.fontSize = textStyles.fontSize;
      if (textStyles.fontWeight !== undefined) propsUpdate.fontWeight = textStyles.fontWeight;
      if (textStyles.fontStyle !== undefined) propsUpdate.fontStyle = textStyles.fontStyle;
      if (textStyles.textDecoration !== undefined) propsUpdate.textDecoration = textStyles.textDecoration;
      if (textStyles.textAlign !== undefined) propsUpdate.textAlign = textStyles.textAlign;
      // Add missing text style properties
      if (textStyles.fontFamily !== undefined) propsUpdate.fontFamily = textStyles.fontFamily;
      if (textStyles.textColor !== undefined) propsUpdate.textColor = textStyles.textColor;
      if (textStyles.textFillType !== undefined) propsUpdate.textFillType = textStyles.textFillType;
      if (textStyles.textGradient !== undefined) propsUpdate.textGradient = textStyles.textGradient;
      if (textStyles.textShadow !== undefined) propsUpdate.textShadow = textStyles.textShadow;
      
      onUpdate?.({ 
        content: newContent,
        props: propsUpdate
      });
    } else {
      onUpdate?.({ content: newContent });
    }
  }, [onUpdate, element.props]);

  const renderElement = () => {
    // Use theme values from context (accessed in component body above)
    
    // Helper function to get typography styles
    const getTypographyStyles = () => {
      const styles: React.CSSProperties = {};
      
      // Font family (override)
      if (element.props?.fontFamily && element.props.fontFamily !== 'inherit') {
        styles.fontFamily = element.props.fontFamily as string;
      }
      
      // Font size
      const fontSize = element.props?.fontSize as string;
      if (fontSize) {
        const sizeMap: Record<string, string> = { sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' };
        styles.fontSize = sizeMap[fontSize] || fontSize;
      }
      
      // Font weight
      const fontWeight = element.props?.fontWeight as string;
      if (fontWeight) {
        const weightMap: Record<string, number> = { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 };
        styles.fontWeight = weightMap[fontWeight] || 400;
      }
      
      // Text color - only apply if not using gradient fill
      if (element.props?.textColor && element.props?.textFillType !== 'gradient') {
        styles.color = element.props.textColor as string;
      }
      
      // Text gradient - DO NOT apply here, let InlineTextEditor handle it
      // This prevents gradient from filling the parent container instead of the text
      
      // Text shadow
      const textShadow = element.props?.textShadow as string;
      if (textShadow && textShadow !== 'none') {
        const shadowMap: Record<string, string> = {
          subtle: '0 1px 2px rgba(0, 0, 0, 0.15)',
          medium: '0 2px 4px rgba(0, 0, 0, 0.25)',
          strong: '0 4px 8px rgba(0, 0, 0, 0.4)',
          glow: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3), 0 0 30px rgba(255, 255, 255, 0.2)',
          neon: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 20px currentColor',
          depth: '0 1px 0 rgba(0, 0, 0, 0.1), 0 2px 0 rgba(0, 0, 0, 0.08), 0 3px 0 rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.15)',
        };
        styles.textShadow = shadowMap[textShadow];
      }
      
      // Text alignment
      if (element.props?.textAlign) {
        styles.textAlign = element.props.textAlign as 'left' | 'center' | 'right';
      }
      
      // Line height
      if (element.props?.lineHeight) {
        styles.lineHeight = element.props.lineHeight as string;
      }
      
      // Letter spacing
      const letterSpacing = element.props?.letterSpacing as string;
      if (letterSpacing) {
        const spacingMap: Record<string, string> = { tighter: '-0.05em', tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em' };
        styles.letterSpacing = spacingMap[letterSpacing] || '0';
      }
      
      // Text transform
      const textTransform = element.props?.textTransform as string;
      if (textTransform && textTransform !== 'none') {
        styles.textTransform = textTransform as 'uppercase' | 'lowercase' | 'capitalize';
      }
      
      // Font style
      if (element.props?.fontStyle === 'italic') {
        styles.fontStyle = 'italic';
      }
      
      // Text decoration
      if (element.props?.textDecoration === 'underline') {
        styles.textDecoration = 'underline';
      }
      
      return styles;
    };
    
    // Helper to get shadow class or style
    const getShadowClass = () => {
      const shadow = element.props?.shadow as string;
      if (!shadow || shadow === 'none') return '';
      const shadowMap: Record<string, string> = {
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
        glow: 'btn-shadow-glow',
        neon: 'btn-shadow-neon'
      };
      return shadowMap[shadow] || '';
    };
    
    // Helper to get button shadow style with custom glow color
    const getButtonShadowStyle = (): React.CSSProperties => {
      const shadow = element.props?.shadow as string;
      const glowColor = element.props?.glowColor as string;
      
      if (!shadow || shadow === 'none') return {};
      
      // If using glow/neon and custom glow color, set CSS variable
      if ((shadow === 'glow' || shadow === 'neon') && glowColor) {
        // Convert hex to rgba for glow
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        
        if (shadow === 'glow') {
          return {
            boxShadow: `0 0 15px ${hexToRgba(glowColor, 0.5)}, 0 4px 15px -3px rgba(0, 0, 0, 0.2)`
          };
        } else if (shadow === 'neon') {
          return {
            boxShadow: `0 0 5px ${hexToRgba(glowColor, 0.6)}, 0 0 15px ${hexToRgba(glowColor, 0.4)}, 0 0 30px ${hexToRgba(glowColor, 0.2)}`
          };
        }
      }
      
      return {};
    };
    
    // Helper for hover effects on non-button elements
    const getHoverHandlers = () => {
      const hoverScale = element.props?.hoverScale as string;
      const hoverOpacity = element.props?.hoverOpacity as string;
      const transitionDuration = element.props?.transitionDuration as string || '200';
      
      if (!hoverScale && !hoverOpacity) return {};
      
      return {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
          const target = e.currentTarget;
          target.style.transition = `all ${transitionDuration}ms ease`;
          if (hoverScale && hoverScale !== 'none') target.style.transform = `scale(${hoverScale})`;
          if (hoverOpacity) target.style.opacity = hoverOpacity;
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
          const target = e.currentTarget;
          target.style.transform = 'scale(1)';
          target.style.opacity = '1';
        }
      };
    };
    
    // Get layout styles
    const getLayoutStyles = (): React.CSSProperties => {
      const styles: React.CSSProperties = {};
      
      const width = element.props?.width as string;
      if (width === 'full') styles.width = '100%';
      else if (width === '1/2') styles.width = '50%';
      else if (width === '1/3') styles.width = '33.333%';
      else if (width === '2/3') styles.width = '66.666%';
      
      if (element.styles?.margin) styles.margin = element.styles.margin;
      if (element.styles?.padding) styles.padding = element.styles.padding;
      if (element.styles?.borderWidth) styles.borderWidth = element.styles.borderWidth;
      if (element.styles?.borderColor) styles.borderColor = element.styles.borderColor;
      if (element.styles?.borderWidth && !element.styles?.borderStyle) styles.borderStyle = 'solid';
      
      return styles;
    };
    
    const typographyStyles = getTypographyStyles();
    const layoutStyles = getLayoutStyles();
    const shadowClass = getShadowClass();
    const hoverHandlers = getHoverHandlers();
    
    switch (element.type) {
      case 'heading':
        const level = (element.props?.level as number) || 1;
        const defaultHeadingClasses = {
          1: 'text-4xl font-bold tracking-tight',
          2: 'text-3xl font-semibold',
          3: 'text-2xl font-semibold',
          4: 'text-xl font-medium',
        }[level] || 'text-xl font-medium';
        
        // Only use default classes if no custom typography is set
        // Check properly - 'normal' fontWeight should NOT count as custom
        const hasCustomFontSize = !!element.props?.fontSize;
        const hasCustomFontWeight = element.props?.fontWeight && element.props.fontWeight !== 'normal';
        const hasCustomTypography = hasCustomFontSize || hasCustomFontWeight;
        
        // Link wrapper props
        const headingLinkUrl = element.props?.linkUrl as string;
        const headingLinkNewTab = element.props?.linkNewTab as boolean;
        const headingLinkUnderline = element.props?.linkUnderline as string || 'hover';
        
        // Layout-only styles for wrapper - NO typography (handled by InlineTextEditor)
        const headingWrapperStyles: React.CSSProperties = {
          textAlign: typographyStyles.textAlign,
        };
        
        const headingContent = (
          <div 
            className={cn(
              !hasCustomTypography && defaultHeadingClasses, 
              'px-3 py-2', 
              !(element.props?.textColor || element.props?.textFillType === 'gradient') && (isDarkTheme ? 'text-white' : 'text-gray-900'),
              headingLinkUrl && headingLinkUnderline === 'always' && 'underline',
              headingLinkUrl && headingLinkUnderline === 'hover' && 'hover:underline',
              headingLinkUrl && 'cursor-pointer'
            )} 
            style={headingWrapperStyles}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          >
            <InlineTextEditor
              value={element.content || ''}
              onChange={handleContentChange}
              elementType="heading"
              placeholder="Add heading..."
              disabled={readOnly}
              initialStyles={{
                fontSize: element.props?.fontSize as TextStyles['fontSize'],
                fontWeight: element.props?.fontWeight as TextStyles['fontWeight'],
                fontStyle: element.props?.fontStyle as TextStyles['fontStyle'],
                textDecoration: element.props?.textDecoration as TextStyles['textDecoration'],
                textAlign: element.props?.textAlign as TextStyles['textAlign'],
                fontFamily: element.props?.fontFamily as string,
                textColor: element.props?.textColor as string,
                textFillType: element.props?.textFillType as 'solid' | 'gradient',
                textGradient: element.props?.textGradient as GradientValue | undefined,
                textShadow: element.props?.textShadow as string,
                highlightColor: element.props?.highlightColor as string,
                highlightGradient: element.props?.highlightGradient as GradientValue | undefined,
                highlightUseGradient: element.props?.highlightUseGradient as boolean,
              }}
            />
          </div>
        );
        
        return (
          <div 
            ref={setNodeRef} 
            style={{ ...style, ...layoutStyles }} 
            className={cn(baseClasses, 'relative', shadowClass)}
            {...hoverHandlers}
          >
            {/* Element type badge */}
            <span className="element-type-badge">Heading {level}</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="heading"
                currentAlign={element.props?.textAlign as 'left' | 'center' | 'right' | undefined}
                currentColor={element.props?.textColor as string || typographyStyles.color as string}
                onAlignChange={(align) => onUpdate?.({ props: { ...element.props, textAlign: align } })}
                onColorChange={(color) => onUpdate?.({ props: { ...element.props, textColor: color, textFillType: 'solid' } })}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            {headingLinkUrl ? (
              <a 
                href={headingLinkUrl} 
                target={headingLinkNewTab ? '_blank' : undefined}
                rel={headingLinkNewTab ? 'noopener noreferrer' : undefined}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              >
                {headingContent}
              </a>
            ) : (
              headingContent
            )}
          </div>
        );

      case 'text':
        const hasTextTypography = element.props?.fontSize || element.props?.fontWeight;
        
        // Link wrapper props for text
        const textLinkUrl = element.props?.linkUrl as string;
        const textLinkNewTab = element.props?.linkNewTab as boolean;
        const textLinkUnderline = element.props?.linkUnderline as string || 'hover';
        
        // Layout-only styles for wrapper - NO typography (handled by InlineTextEditor)
        const textWrapperStyles: React.CSSProperties = {
          textAlign: typographyStyles.textAlign,
        };
        
        const textContent = (
          <div 
            className={cn(
              !hasTextTypography && "text-base leading-relaxed", 
              "px-3 py-2", 
              !(element.props?.textColor || element.props?.textFillType === 'gradient') && (isDarkTheme ? 'text-gray-300' : 'text-gray-600'),
              textLinkUrl && textLinkUnderline === 'always' && 'underline',
              textLinkUrl && textLinkUnderline === 'hover' && 'hover:underline',
              textLinkUrl && 'cursor-pointer'
            )} 
            style={textWrapperStyles}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          >
            <InlineTextEditor
              value={element.content || ''}
              onChange={handleContentChange}
              elementType="text"
              placeholder="Add text..."
              disabled={readOnly}
              initialStyles={{
                fontSize: element.props?.fontSize as TextStyles['fontSize'],
                fontWeight: element.props?.fontWeight as TextStyles['fontWeight'],
                fontStyle: element.props?.fontStyle as TextStyles['fontStyle'],
                textDecoration: element.props?.textDecoration as TextStyles['textDecoration'],
                textAlign: element.props?.textAlign as TextStyles['textAlign'],
                fontFamily: element.props?.fontFamily as string,
                textColor: element.props?.textColor as string,
                textFillType: element.props?.textFillType as 'solid' | 'gradient',
                textGradient: element.props?.textGradient as GradientValue | undefined,
                textShadow: element.props?.textShadow as string,
                highlightColor: element.props?.highlightColor as string,
                highlightGradient: element.props?.highlightGradient as GradientValue | undefined,
                highlightUseGradient: element.props?.highlightUseGradient as boolean,
              }}
            />
          </div>
        );
        
        return (
          <div 
            ref={setNodeRef} 
            style={{ ...style, ...layoutStyles }} 
            className={cn(baseClasses, 'relative', shadowClass)}
            {...hoverHandlers}
          >
            {/* Element type badge */}
            <span className="element-type-badge">Text</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="text"
                currentAlign={element.props?.textAlign as 'left' | 'center' | 'right' | undefined}
                currentColor={element.props?.textColor as string || typographyStyles.color as string}
                onAlignChange={(align) => onUpdate?.({ props: { ...element.props, textAlign: align } })}
                onColorChange={(color) => onUpdate?.({ props: { ...element.props, textColor: color, textFillType: 'solid' } })}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            {textLinkUrl ? (
              <a 
                href={textLinkUrl} 
                target={textLinkNewTab ? '_blank' : undefined}
                rel={textLinkNewTab ? 'noopener noreferrer' : undefined}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              >
                {textContent}
              </a>
            ) : (
              textContent
            )}
          </div>
        );

      case 'button':
        const hoverBg = element.props?.hoverBg as string;
        const hoverScale = element.props?.hoverScale as string;
        const transitionDuration = element.props?.transitionDuration as string || '200';
        const buttonSize = element.props?.buttonSize as string || 'md';
        const buttonSizeClasses: Record<string, string> = {
          sm: 'px-4 py-2 text-sm',
          md: 'px-6 py-3 text-base',
          lg: 'px-8 py-4 text-lg',
          xl: 'px-10 py-5 text-xl'
        };
        const buttonFontWeight = element.props?.fontWeight as string || 'semibold';
        const buttonWeightClass: Record<string, string> = {
          normal: 'font-normal',
          medium: 'font-medium',
          semibold: 'font-semibold',
          bold: 'font-bold'
        };
        
        // Determine button background - gradient takes precedence
        // Use direct color fallback instead of CSS variable to avoid white button issue
        // Handle empty string properly - trim and check for truthy value
        const isGradient = element.props?.fillType === 'gradient';
        const elementBg = element.styles?.backgroundColor?.trim();
        const buttonBg = isGradient 
          ? undefined 
          : (elementBg && elementBg !== '' ? elementBg : primaryColor);
        const buttonGradient = isGradient 
          ? (element.styles?.background as string || 'linear-gradient(135deg, #8B5CF6, #D946EF)')
          : undefined;
        
        // Determine wrapper styles for alignment using textAlign
        const buttonAlignment = element.styles?.textAlign as 'left' | 'center' | 'right' | undefined;
        const wrapperStyle: React.CSSProperties = {
          ...style,
          ...layoutStyles,
          // Use flexbox for reliable alignment
          display: 'flex',
          width: '100%',
          justifyContent: buttonAlignment === 'center' ? 'center' : 
                          buttonAlignment === 'right' ? 'flex-end' : 'flex-start',
        };
        
        // Custom button styles - ensure visible background
        const effectiveBg = buttonBg || '#8B5CF6'; // Guarantee a visible color
        const buttonShadowStyle = getButtonShadowStyle();
        const defaultShadow = isDarkTheme ? '0 10px 25px -5px rgba(0,0,0,0.5)' : '0 10px 25px -5px rgba(0,0,0,0.2)';
        const customButtonStyle: React.CSSProperties = {
          backgroundColor: buttonGradient ? undefined : effectiveBg,
          background: buttonGradient,
          color: element.props?.textColor as string || '#ffffff',
          boxShadow: buttonShadowStyle.boxShadow || defaultShadow,
          borderWidth: element.styles?.borderWidth,
          borderColor: element.styles?.borderColor,
          borderStyle: element.styles?.borderWidth ? 'solid' : undefined,
          borderRadius: element.styles?.borderRadius || '12px',
          transition: `transform ${transitionDuration}ms ease, box-shadow ${transitionDuration}ms ease`,
          // Apply custom dimensions
          width: element.styles?.width || undefined,
          height: element.styles?.height || undefined,
          padding: element.styles?.padding || undefined,
        };
        
        // Only apply size class if no custom padding
        const useSizeClass = !element.styles?.padding;
        
        return (
          <div ref={setNodeRef} style={wrapperStyle} className={cn(baseClasses, 'relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Button</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="button"
                currentAlign={buttonAlignment}
                currentColor={effectiveBg}
                onAlignChange={(align) => onUpdate?.({ styles: { ...element.styles, textAlign: align } })}
                onColorChange={(color) => onUpdate?.({ styles: { ...element.styles, backgroundColor: color } })}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <style>{(() => {
              const css: string[] = [];
              const cls = `btn-${element.id}`;
              if (hoverBg && !isGradient) {
                css.push(`.${cls}:hover { background-color: ${hoverBg}; }`);
              }
              if (hoverScale && hoverScale !== 'none') {
                css.push(`.${cls}:hover { transform: scale(${hoverScale}); }`);
              }
              return css.join('\n');
            })()}</style>
            <button
              className={cn(
                `btn-${element.id}`,
                useSizeClass && buttonSizeClasses[buttonSize],
                buttonWeightClass[buttonFontWeight],
                "rounded-xl inline-flex items-center justify-center gap-2 shadow-lg",
                shadowClass
              )}
              style={{
                ...customButtonStyle,
                transition: `transform ${transitionDuration}ms ease, box-shadow ${transitionDuration}ms ease, background-color ${transitionDuration}ms ease`,
              }}
              onClick={handleButtonClick}
            >
              {element.props?.showIcon !== false && element.props?.iconPosition === 'left' && renderButtonIcon()}
              <InlineTextEditor
                value={element.content || 'Get started'}
                onChange={handleContentChange}
                elementType="button"
                disabled={readOnly}
                className="text-inherit"
              />
              {element.props?.showIcon !== false && element.props?.iconPosition !== 'left' && renderButtonIcon()}
            </button>
          </div>
        );
        
        // Helper to render button icon based on iconType prop
        function renderButtonIcon() {
          const iconType = element.props?.iconType as string || 'arrow-right';
          const iconClass = "w-4 h-4";
          switch (iconType) {
            case 'arrow-up-right': return <ArrowUpRight className={iconClass} />;
            case 'chevron-right': return <ChevronRight className={iconClass} />;
            case 'plus': return <Plus className={iconClass} />;
            case 'check': return <Check className={iconClass} />;
            case 'download': return <Download className={iconClass} />;
            default: return <ArrowRight className={iconClass} />;
          }
        }

      case 'input':
        const fieldKey = element.props?.fieldKey as string || element.id;
        const inputValue = isPreviewMode ? (formValues[fieldKey] || '') : '';
        
        // Input styling props
        const inputIsGradient = element.props?.fillType === 'gradient';
        const inputBg = inputIsGradient 
          ? undefined 
          : (element.styles?.backgroundColor || (isDarkTheme ? '#1f2937' : '#ffffff'));
        const inputGradient = inputIsGradient 
          ? (element.styles?.background as string || 'linear-gradient(135deg, #8B5CF6, #D946EF)')
          : undefined;
        const inputTextColor = element.props?.textColor as string || (isDarkTheme ? '#ffffff' : '#1f2937');
        const inputPlaceholderColor = element.props?.placeholderColor as string || (isDarkTheme ? '#6b7280' : '#9ca3af');
        const inputBorderColor = element.styles?.borderColor || (isDarkTheme ? '#374151' : '#e5e7eb');
        const inputBorderRadius = element.styles?.borderRadius || '12px';
        const inputBorderWidth = element.styles?.borderWidth || '1px';
        const inputPadding = element.styles?.padding || '16px 20px';
        const inputWidth = element.styles?.width || '100%';
        const inputMargin = element.styles?.margin || '';
        
        // Determine alignment from margin
        const inputAlign = inputMargin === '0 auto' ? 'center' : 
                          inputMargin === '0 0 0 auto' ? 'right' : 'left';
        
        const inputCustomStyle: React.CSSProperties = {
          backgroundColor: inputGradient ? undefined : inputBg,
          background: inputGradient,
          color: inputTextColor,
          borderColor: inputBorderColor,
          borderWidth: inputBorderWidth,
          borderStyle: 'solid',
          borderRadius: inputBorderRadius,
          padding: inputPadding,
          width: inputWidth,
          margin: inputMargin,
          display: 'block',
        };
        
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Input</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="input"
                currentAlign={inputAlign}
                currentColor={inputBg as string}
                onAlignChange={(align) => {
                  const margin = align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '';
                  onUpdate?.({ styles: { ...element.styles, margin, display: 'block' } });
                }}
                onColorChange={(color) => onUpdate?.({ styles: { ...element.styles, backgroundColor: color } })}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <div onClick={(e) => { if (!isPreviewMode) { e.stopPropagation(); onSelect(); } }}>
              {/* Dynamic CSS for placeholder, focus, and hover states */}
              <style>{`
                .input-${element.id}::placeholder {
                  color: ${inputPlaceholderColor};
                }
                .input-${element.id}:focus {
                  background-color: ${element.props?.focusBg as string || inputBg || 'transparent'};
                  border-color: ${element.props?.focusBorderColor as string || '#3b82f6'};
                  outline: none;
                  box-shadow: 0 0 0 3px ${(element.props?.focusBorderColor as string || '#3b82f6')}20;
                }
                .input-${element.id}:hover:not(:focus) {
                  background-color: ${element.props?.hoverBg as string || inputBg || 'transparent'};
                }
              `}</style>
              <input
                type={(element.props?.type as string) || 'text'}
                placeholder={(element.props?.placeholder as string) || 'Enter text...'}
                className={cn(`input-${element.id}`)}
                style={{
                  ...inputCustomStyle,
                  transition: `all ${element.props?.transitionDuration || 200}ms ease`,
                }}
                readOnly={!isPreviewMode}
                value={inputValue}
                onChange={(e) => {
                  if (isPreviewMode) {
                    setValue(fieldKey, e.target.value);
                  }
                }}
                onClick={(e) => {
                  if (isPreviewMode) e.stopPropagation();
                }}
              />
            </div>
          </div>
        );

      case 'checkbox': {
        // Get checkbox group key and value for form state
        const checkboxGroupKey = (element.props?.name as string) || (element.props?.fieldKey as string) || 'checkbox_group';
        const checkboxValue = element.content || element.id;
        const checkboxIsSelected = isChecked(checkboxGroupKey, checkboxValue);
        
        const handleCheckboxClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isPreviewMode) {
            toggleCheckbox(checkboxGroupKey, checkboxValue);
          } else {
            onSelect();
          }
        };
        
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            {!isPreviewMode && <span className="element-type-badge">Checkbox</span>}
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="checkbox"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            {!readOnly && (
              <div 
                {...attributes}
                {...listeners}
                className={cn(
                  "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                  isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
                )}
              >
                <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
              </div>
            )}
            <label 
              className={cn(
                "flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all",
                checkboxIsSelected 
                  ? "border-primary bg-primary/10" 
                  : isDarkTheme 
                    ? "border-gray-700 hover:border-gray-600" 
                    : "border-gray-200 hover:border-gray-300"
              )} 
              onClick={handleCheckboxClick}
            >
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                checkboxIsSelected 
                  ? "border-primary bg-primary" 
                  : isDarkTheme ? "border-gray-600" : "border-gray-300"
              )}>
                <Check className={cn("w-3 h-3 transition-colors", checkboxIsSelected ? "text-white" : "text-transparent")} />
              </div>
              {isPreviewMode ? (
                <span className={isDarkTheme ? "text-gray-300" : "text-gray-700"}>{element.content || 'Option'}</span>
              ) : (
                <InlineTextEditor
                  value={element.content || 'Option'}
                  onChange={handleContentChange}
                  elementType="text"
                  placeholder="Option label..."
                  disabled={readOnly}
                  className={isDarkTheme ? "text-gray-300" : "text-gray-700"}
                />
              )}
            </label>
          </div>
        );
      }

      case 'radio': {
        // Get radio group key and value for form state
        const radioGroupKey = (element.props?.name as string) || (element.props?.fieldKey as string) || 'radio_group';
        const radioValue = element.content || element.id;
        const radioIsSelected = formValues[radioGroupKey] === radioValue;
        
        const handleRadioClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isPreviewMode) {
            setValue(radioGroupKey, radioValue);
          } else {
            onSelect();
          }
        };
        
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            {!isPreviewMode && <span className="element-type-badge">Radio</span>}
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="radio"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            {!readOnly && (
              <div 
                {...attributes}
                {...listeners}
                className={cn(
                  "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                  isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
                )}
              >
                <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
              </div>
            )}
            <label 
              className={cn(
                "flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all",
                radioIsSelected 
                  ? "border-primary bg-primary/10" 
                  : isDarkTheme 
                    ? "border-gray-700 hover:border-gray-600" 
                    : "border-gray-200 hover:border-gray-300"
              )} 
              onClick={handleRadioClick}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                radioIsSelected 
                  ? "border-primary" 
                  : isDarkTheme ? "border-gray-600" : "border-gray-300"
              )}>
                <Circle className={cn(
                  "w-2.5 h-2.5 transition-all",
                  radioIsSelected ? "text-primary fill-primary" : "text-transparent fill-transparent"
                )} />
              </div>
              {isPreviewMode ? (
                <span className={isDarkTheme ? "text-gray-300" : "text-gray-700"}>{element.content || 'Option'}</span>
              ) : (
                <InlineTextEditor
                  value={element.content || 'Option'}
                  onChange={handleContentChange}
                  elementType="text"
                  placeholder="Option label..."
                  disabled={readOnly}
                  className={isDarkTheme ? "text-gray-300" : "text-gray-700"}
                />
              )}
            </label>
          </div>
        );
      }

      case 'select':
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Select</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="select"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <div onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <select
                className={cn(
                  "w-full px-5 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer",
                  isDarkTheme 
                    ? "border-gray-700 text-white bg-gray-800" 
                    : "border-gray-200 text-gray-900 bg-white"
                )}
                disabled
              >
                <option>{(element.props?.placeholder as string) || 'Select an option...'}</option>
              </select>
            </div>
          </div>
        );

      case 'image':
        const imgSrc = element.props?.src as string;
        const imageStyles: React.CSSProperties = {
          width: element.styles?.width || '100%',
          height: element.styles?.height || 'auto',
          maxWidth: element.styles?.maxWidth || 'none',
          borderRadius: element.styles?.borderRadius || '12px',
          objectFit: (element.props?.objectFit as React.CSSProperties['objectFit']) || 'cover',
        };
        const imageWrapperStyles: React.CSSProperties = {
          ...style,
          display: element.styles?.display || 'block',
          margin: element.styles?.margin || undefined,
          width: element.styles?.margin === '0 auto' || element.styles?.margin === '0 0 0 auto' ? 'fit-content' : undefined,
        };
        
        // Drag-and-drop image upload handlers
        const handleImageDragOver = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
        };
        
        const handleImageDrop = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onUpdate?.({ props: { ...element.props, src: base64 } });
              };
              reader.readAsDataURL(file);
            }
          }
        };
        
        return (
          <div 
            ref={setNodeRef} 
            style={imageWrapperStyles} 
            className={cn(baseClasses, 'relative')}
            onDragOver={handleImageDragOver}
            onDrop={handleImageDrop}
          >
            {/* Element type badge */}
            <span className="element-type-badge">Image</span>
            {/* Visual indicator badges */}
            {renderIndicatorBadges()}
            {/* Hover Action Bar for quick editing */}
            {!readOnly && (
              <ElementActionBar
                elementId={element.id}
                elementType="image"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDarkTheme={isDarkTheme}
              />
            )}
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            {imgSrc ? (
              <img 
                src={imgSrc} 
                alt={(element.props?.alt as string) || ''} 
                style={imageStyles}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              />
            ) : (
              <div 
                className={cn(
                  "aspect-video rounded-xl flex flex-col items-center justify-center border-2 border-dashed transition-colors",
                  isDarkTheme ? "bg-gray-800 border-gray-600 hover:border-gray-500" : "bg-gray-100 border-gray-300 hover:border-gray-400"
                )}
                style={{ width: element.styles?.width || '100%' }}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              >
                <Image className={cn("w-10 h-10 mb-2", isDarkTheme ? "text-gray-600" : "text-gray-300")} />
                <span className={cn("text-xs", isDarkTheme ? "text-gray-500" : "text-gray-400")}>
                  Drop image here
                </span>
              </div>
            )}
          </div>
        );

      case 'video':
        const videoSettings = element.props?.videoSettings as { url?: string; platform?: string; autoplay?: boolean; muted?: boolean } | undefined;
        const videoUrl = videoSettings?.url;
        const videoPlatform = videoSettings?.platform || 'youtube';
        const videoContainerStyles: React.CSSProperties = {
          width: element.styles?.width || '100%',
          height: element.styles?.height || 'auto',
          aspectRatio: element.styles?.aspectRatio || '16/9',
          borderRadius: element.styles?.borderRadius || '12px',
          overflow: 'hidden',
        };
        const videoWrapperStyles: React.CSSProperties = {
          ...style,
          display: element.styles?.display || 'block',
          margin: element.styles?.margin || undefined,
          width: element.styles?.margin === '0 auto' || element.styles?.margin === '0 0 0 auto' ? 'fit-content' : undefined,
        };
        
        return (
          <div ref={setNodeRef} style={videoWrapperStyles} className={cn(baseClasses, 'relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Video</span>
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            {videoUrl ? (
              <div style={videoContainerStyles} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
                <iframe
                  src={getEmbedUrl(videoUrl, videoPlatform)}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div 
                className="bg-gray-900 flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors" 
                style={videoContainerStyles}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              >
                <div className="text-center">
                  <Play className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <span className="text-xs text-gray-500">Click to add video</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'divider':
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Divider</span>
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <div className="w-full py-6" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <div className={cn("w-full h-px", isDarkTheme ? "bg-gray-700" : "bg-gray-200")} />
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'w-full relative')}>
            {/* Element type badge */}
            <span className="element-type-badge">Spacer</span>
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <div className="w-full h-12 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <Minus className={cn("w-4 h-4", isDarkTheme ? "text-gray-600" : "text-gray-300")} />
            </div>
          </div>
        );

      default:
        return (
          <div ref={setNodeRef} style={style} className={cn(baseClasses, 'relative')}>
            <div 
              {...attributes}
              {...listeners}
              className={cn(
                "absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/element:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded shadow-sm border",
                isDarkTheme ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
              )}
            >
              <GripVertical className={cn("w-3 h-3", isDarkTheme ? "text-gray-500" : "text-gray-400")} />
            </div>
            <div 
              className={cn(
                "px-4 py-3 rounded-xl border",
                isDarkTheme ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
              )} 
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
            >
              <span className={cn("text-sm", isDarkTheme ? "text-gray-400" : "text-gray-500")}>{element.type}</span>
            </div>
          </div>
        );
    }
  };

  return renderElement();
};

// Element Drag Overlay
const ElementDragOverlay: React.FC<{ element: Element }> = ({ element }) => (
  <div className="px-4 py-2 rounded-lg bg-white shadow-xl border-2 border-builder-accent opacity-90">
    <div className="text-sm font-medium text-gray-900">{element.type}</div>
    {element.content && (
      <div className="text-xs text-gray-500 truncate max-w-[200px]">{element.content}</div>
    )}
  </div>
);

// Sortable Block Renderer with Element DnD and Action Bar
interface SortableBlockRendererProps {
  block: Block;
  blockIndex: number;
  totalBlocks: number;
  selection: SelectionState;
  multiSelectedIds?: Set<string>;
  onSelect: (selection: SelectionState, isShiftHeld?: boolean) => void;
  path: string[];
  onReorderElements?: (blockId: string, fromIndex: number, toIndex: number) => void;
  onMoveBlock?: (direction: 'up' | 'down') => void;
  onDuplicateBlock?: () => void;
  onDeleteBlock?: () => void;
  onAddBlock?: (position: 'above' | 'below') => void;
  onUpdateElement?: (elementId: string, updates: Partial<Element>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  readOnly?: boolean;
  replayAnimationKey?: number;
  deviceMode?: DeviceMode;
  onNextStep?: () => void;
  onGoToStep?: (stepId: string) => void;
  onFormSubmit?: (values: Record<string, string>) => void;
}

const SortableBlockRenderer: React.FC<SortableBlockRendererProps> = ({ 
  block, 
  blockIndex,
  totalBlocks,
  selection,
  multiSelectedIds,
  onSelect, 
  path,
  onReorderElements,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onAddBlock,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onCopy,
  onPaste,
  canPaste = false,
  readOnly = false,
  replayAnimationKey = 0,
  deviceMode = 'desktop',
  onNextStep,
  onGoToStep,
  onFormSubmit,
}) => {
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const isSelected = selection.type === 'block' && selection.id === block.id;
  const isMultiSelected = multiSelectedIds?.has(block.id) ?? false;
  const blockPath = [...path, 'block', block.id];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // Helper to get block shadow classes
  const getBlockShadowClass = () => {
    const shadow = block.props?.shadow as string;
    if (!shadow || shadow === 'none') return '';
    const shadowMap: Record<string, string> = {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
      '2xl': 'shadow-2xl',
      inner: 'block-shadow-inner',
      glow: 'block-shadow-glow',
      neon: 'block-shadow-neon',
    };
    return shadowMap[shadow] || '';
  };

  // Helper to get block shadow inline style for custom glow color
  const getBlockShadowStyle = (): React.CSSProperties => {
    const shadow = block.props?.shadow as string;
    const glowColor = block.props?.glowColor as string;
    
    if (!shadow || shadow === 'none') return {};
    
    if ((shadow === 'glow' || shadow === 'neon') && glowColor) {
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      
      if (shadow === 'glow') {
        return {
          boxShadow: `0 0 30px -5px ${hexToRgba(glowColor, 0.4)}`
        };
      } else if (shadow === 'neon') {
        return {
          boxShadow: `0 0 10px ${hexToRgba(glowColor, 0.5)}, 0 0 30px ${hexToRgba(glowColor, 0.3)}`
        };
      }
    }
    
    return {};
  };

  const blockShadowClass = getBlockShadowClass();
  const blockShadowStyle = getBlockShadowStyle();

  // Build backdrop filter style for glassmorphism
  const backdropBlur = block.styles?.backdropBlur as string;
  const backdropStyle: React.CSSProperties = backdropBlur && backdropBlur !== '0' && backdropBlur !== '0px'
    ? { backdropFilter: `blur(${backdropBlur})`, WebkitBackdropFilter: `blur(${backdropBlur})` }
    : {};

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Apply block styles
    backgroundColor: block.styles?.backgroundColor,
    background: block.styles?.background,
    padding: block.styles?.padding,
    gap: block.styles?.gap,
    borderRadius: block.styles?.borderRadius,
    // Apply block shadow
    ...blockShadowStyle,
    // Apply backdrop blur
    ...backdropStyle,
  };

  const elementSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleElementDragStart = (event: DragStartEvent) => {
    setActiveElementId(event.active.id as string);
  };

  const handleElementDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveElementId(null);

    if (over && active.id !== over.id && onReorderElements) {
      const oldIndex = block.elements.findIndex((el) => el.id === active.id);
      const newIndex = block.elements.findIndex((el) => el.id === over.id);
      onReorderElements(block.id, oldIndex, newIndex);
    }
  };

  const activeElement = activeElementId 
    ? block.elements.find(el => el.id === activeElementId) 
    : null;

  // Import block type label helper
  const blockTypeLabel = block.label || block.type.charAt(0).toUpperCase() + block.type.slice(1).replace(/-/g, ' ');
  
  // Check if gradient border is enabled
  const hasGradientBorder = block.props?.gradientBorder === true;
  const borderGradient = block.props?.borderGradient as { type: 'linear' | 'radial'; angle: number; stops: Array<{ color: string; position: number }> } | undefined;

  const blockInnerContent = (
    <div
      ref={!hasGradientBorder ? setNodeRef : undefined}
      style={{
        ...style,
        display: 'flex',
        flexDirection: (block.props?.direction as 'row' | 'column') || 'column',
        justifyContent: block.props?.justifyContent as string || 'flex-start',
        alignItems: block.props?.alignItems as string || 'stretch',
        flexWrap: block.props?.wrap ? 'wrap' : 'nowrap',
        gap: block.props?.gap as string || block.styles?.gap || undefined,
      }}
      className={cn(
        'builder-selectable rounded-xl transition-all group relative',
        !block.styles?.padding && 'p-6',
        isSelected && 'builder-selected',
        isMultiSelected && !isSelected && 'ring-2 ring-builder-accent/50 ring-offset-1 ring-offset-builder-bg',
        block.type === 'hero' && 'text-center py-12',
        block.type === 'cta' && 'justify-center',
        isDragging && 'opacity-50 z-50',
        blockShadowClass
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'block', id: block.id, path: blockPath }, e.shiftKey);
      }}
    >
      {/* Block Type Badge - Shows on hover */}
      <span className="block-type-badge">{blockTypeLabel}</span>
      
      {/* Block Action Bar - with integrated drag handle */}
      {!readOnly && (
        <BlockActionBar
          blockId={block.id}
          blockLabel={block.label}
          position="left"
          canMoveUp={blockIndex > 0}
          canMoveDown={blockIndex < totalBlocks - 1}
          onMoveUp={() => onMoveBlock?.('up')}
          onMoveDown={() => onMoveBlock?.('down')}
          onDuplicate={() => onDuplicateBlock?.()}
          onDelete={() => onDeleteBlock?.()}
          onAddAbove={() => onAddBlock?.('above')}
          onAddBelow={() => onAddBlock?.('below')}
          dragHandleProps={{ attributes, listeners }}
        />
      )}

      <DndContext
        sensors={elementSensors}
        collisionDetection={closestCenter}
        onDragStart={handleElementDragStart}
        onDragEnd={handleElementDragEnd}
      >
        <SortableContext
          items={block.elements.map(el => el.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4 pl-4">
            {block.elements.map((element, elementIndex) => {
              const elementPath = [...blockPath, 'element', element.id];
              const isElementSelected = selection.type === 'element' && selection.id === element.id;
              const isElementMultiSelected = multiSelectedIds?.has(element.id) ?? false;
              
              return (
                <BuilderContextMenu
                  key={element.id}
                  type="element"
                  onCopy={() => {
                    onSelect({ type: 'element', id: element.id, path: elementPath });
                    onCopy?.();
                  }}
                  onPaste={() => onPaste?.()}
                  onDuplicate={() => onDuplicateElement?.(element.id)}
                  onDelete={() => onDeleteElement?.(element.id)}
                  onMoveUp={() => {
                    // Move element up logic would need element reorder
                  }}
                  onMoveDown={() => {
                    // Move element down logic would need element reorder
                  }}
                  canMoveUp={elementIndex > 0}
                  canMoveDown={elementIndex < block.elements.length - 1}
                  canPaste={canPaste}
                  disabled={readOnly}
                >
                  <SortableElementRenderer
                    element={element}
                    isSelected={isElementSelected}
                    isMultiSelected={isElementMultiSelected}
                    onSelect={(e) => onSelect({ type: 'element', id: element.id, path: elementPath }, e?.shiftKey)}
                    onUpdate={(updates) => onUpdateElement?.(element.id, updates)}
                    onDuplicate={() => onDuplicateElement?.(element.id)}
                    onDelete={() => onDeleteElement?.(element.id)}
                    onCopy={onCopy}
                    onPaste={onPaste}
                    canPaste={canPaste}
                    readOnly={readOnly}
                    replayAnimationKey={replayAnimationKey}
                    selectionId={selection.id}
                    deviceMode={deviceMode}
                    onNextStep={onNextStep}
                    onGoToStep={onGoToStep}
                    onFormSubmit={onFormSubmit}
                  />
                </BuilderContextMenu>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeElement ? <ElementDragOverlay element={activeElement} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );

  // Wrap in gradient border if enabled
  const blockContent = hasGradientBorder && borderGradient ? (
    <div
      ref={setNodeRef}
      className="rounded-xl p-[2px]"
      style={{
        background: gradientToCSS(borderGradient),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {blockInnerContent}
    </div>
  ) : blockInnerContent;

  // Wrap block with context menu
  if (readOnly) {
    return blockContent;
  }

  return (
    <BuilderContextMenu
      type="block"
      onCopy={() => {
        onSelect({ type: 'block', id: block.id, path: blockPath });
        onCopy?.();
      }}
      onPaste={() => onPaste?.()}
      onDuplicate={() => onDuplicateBlock?.()}
      onDelete={() => onDeleteBlock?.()}
      onMoveUp={() => onMoveBlock?.('up')}
      onMoveDown={() => onMoveBlock?.('down')}
      canMoveUp={blockIndex > 0}
      canMoveDown={blockIndex < totalBlocks - 1}
      canPaste={canPaste}
      disabled={readOnly}
    >
      {blockContent}
    </BuilderContextMenu>
  );
};

// Block Overlay for Drag
const BlockDragOverlay: React.FC<{ block: Block }> = ({ block }) => (
  <div className="p-6 rounded-xl bg-white shadow-2xl border-2 border-builder-accent opacity-90">
    <div className="text-sm font-medium text-gray-900">{block.label}</div>
    <div className="text-xs text-gray-500 mt-1">{block.type} block</div>
  </div>
);

// Stack Renderer with DnD
interface StackRendererProps {
  stack: Stack;
  selection: SelectionState;
  multiSelectedIds?: Set<string>;
  onSelect: (selection: SelectionState, isShiftHeld?: boolean) => void;
  path: string[];
  onReorderBlocks?: (stackId: string, fromIndex: number, toIndex: number) => void;
  onReorderElements?: (blockId: string, fromIndex: number, toIndex: number) => void;
  onAddBlock?: (block: Block, position?: { stackId: string; index: number }) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onUpdateElement?: (elementId: string, updates: Partial<Element>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  readOnly?: boolean;
  replayAnimationKey?: number;
  deviceMode?: DeviceMode;
  onNextStep?: () => void;
  onGoToStep?: (stepId: string) => void;
  onFormSubmit?: (values: Record<string, string>) => void;
}

const StackRenderer: React.FC<StackRendererProps> = ({ 
  stack, 
  selection,
  multiSelectedIds,
  onSelect, 
  path,
  onReorderBlocks,
  onReorderElements,
  onAddBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onCopy,
  onPaste,
  canPaste = false,
  readOnly = false,
  replayAnimationKey = 0,
  deviceMode = 'desktop',
  onNextStep,
  onGoToStep,
  onFormSubmit,
}) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const isSelected = selection.type === 'stack' && selection.id === stack.id;
  const stackPath = [...path, 'stack', stack.id];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveBlockId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBlockId(null);

    if (over && active.id !== over.id && onReorderBlocks) {
      const oldIndex = stack.blocks.findIndex((block) => block.id === active.id);
      const newIndex = stack.blocks.findIndex((block) => block.id === over.id);
      onReorderBlocks(stack.id, oldIndex, newIndex);
    }
  };

  const activeBlock = activeBlockId 
    ? stack.blocks.find(b => b.id === activeBlockId) 
    : null;

  const handleAddBlockToStack = (block: Block) => {
    onAddBlock?.(block, { stackId: stack.id, index: stack.blocks.length });
  };

  return (
    <div
      className={cn(
        'builder-selectable p-2 rounded-xl transition-all',
        isSelected && 'builder-selected',
        stack.direction === 'horizontal' ? 'flex flex-row gap-4' : 'flex flex-col gap-3'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'stack', id: stack.id, path: stackPath });
      }}
    >
      {stack.blocks.length === 0 ? (
        <div className="w-full">
          <AddSectionPopover 
            onAddBlock={handleAddBlockToStack}
            variant="inline"
          />
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stack.blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {stack.blocks.map((block, index) => (
                <SortableBlockRenderer
                  key={block.id}
                  block={block}
                  blockIndex={index}
                  totalBlocks={stack.blocks.length}
                  selection={selection}
                  multiSelectedIds={multiSelectedIds}
                  onSelect={onSelect}
                  path={stackPath}
                  onReorderElements={onReorderElements}
                  onMoveBlock={(direction) => {
                    if (direction === 'up' && index > 0) {
                      onReorderBlocks?.(stack.id, index, index - 1);
                    } else if (direction === 'down' && index < stack.blocks.length - 1) {
                      onReorderBlocks?.(stack.id, index, index + 1);
                    }
                  }}
                  onDuplicateBlock={() => onDuplicateBlock?.(block.id)}
                  onDeleteBlock={() => onDeleteBlock?.(block.id)}
                  onAddBlock={(position) => {
                    // This would be handled by parent for inserting at specific position
                  }}
                  onUpdateElement={onUpdateElement}
                  onDuplicateElement={onDuplicateElement}
                  onDeleteElement={onDeleteElement}
                  onCopy={onCopy}
                  onPaste={onPaste}
                  canPaste={canPaste}
                  readOnly={readOnly}
                  replayAnimationKey={replayAnimationKey}
                  deviceMode={deviceMode}
                  onNextStep={onNextStep}
                  onGoToStep={onGoToStep}
                  onFormSubmit={onFormSubmit}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeBlock ? <BlockDragOverlay block={activeBlock} /> : null}
            </DragOverlay>
          </DndContext>
          
          {/* Add Section Button at bottom */}
          {!readOnly && (
            <div className="mt-2">
              <AddSectionPopover 
                onAddBlock={handleAddBlockToStack}
                variant="inline"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Frame Renderer
interface FrameRendererProps {
  frame: Frame;
  selection: SelectionState;
  multiSelectedIds?: Set<string>;
  onSelect: (selection: SelectionState, isShiftHeld?: boolean) => void;
  path: string[];
  onReorderBlocks?: (stackId: string, fromIndex: number, toIndex: number) => void;
  onReorderElements?: (blockId: string, fromIndex: number, toIndex: number) => void;
  onAddBlock?: (block: Block, position?: { stackId: string; index: number }) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onUpdateElement?: (elementId: string, updates: Partial<Element>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  readOnly?: boolean;
  isDarkTheme?: boolean;
  replayAnimationKey?: number;
  deviceMode?: DeviceMode;
  onNextStep?: () => void;
  onGoToStep?: (stepId: string) => void;
  onFormSubmit?: (values: Record<string, string>) => void;
}

const FrameRenderer: React.FC<FrameRendererProps> = ({ 
  frame, 
  selection,
  multiSelectedIds,
  onSelect, 
  path,
  onReorderBlocks,
  onReorderElements,
  onAddBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onCopy,
  onPaste,
  canPaste = false,
  readOnly = false,
  isDarkTheme = false,
  replayAnimationKey = 0,
  deviceMode = 'desktop',
  onNextStep,
  onGoToStep,
  onFormSubmit,
}) => {
  const isSelected = selection.type === 'frame' && selection.id === frame.id;
  const framePath = [...path, 'frame', frame.id];

  // Frame background resolver
  const getFrameBackgroundStyles = (): { className: string; style?: React.CSSProperties } => {
    const bg = frame.background || 'transparent';

    switch (bg) {
      case 'white':
        return { className: 'bg-white shadow-lg' };
      case 'dark':
        return { className: 'bg-gray-900 shadow-lg' };
      case 'glass':
        return { className: 'backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg' };
      case 'custom':
        return {
          className: 'shadow-lg',
          style: { backgroundColor: frame.backgroundColor || '#ffffff' },
        };
      case 'gradient':
        return {
          className: 'shadow-lg',
          style: {
            background: frame.backgroundGradient
              ? gradientToCSS(frame.backgroundGradient as any)
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          },
        };
      case 'image':
        return {
          className: 'shadow-lg',
          style: frame.backgroundImage
            ? {
                backgroundImage: `url(${frame.backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { backgroundColor: frame.backgroundColor || '#ffffff' },
        };
      case 'transparent':
      default:
        return { className: 'bg-transparent' };
    }
  };

  const frameStyles = getFrameBackgroundStyles();
  
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden transition-all relative group/frame',
        frameStyles.className,
        isSelected && 'ring-2 ring-builder-accent shadow-[0_0_0_4px_hsl(var(--builder-accent)/0.15)]'
      )}
      style={frameStyles.style}
    >
      {/* Frame selection handle - easier to click */}
      {!readOnly && (
        <div 
          className="absolute top-0 left-0 right-0 h-6 cursor-pointer opacity-0 group-hover/frame:opacity-100 hover:bg-builder-accent/10 transition-all z-20 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'frame', id: frame.id, path: framePath });
          }}
          title="Click to select section"
        >
          {/* Section label always visible on hover */}
          <div className="px-3 py-1 text-[10px] font-semibold bg-builder-accent text-white rounded-full shadow-lg flex items-center gap-1.5">
            <Layout className="w-3 h-3" />
            {frame.label || 'Section'}
            <span className="text-white/70">· Click to edit</span>
          </div>
        </div>
      )}
      <div className="p-8">
        {frame.stacks.map((stack) => (
          <StackRenderer
            key={stack.id}
            stack={stack}
            selection={selection}
            multiSelectedIds={multiSelectedIds}
            onSelect={onSelect}
            path={framePath}
            onReorderBlocks={onReorderBlocks}
            onReorderElements={onReorderElements}
            onAddBlock={onAddBlock}
            onDuplicateBlock={onDuplicateBlock}
            onDeleteBlock={onDeleteBlock}
            onUpdateElement={onUpdateElement}
            onDuplicateElement={onDuplicateElement}
            onDeleteElement={onDeleteElement}
            onCopy={onCopy}
            onPaste={onPaste}
            canPaste={canPaste}
            readOnly={readOnly}
            replayAnimationKey={replayAnimationKey}
            deviceMode={deviceMode}
            onNextStep={onNextStep}
            onGoToStep={onGoToStep}
            onFormSubmit={onFormSubmit}
          />
        ))}
      </div>
    </div>
  );
};

// Main Canvas Component
export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  step,
  selection,
  onSelect,
  deviceMode,
  readOnly = false,
  designMode = 'select',
  onReorderBlocks,
  onReorderElements,
  onOpenBlockPalette,
  onAddBlock,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onDuplicateBlock,
  onDeleteBlock,
  onCopy,
  onPaste,
  canPaste = false,
  pageSettings,
  replayAnimationKey = 0,
  onNextStep,
  onGoToStep,
  onFormSubmit,
  showGrid = false,
  onOpenAIGenerate,
}) => {
  // Form state for preview mode
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [checkboxValues, setCheckboxValues] = useState<Record<string, Set<string>>>({});
  
  // Pan mode state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  
  const setValue = useCallback((key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Toggle checkbox in a group (for multi-select)
  const toggleCheckbox = useCallback((groupKey: string, value: string) => {
    setCheckboxValues(prev => {
      const currentSet = prev[groupKey] || new Set<string>();
      const newSet = new Set(currentSet);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [groupKey]: newSet };
    });
  }, []);
  
  // Check if a checkbox value is selected
  const isChecked = useCallback((groupKey: string, value: string) => {
    return checkboxValues[groupKey]?.has(value) || false;
  }, [checkboxValues]);
  
  // Pan mode handlers
  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (designMode !== 'pan') return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
      scrollTop: scrollContainerRef.current?.scrollTop || 0,
    });
  }, [designMode]);
  
  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || designMode !== 'pan' || !scrollContainerRef.current) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    scrollContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = panStart.scrollTop - dy;
  }, [isPanning, designMode, panStart]);
  
  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Determine if we're in preview mode (readOnly means preview)
  const isPreviewMode = readOnly;
  
  if (!step) {
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-builder-surface flex items-center justify-center mx-auto mb-4">
            <Type className="w-8 h-8 text-builder-text-muted" />
          </div>
          <p className="text-builder-text-muted">Select a step to start editing</p>
        </div>
      </div>
    );
  }

  const stepPath = ['step', step.id];

  // Get first stack ID for adding blocks
  const firstStackId = step.frames[0]?.stacks[0]?.id;

  const handleAddBlockToCanvas = (block: Block) => {
    if (firstStackId) {
      onAddBlock?.(block, { stackId: firstStackId, index: 0 });
    }
  };

  // Apply theme settings
  const isDarkTheme = pageSettings?.theme === 'dark';
  const primaryColor = pageSettings?.primary_color || '#8B5CF6';
  const fontFamily = pageSettings?.font_family || 'Inter';

  return (
    <ThemeContext.Provider value={{ isDarkTheme, primaryColor }}>
    <FormStateContext.Provider value={{ values: formValues, checkboxValues, setValue, toggleCheckbox, isChecked, isPreviewMode }}>
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 bg-canvas-bg canvas-grid overflow-auto builder-scroll relative",
          designMode === 'pan' && !isPanning && "cursor-grab",
          isPanning && "cursor-grabbing select-none"
        )}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanMouseUp}
        onMouseLeave={handlePanMouseUp}
      >
        {/* Grid Overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
        )}
        
        {/* Add Block Button - Top */}
        {!readOnly && (
          <div className="flex justify-center pt-6 pb-4">
            <AddSectionPopover 
              onAddBlock={handleAddBlockToCanvas}
              onOpenAIGenerate={onOpenAIGenerate}
              position="below"
            />
          </div>
        )}

        {/* Canvas Container with Device Frame */}
        <div className={cn('mx-auto px-8 pb-8', deviceWidths[deviceMode])}>
          {/* Device Frame - Apply theme settings and step/page background */}
          <div 
            className={cn('device-frame relative min-h-[600px]', isDarkTheme && 'dark-theme')}
            style={{ 
              fontFamily: fontFamily,
              '--primary-color': primaryColor,
              // Use step.background if set, otherwise fall back to page background
              ...getPageBackgroundStyles(step.background || pageSettings?.page_background, isDarkTheme),
            } as React.CSSProperties}
            onClick={(e) => {
              // Click on empty device frame = select page / clear selection
              if (e.target === e.currentTarget) {
                onSelect({ type: null, id: null, path: [] });
              }
            }}
          >
            {/* Background Overlay (from step or page) */}
            {(() => {
              const bgSource = step.background || pageSettings?.page_background;
              const overlayStyles = getOverlayStyles(bgSource);
              return overlayStyles ? (
                <div 
                  className="absolute inset-0 pointer-events-none z-0" 
                  style={overlayStyles} 
                />
              ) : null;
            })()}
            
            {/* Frames */}
            <div className="min-h-[600px] relative z-10">
              {step.frames.map((frame) => (
                <FrameRenderer
                  key={frame.id}
                  frame={frame}
                  selection={selection}
                  onSelect={onSelect}
                  path={stepPath}
                  onReorderBlocks={onReorderBlocks}
                  onReorderElements={onReorderElements}
                  onAddBlock={onAddBlock}
                  onDuplicateBlock={onDuplicateBlock}
                  onDeleteBlock={onDeleteBlock}
                  onUpdateElement={onUpdateElement}
                  onDuplicateElement={onDuplicateElement}
                  onDeleteElement={onDeleteElement}
                  onCopy={onCopy}
                  onPaste={onPaste}
                  canPaste={canPaste}
                  readOnly={readOnly}
                  isDarkTheme={isDarkTheme}
                  replayAnimationKey={replayAnimationKey}
                  deviceMode={deviceMode}
                  onNextStep={onNextStep}
                  onGoToStep={onGoToStep}
                  onFormSubmit={onFormSubmit}
                />
              ))}
            </div>

            {/* Footer area - now optional, shown if no footer block exists */}
            {!step.frames.some(f => f.stacks.some(s => s.blocks.some(b => b.type === 'footer'))) && (
              <div className={cn(
                "p-6 flex justify-center border-t",
                isDarkTheme ? "border-gray-800" : "border-gray-100"
              )}>
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isDarkTheme ? "text-gray-500" : "text-gray-400"
                )}>
                  <span>Add a Footer Links block to customize</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Block Button - Bottom */}
        {!readOnly && (
          <div className="flex justify-center pb-8">
            <AddSectionPopover 
              onAddBlock={handleAddBlockToCanvas}
              onOpenAIGenerate={onOpenAIGenerate}
              position="above"
            />
          </div>
        )}
        
        {/* Form State Debug Panel - Only visible in preview mode with form data */}
        {isPreviewMode && Object.keys(formValues).length > 0 && (
          <div className="fixed bottom-4 right-4 p-3 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl z-50 max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-white">Form State</span>
            </div>
            <div className="space-y-1">
              {Object.entries(formValues).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-gray-400 font-mono truncate max-w-[100px]">{key}:</span>
                  <span className="text-white font-mono truncate max-w-[120px]">{value || '(empty)'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormStateContext.Provider>
    </ThemeContext.Provider>
  );
};