// ============================================
// UNIFIED PRESETS - Single source of truth
// ============================================

// Quick color presets for BACKGROUNDS (solid colors) - vibrant & useful
export const backgroundColorPresets = [
  // Clean neutrals
  '#FFFFFF', '#F8FAFC', '#F1F5F9', 
  // Dark backgrounds
  '#1E293B', '#0F172A', '#030712',
  // Vibrant colors
  '#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
];

// Quick color presets for TEXT - high contrast, readable
export const textColorPresets = [
  // Standard text
  '#FFFFFF', '#F9FAFB', '#E5E7EB', '#9CA3AF', '#6B7280', '#374151', '#111827', '#000000',
  // Accent colors
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
];

// Quick color presets for ELEMENTS (buttons, cards, etc.)
export const elementColorPresets = [
  // Brand purples
  '#8B5CF6', '#7C3AED', '#6D28D9',
  // Warm colors
  '#EF4444', '#F97316', '#F59E0B',
  // Cool colors  
  '#3B82F6', '#06B6D4', '#10B981',
  // Pinks
  '#EC4899', '#D946EF',
  // Neutrals
  '#FFFFFF', '#1E293B', '#000000',
];

// Highlight accent presets (for {{text}} syntax)
export const highlightPresets = [
  { color: '#F59E0B', label: 'Gold' },
  { color: '#EF4444', label: 'Red' },
  { color: '#10B981', label: 'Green' },
  { color: '#3B82F6', label: 'Blue' },
  { color: '#8B5CF6', label: 'Purple' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#06B6D4', label: 'Cyan' },
  { color: '#FFFFFF', label: 'White' },
];

// Legacy export for backward compatibility
export const colorPresets = textColorPresets;

// Gradient presets - unified across all pickers
export interface GradientPreset {
  name: string;
  gradient: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
}

export const gradientPresets: GradientPreset[] = [
  // Text/Headline gradients (optimized for text readability)
  { 
    name: 'White Fade', 
    gradient: { type: 'linear', angle: 180, stops: [{ color: '#ffffff', position: 0 }, { color: '#9ca3af', position: 100 }] } 
  },
  { 
    name: 'Fire', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#ef4444', position: 0 }, { color: '#f97316', position: 50 }, { color: '#fbbf24', position: 100 }] } 
  },
  { 
    name: 'Gold', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#fbbf24', position: 0 }, { color: '#f59e0b', position: 50 }, { color: '#d97706', position: 100 }] } 
  },
  { 
    name: 'Purple Magic', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#8b5cf6', position: 0 }, { color: '#a855f7', position: 50 }, { color: '#d946ef', position: 100 }] } 
  },
  { 
    name: 'Ocean', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#06b6d4', position: 0 }, { color: '#3b82f6', position: 50 }, { color: '#8b5cf6', position: 100 }] } 
  },
  { 
    name: 'Sunset', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#f97316', position: 0 }, { color: '#ef4444', position: 50 }, { color: '#ec4899', position: 100 }] } 
  },
  // Background gradients (more subtle)
  { 
    name: 'Steel', 
    gradient: { type: 'linear', angle: 180, stops: [{ color: '#374151', position: 0 }, { color: '#1f2937', position: 100 }] } 
  },
  { 
    name: 'Neon Green', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#10b981', position: 0 }, { color: '#22d3ee', position: 100 }] } 
  },
  { 
    name: 'Dark Fade', 
    gradient: { type: 'linear', angle: 180, stops: [{ color: '#1f2937', position: 0 }, { color: '#030712', position: 100 }] } 
  },
  // Additional premium gradients
  { 
    name: 'Rose', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#ec4899', position: 0 }, { color: '#f472b6', position: 100 }] } 
  },
  { 
    name: 'Aurora', 
    gradient: { type: 'linear', angle: 135, stops: [{ color: '#8b5cf6', position: 0 }, { color: '#06b6d4', position: 50 }, { color: '#10b981', position: 100 }] } 
  },
  { 
    name: 'Midnight', 
    gradient: { type: 'radial', angle: 0, stops: [{ color: '#1e3a8a', position: 0 }, { color: '#0f172a', position: 100 }] } 
  },
];

// Text shadow presets
export interface TextShadowPreset {
  label: string;
  value: string;
  css: string;
}

export const textShadowPresets: TextShadowPreset[] = [
  { label: 'None', value: 'none', css: 'none' },
  { label: 'Subtle', value: 'subtle', css: '0 1px 2px rgba(0, 0, 0, 0.15)' },
  { label: 'Medium', value: 'medium', css: '0 2px 4px rgba(0, 0, 0, 0.25)' },
  { label: 'Strong', value: 'strong', css: '0 4px 8px rgba(0, 0, 0, 0.4)' },
  { label: 'Glow', value: 'glow', css: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3), 0 0 30px rgba(255, 255, 255, 0.2)' },
  { label: 'Neon', value: 'neon', css: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 20px currentColor' },
  { label: '3D Depth', value: 'depth', css: '0 1px 0 rgba(0, 0, 0, 0.1), 0 2px 0 rgba(0, 0, 0, 0.08), 0 3px 0 rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.15)' },
];

// Block shadow presets (includes new glassmorphism options)
export interface BlockShadowPreset {
  label: string;
  value: string;
}

export const blockShadowPresets: BlockShadowPreset[] = [
  { label: 'None', value: 'none' },
  { label: 'Subtle', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
  { label: 'X-Large', value: 'xl' },
  { label: '2X-Large', value: '2xl' },
  { label: 'Inner', value: 'inner' },
  { label: 'Glow', value: 'glow' },
  { label: 'Neon', value: 'neon' },
];

// Font size options (extended for hero headlines)
export const fontSizeOptions = [
  { label: 'S', value: 'sm' as const },
  { label: 'M', value: 'md' as const },
  { label: 'L', value: 'lg' as const },
  { label: 'XL', value: 'xl' as const },
  { label: '2XL', value: '2xl' as const },
  { label: '3XL', value: '3xl' as const },
  { label: '4XL', value: '4xl' as const },
  { label: '5XL', value: '5xl' as const },
];

// Display fonts for hyper-expressive headlines
export const displayFonts = [
  { label: 'Inherit', value: 'inherit', isDisplay: false },
  // Display fonts
  { label: 'Oswald', value: 'Oswald', isDisplay: true },
  { label: 'Anton', value: 'Anton', isDisplay: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', isDisplay: true },
  { label: 'Archivo Black', value: 'Archivo Black', isDisplay: true },
  { label: 'Space Grotesk', value: 'Space Grotesk', isDisplay: true },
  { label: 'Syne', value: 'Syne', isDisplay: true },
  // Standard fonts
  { label: 'Inter', value: 'Inter', isDisplay: false },
  { label: 'DM Sans', value: 'DM Sans', isDisplay: false },
  { label: 'Poppins', value: 'Poppins', isDisplay: false },
  { label: 'Montserrat', value: 'Montserrat', isDisplay: false },
  { label: 'Playfair', value: 'Playfair Display', isDisplay: false },
];

// Get text shadow CSS by preset value
export const getTextShadowCSS = (value: string): string => {
  const preset = textShadowPresets.find(p => p.value === value);
  return preset?.css || 'none';
};

// Convert gradient value to CSS string
export const gradientToCSS = (gradient: GradientPreset['gradient']): string => {
  const stopsStr = gradient.stops
    .sort((a, b) => a.position - b.position)
    .map(s => `${s.color} ${s.position}%`)
    .join(', ');
  
  if (gradient.type === 'radial') {
    return `radial-gradient(circle, ${stopsStr})`;
  }
  return `linear-gradient(${gradient.angle}deg, ${stopsStr})`;
};
