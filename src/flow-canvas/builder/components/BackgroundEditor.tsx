import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon } from 'lucide-react';
import { ColorPickerPopover, GradientPickerPopover, gradientToCSS } from './modals';
import type { GradientValue } from './modals';

export type BackgroundType = 'solid' | 'gradient' | 'image';

export interface BackgroundValue {
  type: BackgroundType;
  color?: string;
  gradient?: GradientValue;
  imageUrl?: string;
}

interface BackgroundEditorProps {
  value: BackgroundValue;
  onChange: (value: BackgroundValue) => void;
  showImageOption?: boolean;
  className?: string;
}

const defaultGradient: GradientValue = {
  type: 'linear',
  angle: 135,
  stops: [
    { color: '#667eea', position: 0 },
    { color: '#764ba2', position: 100 }
  ]
};

// Parse gradient CSS string back to GradientValue
const parseGradientString = (gradientStr: string): GradientValue | null => {
  if (!gradientStr || !gradientStr.includes('gradient')) return null;
  
  const isRadial = gradientStr.includes('radial-gradient');
  const type = isRadial ? 'radial' : 'linear';
  
  let angle = 135;
  const angleMatch = gradientStr.match(/(\d+)deg/);
  if (angleMatch) {
    angle = parseInt(angleMatch[1], 10);
  }
  
  const colorMatches = gradientStr.match(/(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgba?\([^)]+\)|hsla?\([^)]+\))\s*(\d+%)?/g);
  const stops: Array<{ color: string; position: number }> = [];
  
  if (colorMatches) {
    colorMatches.forEach((match, index) => {
      const colorMatch = match.match(/(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgba?\([^)]+\)|hsla?\([^)]+\))/);
      const positionMatch = match.match(/(\d+)%/);
      const color = colorMatch ? colorMatch[1] : '#8B5CF6';
      const position = positionMatch ? parseInt(positionMatch[1], 10) : (index * 100) / Math.max(colorMatches.length - 1, 1);
      stops.push({ color, position });
    });
  }
  
  if (stops.length < 2) {
    stops.push({ color: '#8B5CF6', position: 0 }, { color: '#EC4899', position: 100 });
  }
  
  return { type, angle, stops };
};

export const BackgroundEditor: React.FC<BackgroundEditorProps> = ({
  value,
  onChange,
  showImageOption = true,
  className
}) => {
  const [bgType, setBgType] = useState<BackgroundType>(value.type || 'solid');

  // Sync local state when value changes externally
  useEffect(() => {
    if (value.type && value.type !== bgType) {
      setBgType(value.type);
    }
  }, [value.type]);

  const handleTypeChange = (newType: BackgroundType) => {
    setBgType(newType);
    
    const newValue: BackgroundValue = { type: newType };
    
    if (newType === 'solid') {
      newValue.color = value.color || '#ffffff';
    } else if (newType === 'gradient') {
      newValue.gradient = value.gradient || defaultGradient;
    } else if (newType === 'image') {
      newValue.imageUrl = value.imageUrl || '';
    }
    
    onChange(newValue);
  };

  const handleColorChange = (color: string) => {
    onChange({ ...value, type: 'solid', color });
  };

  const handleGradientChange = (gradient: GradientValue) => {
    onChange({ ...value, type: 'gradient', gradient });
  };

  const handleImageUrlChange = (imageUrl: string) => {
    onChange({ ...value, type: 'image', imageUrl });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Background Type Toggle */}
      <div className="toggle-pill w-full">
        <button 
          onClick={() => handleTypeChange('solid')}
          className={cn(
            'toggle-pill-option flex-1 text-center',
            bgType === 'solid' ? 'toggle-pill-option-active' : 'toggle-pill-option-inactive'
          )}
        >
          Solid
        </button>
        <button 
          onClick={() => handleTypeChange('gradient')}
          className={cn(
            'toggle-pill-option flex-1 text-center',
            bgType === 'gradient' ? 'toggle-pill-option-active' : 'toggle-pill-option-inactive'
          )}
        >
          Gradient
        </button>
        {showImageOption && (
          <button 
            onClick={() => handleTypeChange('image')}
            className={cn(
              'toggle-pill-option flex-1 text-center',
              bgType === 'image' ? 'toggle-pill-option-active' : 'toggle-pill-option-inactive'
            )}
          >
            Image
          </button>
        )}
      </div>

      {/* Solid Color Picker */}
      {bgType === 'solid' && (
        <div 
          className="flex items-center justify-between"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-builder-text-muted">Color</span>
          <ColorPickerPopover
            color={value.color || '#ffffff'}
            onChange={handleColorChange}
            showGradientOption
            onGradientClick={() => handleTypeChange('gradient')}
          >
            <button 
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-builder-surface-hover hover:bg-builder-surface-active transition-colors"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div 
                className="w-6 h-6 rounded-md border border-builder-border" 
                style={{ backgroundColor: value.color || '#ffffff' }}
              />
              <span className="text-xs text-builder-text font-mono">
                {value.color === 'transparent' ? 'None' : (value.color || '#ffffff')}
              </span>
            </button>
          </ColorPickerPopover>
        </div>
      )}

      {/* Gradient Picker */}
      {bgType === 'gradient' && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GradientPickerPopover
            value={value.gradient || defaultGradient}
            onChange={handleGradientChange}
          >
            <button 
              className="w-full h-12 rounded-lg border border-builder-border hover:ring-2 hover:ring-builder-accent transition-all"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ 
                background: value.gradient 
                  ? gradientToCSS(value.gradient) 
                  : 'linear-gradient(135deg, #667eea, #764ba2)' 
              }}
            >
              <span className="text-xs text-white font-medium drop-shadow-sm">
                Click to edit gradient
              </span>
            </button>
          </GradientPickerPopover>
        </div>
      )}

      {/* Image URL Input */}
      {bgType === 'image' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-builder-text-muted">Image URL</span>
          </div>
          <Input
            value={value.imageUrl || ''}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="builder-input text-xs"
          />
          {value.imageUrl && (
            <div 
              className="w-full h-20 rounded-lg border border-builder-border bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${value.imageUrl})` }}
            />
          )}
          {!value.imageUrl && (
            <div className="w-full h-20 rounded-lg border-2 border-dashed border-builder-border flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="w-6 h-6 text-builder-text-muted mx-auto mb-1" />
                <span className="text-xs text-builder-text-muted">No image set</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Utility to convert BackgroundValue to CSS
export const backgroundValueToCSS = (value: BackgroundValue): string => {
  if (!value) return 'transparent';
  
  switch (value.type) {
    case 'solid':
      return value.color || 'transparent';
    case 'gradient':
      return value.gradient ? gradientToCSS(value.gradient) : 'linear-gradient(135deg, #667eea, #764ba2)';
    case 'image':
      return value.imageUrl ? `url(${value.imageUrl})` : 'transparent';
    default:
      return 'transparent';
  }
};

export { parseGradientString };
