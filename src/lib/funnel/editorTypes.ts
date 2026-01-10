/**
 * Legacy Funnel Editor Types
 * 
 * These types are used by the legacy funnel-builder components
 * and the V1 editor. They are separate from the Builder V2 types.
 * 
 * Note: Properties use snake_case to match database schema conventions.
 */

export type StepType =
  | 'welcome'
  | 'text_question'
  | 'multi_choice'
  | 'email_capture'
  | 'phone_capture'
  | 'video'
  | 'thank_you'
  | 'opt_in'
  | 'embed';

export interface FunnelStep {
  id: string;
  funnel_id: string;
  order_index: number;
  step_type: StepType;
  content: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface FunnelSettings {
  // General styling
  primary_color?: string;
  primaryColor?: string; // alias
  button_style?: 'rounded' | 'pill' | 'square';
  buttonStyle?: 'rounded' | 'pill' | 'square'; // alias
  button_text?: string;
  font_family?: string;
  fontFamily?: string; // alias
  show_progress_bar?: boolean;
  showProgressBar?: boolean; // alias
  auto_advance?: boolean;
  autoAdvance?: boolean; // alias
  
  // Background
  background_type?: 'solid' | 'gradient' | 'image';
  backgroundType?: 'solid' | 'gradient' | 'image'; // alias
  background_color?: string;
  backgroundColor?: string; // alias
  background_gradient?: string;
  backgroundGradient?: string; // alias
  background_image?: string;
  backgroundImage?: string; // alias
  
  // Branding
  logo_url?: string;
  logoUrl?: string; // alias
  favicon_url?: string;
  faviconUrl?: string; // alias
  custom_css?: string;
  customCss?: string; // alias
  
  // SEO
  seo_title?: string;
  metaTitle?: string; // alias
  seo_description?: string;
  metaDescription?: string; // alias
  seo_image?: string;
  ogImage?: string; // alias
  
  // Analytics
  google_analytics_id?: string;
  googleAnalyticsId?: string; // alias
  facebook_pixel_id?: string;
  facebookPixelId?: string; // alias
  
  // Allow additional properties
  [key: string]: unknown;
}

export interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: string;
  settings: FunnelSettings;
  domain_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  zapier_webhook_url?: string | null;
  webhook_urls?: Record<string, string> | null;
  auto_create_contact?: boolean;
}

export interface StepDesign {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundGradient?: string;
  textColor?: string;
  headlineColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonStyle?: 'rounded' | 'pill' | 'square';
  padding?: string;
  maxWidth?: string;
  [key: string]: unknown;
}

export interface StepSettings {
  autoAdvance?: boolean;
  showNavigation?: boolean;
  transitionType?: 'fade' | 'slide' | 'none';
  transitionDuration?: number;
  customCss?: string;
  [key: string]: unknown;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'divider' | 'spacer' | 'list';
  content: Record<string, unknown>;
  order: number;
}

export interface PageSettings {
  title?: string;
  description?: string;
  ogImage?: string;
  noIndex?: boolean;
  [key: string]: unknown;
}

export interface DynamicElement {
  id: string;
  type: string;
  content: Record<string, unknown>;
}
