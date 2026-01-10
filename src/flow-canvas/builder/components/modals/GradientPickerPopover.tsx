import React, { useState, useEffect } from 'react';
import { Palette, Plus, Trash2, RotateCw } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientValue {
  type: 'linear' | 'radial';
  angle: number;
  stops: GradientStop[];
}

interface GradientPickerPopoverProps {
  children: React.ReactNode;
  value: GradientValue | null;
  onChange: (gradient: GradientValue) => void;
}

// Unified gradient presets - optimized for dark themes and high contrast
export const presetGradients: GradientValue[] = [
  // Text/headline gradients
  { type: 'linear', angle: 180, stops: [{ color: '#ffffff', position: 0 }, { color: '#9ca3af', position: 100 }] },
  { type: 'linear', angle: 135, stops: [{ color: '#ef4444', position: 0 }, { color: '#f97316', position: 50 }, { color: '#fbbf24', position: 100 }] },
  { type: 'linear', angle: 135, stops: [{ color: '#fbbf24', position: 0 }, { color: '#f59e0b', position: 50 }, { color: '#d97706', position: 100 }] },
  // Background gradients
  { type: 'linear', angle: 135, stops: [{ color: '#8b5cf6', position: 0 }, { color: '#a855f7', position: 50 }, { color: '#d946ef', position: 100 }] },
  { type: 'linear', angle: 135, stops: [{ color: '#06b6d4', position: 0 }, { color: '#3b82f6', position: 50 }, { color: '#8b5cf6', position: 100 }] },
  { type: 'linear', angle: 135, stops: [{ color: '#f97316', position: 0 }, { color: '#ef4444', position: 50 }, { color: '#ec4899', position: 100 }] },
  { type: 'linear', angle: 180, stops: [{ color: '#374151', position: 0 }, { color: '#1f2937', position: 100 }] },
  { type: 'linear', angle: 135, stops: [{ color: '#10b981', position: 0 }, { color: '#22d3ee', position: 100 }] },
  { type: 'radial', angle: 0, stops: [{ color: '#1e3a8a', position: 0 }, { color: '#0f172a', position: 100 }] },
];

export const gradientToCSS = (gradient: GradientValue): string => {
  const stopsStr = gradient.stops
    .sort((a, b) => a.position - b.position)
    .map(s => `${s.color} ${s.position}%`)
    .join(', ');
  
  if (gradient.type === 'radial') {
    return `radial-gradient(circle, ${stopsStr})`;
  }
  return `linear-gradient(${gradient.angle}deg, ${stopsStr})`;
};

export const defaultGradient: GradientValue = {
  type: 'linear',
  angle: 135,
  stops: [
    { color: '#8B5CF6', position: 0 },
    { color: '#EC4899', position: 100 },
  ],
};

// Reusable Gradient Editor component (no popover wrapper)
interface GradientEditorProps {
  value: GradientValue;
  onChange: (gradient: GradientValue) => void;
  compact?: boolean; // For use in toolbar
}

export const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [gradient, setGradient] = useState<GradientValue>(value || defaultGradient);

  // Sync with external value when it changes
  useEffect(() => {
    if (value) {
      setGradient(value);
    }
  }, [value]);

  const updateGradient = (updates: Partial<GradientValue>) => {
    const newGradient = { ...gradient, ...updates };
    setGradient(newGradient);
    onChange(newGradient);
  };

  const updateStop = (index: number, updates: Partial<GradientStop>) => {
    const newStops = [...gradient.stops];
    newStops[index] = { ...newStops[index], ...updates };
    updateGradient({ stops: newStops });
  };

  const addStop = () => {
    if (gradient.stops.length >= 5) return;
    const newStops = [...gradient.stops, { color: '#FFFFFF', position: 50 }];
    updateGradient({ stops: newStops });
  };

  const removeStop = (index: number) => {
    if (gradient.stops.length <= 2) return;
    const newStops = gradient.stops.filter((_, i) => i !== index);
    updateGradient({ stops: newStops });
  };

  const applyPreset = (preset: GradientValue) => {
    setGradient(preset);
    onChange(preset);
  };

  return (
    <div className="space-y-3">
      {/* Preview - Show as text gradient, not box fill */}
      <div 
        className={cn(
          "w-full rounded-lg border border-[hsl(var(--builder-border))] flex items-center justify-center font-bold",
          compact ? "h-10 text-lg" : "h-16 text-2xl"
        )}
        style={{ 
          background: gradientToCSS(gradient),
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        } as React.CSSProperties}
      >
        Aa
      </div>

      {/* Type & Angle */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[hsl(var(--builder-text-muted))] mb-1 block">Type</label>
          <Select value={gradient.type} onValueChange={(v) => updateGradient({ type: v as 'linear' | 'radial' })}>
            <SelectTrigger className="h-7 text-xs bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))]">
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {gradient.type === 'linear' && (
          <div>
            <label className="text-xs text-[hsl(var(--builder-text-muted))] mb-1 block">Angle</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={gradient.angle}
                onChange={(e) => updateGradient({ angle: parseInt(e.target.value) || 0 })}
                className="h-7 text-xs bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))]"
                min={0}
                max={360}
              />
              <RotateCw className="w-3.5 h-3.5 text-[hsl(var(--builder-text-muted))]" />
            </div>
          </div>
        )}
      </div>

      {/* Color Stops */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-[hsl(var(--builder-text-muted))]">Color Stops</label>
          <button
            onClick={addStop}
            disabled={gradient.stops.length >= 5}
            className="p-1 rounded text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-accent))] hover:bg-[hsl(var(--builder-surface-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {gradient.stops.map((stop, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(index, { color: e.target.value })}
                className="w-7 h-7 rounded border border-[hsl(var(--builder-border))] cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <Slider
                value={[stop.position]}
                onValueChange={([v]) => updateStop(index, { position: v })}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-xs text-[hsl(var(--builder-text-muted))] w-7">{stop.position}%</span>
            <button
              onClick={() => removeStop(index)}
              disabled={gradient.stops.length <= 2}
              className="p-0.5 rounded text-[hsl(var(--builder-text-muted))] hover:text-red-400 hover:bg-[hsl(var(--builder-surface-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div>
        <label className="text-xs text-[hsl(var(--builder-text-muted))] mb-1.5 block">Presets</label>
        <div className={cn("grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-3")}>
          {presetGradients.slice(0, compact ? 8 : 9).map((preset, index) => (
            <button
              key={index}
              onClick={() => applyPreset(preset)}
              className={cn(
                "rounded border border-[hsl(var(--builder-border))] hover:ring-2 hover:ring-[hsl(var(--builder-accent))] transition-all",
                compact ? "h-5" : "h-8"
              )}
              style={{ background: gradientToCSS(preset) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const GradientPickerPopover: React.FC<GradientPickerPopoverProps> = ({
  children,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-3 bg-[hsl(220,22%,7%)] border-[hsl(220,18%,14%)] text-white" 
        align="end"
        sideOffset={5}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[hsl(220,18%,14%)]">
          <Palette className="w-4 h-4 text-[hsl(275,70%,55%)]" />
          <span className="text-sm font-medium text-white">Gradient Editor</span>
        </div>

        <GradientEditor 
          value={value || defaultGradient} 
          onChange={onChange} 
        />
      </PopoverContent>
    </Popover>
  );
};
