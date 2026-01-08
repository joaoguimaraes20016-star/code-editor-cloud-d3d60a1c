/**
 * Primitive Components - Framer/Perspective style building blocks
 * These are the atomic units that compose into templates
 */

import { cn } from '@/lib/utils';
import { CheckCircle, Mail, Phone, Type, AlignLeft, Square, Minus, Image, Video, Calendar } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

// ============================================================================
// FRAME - Top-level page container
// ============================================================================

interface FrameProps {
  name?: string;
  children?: ReactNode;
  className?: string;
}

export function Frame({ name, children, className }: FrameProps) {
  return (
    <div className={cn('builder-frame', className)} data-name={name}>
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
}

export function Section({ variant = 'content', children, className }: SectionProps) {
  return (
    <div className={cn('builder-section', `builder-section--${variant}`, className)}>
      {children}
    </div>
  );
}

// ============================================================================
// HEADING - Typography with levels
// ============================================================================

interface HeadingProps {
  text?: string;
  level?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function Heading({ text = 'Heading', level = 'h1', className }: HeadingProps) {
  const Tag = level;
  return <Tag className={cn('builder-heading', `builder-heading--${level}`, className)}>{text}</Tag>;
}

// ============================================================================
// PARAGRAPH - Body text
// ============================================================================

interface ParagraphProps {
  text?: string;
  className?: string;
}

export function Paragraph({ text = 'Paragraph text', className }: ParagraphProps) {
  return <p className={cn('builder-paragraph', className)}>{text}</p>;
}

// ============================================================================
// CTA BUTTON - Primary action button
// ============================================================================

interface CtaButtonProps {
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  action?: 'next' | 'submit' | 'link';
  className?: string;
}

export function CtaButton({ label = 'Continue', variant = 'primary', className }: CtaButtonProps) {
  return (
    <button
      type="button"
      className={cn('builder-cta-button', `builder-cta-button--${variant}`, className)}
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
// TEXT INPUT - Single line text field
// ============================================================================

interface TextInputProps {
  placeholder?: string;
  fieldName?: string;
  required?: boolean;
  className?: string;
}

export function TextInput({ placeholder = 'Type here...', className }: TextInputProps) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      className={cn('builder-input builder-input--text', className)}
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
}

export function EmailInput({ placeholder = 'you@example.com', className }: EmailInputProps) {
  return (
    <div className={cn('builder-input-wrapper', className)}>
      <Mail className="builder-input-icon" size={18} />
      <input
        type="email"
        placeholder={placeholder}
        className="builder-input builder-input--email"
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
}

export function PhoneInput({ placeholder = '(555) 123-4567', className }: PhoneInputProps) {
  return (
    <div className={cn('builder-input-wrapper', className)}>
      <Phone className="builder-input-icon" size={18} />
      <input
        type="tel"
        placeholder={placeholder}
        className="builder-input builder-input--phone"
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
  className?: string;
}

export function VideoEmbed({ url, placeholder = 'Paste video URL', className }: VideoEmbedProps) {
  if (url) {
    return (
      <div className={cn('builder-video-embed', className)}>
        <iframe src={url} allowFullScreen className="builder-video-iframe" />
      </div>
    );
  }
  
  return (
    <div className={cn('builder-video-placeholder', className)}>
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
  className?: string;
}

export function CalendarEmbed({ url, placeholder = 'Paste calendar URL', className }: CalendarEmbedProps) {
  if (url) {
    return (
      <div className={cn('builder-calendar-embed', className)}>
        <iframe src={url} className="builder-calendar-iframe" />
      </div>
    );
  }
  
  return (
    <div className={cn('builder-embed-placeholder', className)}>
      <Calendar size={32} className="builder-placeholder-icon" />
      <span className="builder-placeholder-text">{placeholder}</span>
    </div>
  );
}

// ============================================================================
// OPTION GRID - Multiple choice options
// ============================================================================

interface OptionGridProps {
  options?: Array<{ id: string; label: string; emoji?: string }>;
  autoAdvance?: boolean;
  className?: string;
}

export function OptionGrid({ options = [], className }: OptionGridProps) {
  if (options.length === 0) {
    return (
      <div className={cn('builder-option-placeholder', className)}>
        <Square size={24} className="builder-placeholder-icon" />
        <span className="builder-placeholder-text">Add options in the inspector</span>
      </div>
    );
  }

  return (
    <div className={cn('builder-option-grid', className)}>
      {options.map((opt) => (
        <button key={opt.id} type="button" className="builder-option-item">
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
  // Simple icon mapping - can be extended
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
}

export function InfoCard({ items = [], className }: InfoCardProps) {
  if (items.length === 0) {
    return (
      <div className={cn('builder-info-placeholder', className)}>
        <AlignLeft size={24} className="builder-placeholder-icon" />
        <span className="builder-placeholder-text">Add info items in the inspector</span>
      </div>
    );
  }

  return (
    <div className={cn('builder-info-card', className)}>
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
// IMAGE - Image with placeholder
// ============================================================================

interface ImageBlockProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function ImageBlock({ src, alt = 'Image', className }: ImageBlockProps) {
  if (src) {
    return <img src={src} alt={alt} className={cn('builder-image', className)} />;
  }
  
  return (
    <div className={cn('builder-image-placeholder', className)}>
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
