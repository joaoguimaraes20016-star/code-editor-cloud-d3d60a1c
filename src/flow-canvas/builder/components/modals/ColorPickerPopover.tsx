import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Pipette, Hash, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ColorPickerPopoverProps {
  children: React.ReactNode;
  color: string;
  onChange: (color: string) => void;
  showGradientOption?: boolean;
  onGradientClick?: () => void;
}

// Unified color presets - dark-theme-friendly, organized by type
const presetColors = [
  // Whites & Blacks (always visible on dark bg)
  '#FFFFFF', '#F9FAFB', '#E5E7EB', '#9CA3AF', '#4B5563', '#111827',
  // Brand Purples
  '#8B5CF6', '#7C3AED', '#6D28D9', '#A78BFA', '#C4B5FD', '#D946EF',
  // Warm (Red/Orange/Yellow)
  '#EF4444', '#DC2626', '#F97316', '#F59E0B', '#FBBF24', '#FCD34D',
  // Cool (Blue/Cyan/Green)
  '#3B82F6', '#2563EB', '#06B6D4', '#10B981', '#22C55E', '#34D399',
  // Pinks/Magentas
  '#EC4899', '#F472B6', '#FB7185',
];

// Check for EyeDropper API support
const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  children,
  color,
  onChange,
  showGradientOption = false,
  onGradientClick,
}) => {
  const [inputValue, setInputValue] = useState(color);
  const [isOpen, setIsOpen] = useState(false);

  // Sync input value with external color prop
  useEffect(() => {
    setInputValue(color);
  }, [color]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value) || /^#[0-9A-Fa-f]{3}$/.test(value)) {
      onChange(value);
    }
  };

  const handlePresetClick = (preset: string) => {
    setInputValue(preset);
    onChange(preset);
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onChange(value);
  };

  // Eyedropper handler using browser EyeDropper API
  const handleEyedropper = useCallback(async () => {
    if (!supportsEyeDropper) {
      toast.error('Eyedropper not supported in this browser');
      return;
    }
    
    try {
      // @ts-ignore - EyeDropper API is not yet in TypeScript types
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const pickedColor = result.sRGBHex;
      setInputValue(pickedColor);
      onChange(pickedColor);
      toast.success(`Color picked: ${pickedColor}`);
    } catch (e) {
      // User canceled the eyedropper
      console.log('Eyedropper canceled');
    }
  }, [onChange]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 bg-[hsl(220,22%,7%)] border-[hsl(220,18%,14%)] text-white" 
        align="end"
        sideOffset={5}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[hsl(220,18%,14%)]">
          <Palette className="w-4 h-4 text-[hsl(275,70%,55%)]" />
          <span className="text-sm font-medium text-white">Pick Color</span>
        </div>

        {/* Color Input */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-builder-text-muted" />
            <Input
              value={inputValue.replace('#', '')}
              onChange={(e) => handleInputChange({ ...e, target: { ...e.target, value: `#${e.target.value}` } } as React.ChangeEvent<HTMLInputElement>)}
              className="builder-input pl-7 font-mono text-xs uppercase"
              placeholder="000000"
              maxLength={6}
            />
          </div>
          <div className="relative">
            <input
              type="color"
              value={color.startsWith('#') ? color : '#000000'}
              onChange={handleColorInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div 
              className="w-9 h-9 rounded-lg border border-builder-border cursor-pointer flex items-center justify-center hover:ring-2 hover:ring-builder-accent transition-all"
              style={{ backgroundColor: color }}
            >
              <Pipette className="w-4 h-4 text-white mix-blend-difference" />
            </div>
          </div>
          
          {/* Eyedropper Button */}
          {supportsEyeDropper && (
            <button
              type="button"
              onClick={handleEyedropper}
              className="w-9 h-9 rounded-lg border border-builder-border bg-builder-surface-hover cursor-pointer flex items-center justify-center hover:ring-2 hover:ring-builder-accent hover:bg-builder-accent/10 transition-all"
              title="Pick color from screen"
            >
              <Pipette className="w-4 h-4 text-builder-accent" />
            </button>
          )}
        </div>

        {/* Preset Colors Grid */}
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {presetColors.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                'w-8 h-8 rounded-md border transition-all hover:scale-110',
                color === preset 
                  ? 'ring-2 ring-builder-accent border-builder-accent' 
                  : 'border-builder-border hover:border-builder-text-muted'
              )}
              style={{ backgroundColor: preset }}
            >
              {color === preset && (
                <Check className="w-3 h-3 mx-auto text-white mix-blend-difference" />
              )}
            </button>
          ))}
        </div>

        {/* Gradient Option */}
        {showGradientOption && (
          <button
            onClick={() => {
              onGradientClick?.();
              setIsOpen(false);
            }}
            className="w-full py-2 px-3 rounded-lg text-sm font-medium text-builder-text-muted hover:text-builder-text hover:bg-builder-surface-hover transition-colors flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EC4899 50%, #8B5CF6 100%)',
            }}
          >
            <span className="text-white text-xs font-semibold">Use Gradient Instead</span>
          </button>
        )}

        {/* Transparent Option */}
        <button
          onClick={() => handlePresetClick('transparent')}
          className={cn(
            'w-full mt-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors border-2 border-dashed',
            color === 'transparent'
              ? 'border-builder-accent text-builder-accent'
              : 'border-builder-border text-builder-text-muted hover:border-builder-text-muted hover:text-builder-text'
          )}
        >
          Transparent
        </button>
      </PopoverContent>
    </Popover>
  );
};
