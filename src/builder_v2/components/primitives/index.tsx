/**
 * Primitive Components - Framer/Perspective style building blocks
 * These are the atomic units that compose into templates
 * Now with full styling prop support
 */

import { cn } from '@/lib/utils';
import { CheckCircle, Mail, Phone, Image, Video, Calendar, Square, AlignLeft } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

// ============================================================================
// STYLE HELPERS
// ============================================================================

function getTextAlignClass(align?: string): string {
  switch (align) {
    case 'left': return 'text-left';
    case 'right': return 'text-right';
    case 'justify': return 'text-justify';
    default: return 'text-center';
  }
}

function getFontSizeClass(size?: string): string {
  switch (size) {
    case 'xs': return 'text-xs';
    case 'sm': return 'text-sm';
    case 'lg': return 'text-lg';
    case 'xl': return 'text-xl';
    case '2xl': return 'text-2xl';
    case '3xl': return 'text-3xl';
    case '4xl': return 'text-4xl';
    default: return '';
  }
}

function getFontWeightClass(weight?: string): string {
  switch (weight) {
    case 'normal': return 'font-normal';
    case 'medium': return 'font-medium';
    case 'semibold': return 'font-semibold';
    case 'bold': return 'font-bold';
    default: return '';
  }
}

function getShadowClass(shadow?: string): string {
  switch (shadow) {
    case 'sm': return 'shadow-sm';
    case 'md': return 'shadow-md';
    case 'lg': return 'shadow-lg';
    case 'xl': return 'shadow-xl';
    default: return '';
  }
}

// ============================================================================
// FRAME - Top-level page container
// ============================================================================

interface FrameProps {
  name?: string;
  children?: ReactNode;
  className?: string;
  backgroundColor?: string;
  padding?: number;
  gap?: number;
}

export function Frame({ name, children, className, backgroundColor, padding, gap }: FrameProps) {
  const style: CSSProperties = {};
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (padding !== undefined) style.padding = `${padding}px`;
  if (gap !== undefined) style.gap = `${gap}px`;

  return (
    <div className={cn('builder-frame', className)} data-name={name} style={style}>
      {children}
    </div>
  );
}

// ============================================================================
// SECTION - Content grouping with semantic variants
// ============================================================================

interface SectionProps {
  variant?: 'hero' | 'content' | 'form' | 'media' | 'options' | 'cta' | 'embed';
  children?: ReactNode;
  className?: string;
  backgroundColor?: string;
  padding?: number;
  gap?: number;
  maxWidth?: string;
  borderRadius?: number;
  shadow?: string;
}

export function Section({ 
  variant = 'content', 
  children, 
  className,
  backgroundColor,
  padding,
  gap,
  maxWidth,
  borderRadius,
  shadow,
}: SectionProps) {
  const style: CSSProperties = {};
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (padding !== undefined) style.padding = `${padding}px`;
  if (gap !== undefined) style.gap = `${gap}px`;
  if (maxWidth) style.maxWidth = maxWidth;
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  return (
    <div 
      className={cn('builder-section', `builder-section--${variant}`, getShadowClass(shadow), className)}
      style={style}
    >
      {children}
    </div>
  );
}

// ============================================================================
// HEADING - Typography with levels and full styling
// ============================================================================

interface HeadingProps {
  text?: string;
  level?: 'h1' | 'h2' | 'h3';
  className?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontSize?: string;
  fontWeight?: string;
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: string;
}

export function Heading({ 
  text = 'Heading', 
  level = 'h1', 
  className,
  color,
  textAlign,
  fontSize,
  fontWeight,
  backgroundColor,
  borderRadius,
  shadow,
}: HeadingProps) {
  const Tag = level;
  const style: CSSProperties = {};
  if (color) style.color = color;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  return (
    <Tag 
      className={cn(
        'builder-heading', 
        `builder-heading--${level}`,
        getTextAlignClass(textAlign),
        fontSize && getFontSizeClass(fontSize),
        fontWeight && getFontWeightClass(fontWeight),
        getShadowClass(shadow),
        className
      )}
      style={style}
    >
      {text}
    </Tag>
  );
}

// ============================================================================
// PARAGRAPH - Body text with full styling
// ============================================================================

interface ParagraphProps {
  text?: string;
  className?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontSize?: string;
  fontWeight?: string;
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: string;
}

export function Paragraph({ 
  text = 'Paragraph text', 
  className,
  color,
  textAlign,
  fontSize,
  fontWeight,
  backgroundColor,
  borderRadius,
  shadow,
}: ParagraphProps) {
  const style: CSSProperties = {};
  if (color) style.color = color;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  return (
    <p 
      className={cn(
        'builder-paragraph',
        getTextAlignClass(textAlign),
        fontSize && getFontSizeClass(fontSize),
        fontWeight && getFontWeightClass(fontWeight),
        getShadowClass(shadow),
        className
      )}
      style={style}
    >
      {text}
    </p>
  );
}

// ============================================================================
// CTA BUTTON - Primary action button with full styling
// ============================================================================

interface CtaButtonProps {
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  action?: 'next' | 'submit' | 'link';
  size?: 'sm' | 'default' | 'lg';
  fullWidth?: boolean;
  className?: string;
  backgroundColor?: string;
  color?: string;
  borderRadius?: number;
  shadow?: string;
}

export function CtaButton({ 
  label = 'Continue', 
  variant = 'primary', 
  size = 'default',
  fullWidth = true,
  className,
  backgroundColor,
  color,
  borderRadius,
  shadow,
}: CtaButtonProps) {
  const style: CSSProperties = {};
  if (backgroundColor && backgroundColor !== 'transparent') style.background = backgroundColor;
  if (color) style.color = color;
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  const sizeClasses = {
    sm: 'py-2.5 px-4 text-sm',
    default: 'py-3.5 px-6 text-base',
    lg: 'py-4 px-8 text-lg',
  };

  return (
    <button
      type="button"
      className={cn(
        'builder-cta-button', 
        `builder-cta-button--${variant}`,
        sizeClasses[size],
        !fullWidth && 'w-auto',
        getShadowClass(shadow),
        className
      )}
      style={style}
    >
      {label}
    </button>
  );
}

// ============================================================================
// SPACER - Vertical spacing
// ============================================================================

interface SpacerProps {
  height?: number;
}

export function Spacer({ height = 24 }: SpacerProps) {
  return <div className="builder-spacer" style={{ height: `${height}px` }} />;
}

// ============================================================================
// DIVIDER - Horizontal line
// ============================================================================

export function Divider() {
  return <hr className="builder-divider" />;
}

// ============================================================================
// TEXT INPUT - Single line text field with styling
// ============================================================================

interface TextInputProps {
  placeholder?: string;
  fieldName?: string;
  required?: boolean;
  className?: string;
  borderRadius?: number;
  backgroundColor?: string;
  color?: string;
}

export function TextInput({ 
  placeholder = 'Type here...', 
  className,
  borderRadius,
  backgroundColor,
  color,
}: TextInputProps) {
  const style: CSSProperties = {};
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (color) style.color = color;

  return (
    <input
      type="text"
      placeholder={placeholder}
      className={cn('builder-input builder-input--text', className)}
      style={style}
      readOnly
    />
  );
}

// ============================================================================
// EMAIL INPUT - Email field with icon
// ============================================================================

interface EmailInputProps {
  placeholder?: string;
  fieldName?: string;
  required?: boolean;
  className?: string;
  borderRadius?: number;
  backgroundColor?: string;
  color?: string;
}

export function EmailInput({ 
  placeholder = 'you@example.com', 
  className,
  borderRadius,
  backgroundColor,
  color,
}: EmailInputProps) {
  const style: CSSProperties = {};
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (color) style.color = color;

  return (
    <div className={cn('builder-input-wrapper', className)}>
      <Mail className="builder-input-icon" size={18} />
      <input
        type="email"
        placeholder={placeholder}
        className="builder-input builder-input--email"
        style={style}
        readOnly
      />
    </div>
  );
}

// ============================================================================
// PHONE INPUT - Phone field with icon
// ============================================================================

interface PhoneInputProps {
  placeholder?: string;
  fieldName?: string;
  className?: string;
  borderRadius?: number;
  backgroundColor?: string;
  color?: string;
}

export function PhoneInput({ 
  placeholder = '(555) 123-4567', 
  className,
  borderRadius,
  backgroundColor,
  color,
}: PhoneInputProps) {
  const style: CSSProperties = {};
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (color) style.color = color;

  return (
    <div className={cn('builder-input-wrapper', className)}>
      <Phone className="builder-input-icon" size={18} />
      <input
        type="tel"
        placeholder={placeholder}
        className="builder-input builder-input--phone"
        style={style}
        readOnly
      />
    </div>
  );
}

// ============================================================================
// VIDEO EMBED - Video player placeholder
// ============================================================================

interface VideoEmbedProps {
  url?: string;
  placeholder?: string;
  aspectRatio?: string;
  className?: string;
  borderRadius?: number;
  shadow?: string;
}

export function VideoEmbed({ 
  url, 
  placeholder = 'Paste video URL', 
  aspectRatio = '16:9',
  className,
  borderRadius,
  shadow,
}: VideoEmbedProps) {
  const style: CSSProperties = {};
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  const aspectMap: Record<string, string> = {
    '16:9': '56.25%',
    '4:3': '75%',
    '1:1': '100%',
    '9:16': '177.78%',
  };

  if (url) {
    return (
      <div 
        className={cn('builder-video-embed', getShadowClass(shadow), className)}
        style={{ ...style, paddingBottom: aspectMap[aspectRatio] || aspectMap['16:9'] }}
      >
        <iframe src={url} allowFullScreen className="builder-video-iframe" />
      </div>
    );
  }
  
  return (
    <div className={cn('builder-video-placeholder', className)} style={style}>
      <Video size={32} className="builder-placeholder-icon" />
      <span className="builder-placeholder-text">{placeholder}</span>
    </div>
  );
}

// ============================================================================
// CALENDAR EMBED - Booking widget placeholder
// ============================================================================

interface CalendarEmbedProps {
  url?: string;
  placeholder?: string;
  height?: number;
  className?: string;
  borderRadius?: number;
}

export function CalendarEmbed({ 
  url, 
  placeholder = 'Paste calendar URL', 
  height = 500,
  className,
  borderRadius,
}: CalendarEmbedProps) {
  const style: CSSProperties = { minHeight: `${height}px` };
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  if (url) {
    return (
      <div className={cn('builder-calendar-embed', className)} style={style}>
        <iframe src={url} className="builder-calendar-iframe" style={{ minHeight: `${height}px` }} />
      </div>
    );
  }
  
  return (
    <div className={cn('builder-embed-placeholder', className)} style={style}>
      <Calendar size={32} className="builder-placeholder-icon" />
      <span className="builder-placeholder-text">{placeholder}</span>
    </div>
  );
}

// ============================================================================
// OPTION GRID - Multiple choice options with layout variants
// ============================================================================

interface OptionGridProps {
  options?: Array<{ id: string; label: string; emoji?: string }>;
  autoAdvance?: boolean;
  layout?: 'stack' | 'grid-2' | 'grid-3';
  className?: string;
  borderRadius?: number;
  backgroundColor?: string;
}

export function OptionGrid({ 
  options = [], 
  layout = 'stack',
  className,
  borderRadius,
  backgroundColor,
}: OptionGridProps) {
  if (options.length === 0) {
    return (
      <div className={cn('builder-option-placeholder', className)}>
        <Square size={24} className="builder-placeholder-icon" />
        <span className="builder-placeholder-text">Add options in the inspector</span>
      </div>
    );
  }

  const layoutClasses = {
    'stack': 'flex-col',
    'grid-2': 'grid grid-cols-2',
    'grid-3': 'grid grid-cols-3',
  };

  const style: CSSProperties = {};
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;

  return (
    <div className={cn('builder-option-grid', layoutClasses[layout], className)}>
      {options.map((opt) => (
        <button 
          key={opt.id} 
          type="button" 
          className="builder-option-item"
          style={style}
        >
          {opt.emoji && <span className="builder-option-emoji">{opt.emoji}</span>}
          <span className="builder-option-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ICON - Decorative icon
// ============================================================================

interface IconProps {
  name?: string;
  size?: number;
  color?: string;
  className?: string;
}

export function Icon({ name = 'check-circle', size = 48, color = '#22c55e', className }: IconProps) {
  const iconStyle: CSSProperties = { color, width: size, height: size };
  
  if (name === 'check-circle') {
    return <CheckCircle style={iconStyle} className={cn('builder-icon', className)} />;
  }
  
  return <CheckCircle style={iconStyle} className={cn('builder-icon', className)} />;
}

// ============================================================================
// INFO CARD - List of items with icons
// ============================================================================

interface InfoCardProps {
  items?: Array<{ icon: string; text: string }>;
  className?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

export function InfoCard({ 
  items = [], 
  className,
  backgroundColor,
  borderRadius,
}: InfoCardProps) {
  const style: CSSProperties = {};
  if (backgroundColor && backgroundColor !== 'transparent') style.backgroundColor = backgroundColor;
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  if (items.length === 0) {
    return (
      <div className={cn('builder-info-placeholder', className)}>
        <AlignLeft size={24} className="builder-placeholder-icon" />
        <span className="builder-placeholder-text">Add info items in the inspector</span>
      </div>
    );
  }

  return (
    <div className={cn('builder-info-card', className)} style={style}>
      {items.map((item, i) => (
        <div key={i} className="builder-info-item">
          <span className="builder-info-icon">{item.icon}</span>
          <span className="builder-info-text">{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// IMAGE - Image with placeholder and styling
// ============================================================================

interface ImageBlockProps {
  src?: string;
  alt?: string;
  maxWidth?: string;
  borderRadius?: number;
  shadow?: string;
  className?: string;
}

export function ImageBlock({ 
  src, 
  alt = 'Image', 
  maxWidth = '320px',
  borderRadius,
  shadow,
  className,
}: ImageBlockProps) {
  const style: CSSProperties = { maxWidth };
  if (borderRadius !== undefined) style.borderRadius = `${borderRadius}px`;

  if (src) {
    return (
      <img 
        src={src} 
        alt={alt} 
        className={cn('builder-image', getShadowClass(shadow), className)} 
        style={style}
      />
    );
  }
  
  return (
    <div className={cn('builder-image-placeholder', className)} style={style}>
      <Image size={32} className="builder-placeholder-icon" />
      <span className="builder-placeholder-text">Add image</span>
    </div>
  );
}

// ============================================================================
// CONSENT CHECKBOX - GDPR-compliant consent
// ============================================================================

interface ConsentCheckboxProps {
  label?: string;
  linkText?: string;
  linkUrl?: string;
  required?: boolean;
  fieldName?: string;
  className?: string;
}

export function ConsentCheckbox({ 
  label = 'I agree to receive communications', 
  linkText = 'Privacy Policy',
  linkUrl = '/privacy',
  className 
}: ConsentCheckboxProps) {
  return (
    <label className={cn('builder-consent', className)}>
      <input type="checkbox" className="builder-consent-checkbox" readOnly />
      <span className="builder-consent-text">
        {label}{' '}
        <a href={linkUrl} className="builder-consent-link">{linkText}</a>
      </span>
    </label>
  );
}

// ============================================================================
// HEADER BAR - Dark header with optional logo
// ============================================================================

interface HeaderBarProps {
  backgroundColor?: string;
  logoUrl?: string;
  logoAlt?: string;
  className?: string;
}

export function HeaderBar({ 
  backgroundColor = '#1a1a1a', 
  logoUrl,
  logoAlt = 'Logo',
  className 
}: HeaderBarProps) {
  return (
    <div 
      className={cn('builder-header-bar', className)}
      style={{ backgroundColor }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={logoAlt} className="builder-header-logo" />
      ) : (
        <div className="builder-header-logo-placeholder">
          <span>Logo</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONTENT CARD - White card container with shadow
// ============================================================================

interface ContentCardProps {
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: boolean;
  children?: ReactNode;
  className?: string;
}

export function ContentCard({ 
  backgroundColor = '#ffffff', 
  borderRadius = 16,
  shadow = true,
  children,
  className 
}: ContentCardProps) {
  return (
    <div 
      className={cn('builder-content-card', shadow && 'builder-content-card--shadow', className)}
      style={{ 
        backgroundColor,
        borderRadius: `${borderRadius}px`,
      }}
    >
      {children}
    </div>
  );
}
