import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FunnelStep } from '@/pages/FunnelEditor';
import { cn } from '@/lib/utils';

interface StepDesign {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  borderRadius?: number;
  padding?: number;
  imageUrl?: string;
  imageSize?: 'S' | 'M' | 'L' | 'XL';
  imagePosition?: 'top' | 'bottom' | 'background';
  // New gradient options
  useGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  // Image overlay options
  imageOverlay?: boolean;
  imageOverlayColor?: string;
  imageOverlayOpacity?: number;
}

interface DesignEditorProps {
  step: FunnelStep;
  design: StepDesign;
  onUpdateDesign: (design: StepDesign) => void;
  onOpenImagePicker: () => void;
}

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair' },
];

const COLOR_PRESETS = [
  '#0a0a0a', '#1a1a1a', '#2d2d2d', 
  '#ffffff', '#f5f5f5', '#e5e5e5',
  '#3b82f6', '#2563eb', '#1d4ed8',
  '#f59e0b', '#d97706', '#b45309',
  '#10b981', '#059669', '#047857',
  '#ef4444', '#dc2626', '#b91c1c',
];

const GRADIENT_DIRECTIONS = [
  { value: 'to bottom', label: 'Top to Bottom' },
  { value: 'to top', label: 'Bottom to Top' },
  { value: 'to right', label: 'Left to Right' },
  { value: 'to left', label: 'Right to Left' },
  { value: 'to bottom right', label: 'Diagonal ↘' },
  { value: 'to bottom left', label: 'Diagonal ↙' },
  { value: 'to top right', label: 'Diagonal ↗' },
  { value: 'to top left', label: 'Diagonal ↖' },
];

const GRADIENT_PRESETS = [
  { from: '#667eea', to: '#764ba2', label: 'Purple Dream' },
  { from: '#f093fb', to: '#f5576c', label: 'Pink Sunset' },
  { from: '#4facfe', to: '#00f2fe', label: 'Ocean Blue' },
  { from: '#43e97b', to: '#38f9d7', label: 'Fresh Mint' },
  { from: '#fa709a', to: '#fee140', label: 'Warm Glow' },
  { from: '#a8edea', to: '#fed6e3', label: 'Soft Pastel' },
  { from: '#ff0844', to: '#ffb199', label: 'Coral Fire' },
  { from: '#0f0c29', to: '#302b63', label: 'Dark Night' },
];

export function DesignEditor({ step, design, onUpdateDesign, onOpenImagePicker }: DesignEditorProps) {
  const updateField = (field: keyof StepDesign, value: any) => {
    onUpdateDesign({ ...design, [field]: value });
  };

  const applyGradientPreset = (from: string, to: string) => {
    onUpdateDesign({ 
      ...design, 
      useGradient: true, 
      gradientFrom: from, 
      gradientTo: to,
      gradientDirection: design.gradientDirection || 'to bottom'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">
          Design
        </h3>
        <p className="text-xs text-muted-foreground">
          Customize this page's appearance
        </p>
      </div>

      {/* Background Type Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Use Gradient Background</Label>
          <Switch
            checked={design.useGradient || false}
            onCheckedChange={(checked) => updateField('useGradient', checked)}
          />
        </div>
      </div>

      {/* Solid Background Color */}
      {!design.useGradient && (
        <div className="space-y-3">
          <Label className="text-xs">Background Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.slice(0, 6).map((color) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 transition-all",
                  design.backgroundColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                )}
                style={{ backgroundColor: color }}
                onClick={() => updateField('backgroundColor', color)}
              />
            ))}
          </div>
          <Input
            type="color"
            value={design.backgroundColor || '#0a0a0a'}
            onChange={(e) => updateField('backgroundColor', e.target.value)}
            className="h-8 w-full"
          />
        </div>
      )}

      {/* Gradient Controls */}
      {design.useGradient && (
        <div className="space-y-4 p-3 bg-secondary/50 rounded-lg">
          <Label className="text-xs font-medium">Gradient Presets</Label>
          <div className="grid grid-cols-4 gap-2">
            {GRADIENT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                className={cn(
                  "w-full h-8 rounded-md border-2 transition-all",
                  design.gradientFrom === preset.from && design.gradientTo === preset.to
                    ? "ring-2 ring-primary ring-offset-1"
                    : "border-border"
                )}
                style={{ 
                  background: `linear-gradient(to right, ${preset.from}, ${preset.to})` 
                }}
                onClick={() => applyGradientPreset(preset.from, preset.to)}
                title={preset.label}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">From</Label>
              <Input
                type="color"
                value={design.gradientFrom || '#667eea'}
                onChange={(e) => updateField('gradientFrom', e.target.value)}
                className="h-8 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To</Label>
              <Input
                type="color"
                value={design.gradientTo || '#764ba2'}
                onChange={(e) => updateField('gradientTo', e.target.value)}
                className="h-8 w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Direction</Label>
            <Select
              value={design.gradientDirection || 'to bottom'}
              onValueChange={(value) => updateField('gradientDirection', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADIENT_DIRECTIONS.map((dir) => (
                  <SelectItem key={dir.value} value={dir.value}>
                    {dir.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gradient Preview */}
          <div 
            className="h-16 rounded-lg border border-border"
            style={{
              background: `linear-gradient(${design.gradientDirection || 'to bottom'}, ${design.gradientFrom || '#667eea'}, ${design.gradientTo || '#764ba2'})`
            }}
          />
        </div>
      )}

      {/* Text Color */}
      <div className="space-y-3">
        <Label className="text-xs">Text Color</Label>
        <div className="flex flex-wrap gap-2">
          {['#ffffff', '#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#0a0a0a'].map((color) => (
            <button
              key={color}
              className={cn(
                "w-8 h-8 rounded-lg border-2 transition-all",
                design.textColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
              )}
              style={{ backgroundColor: color }}
              onClick={() => updateField('textColor', color)}
            />
          ))}
        </div>
      </div>

      {/* Button Color */}
      <div className="space-y-3">
        <Label className="text-xs">Button Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.slice(6).map((color) => (
            <button
              key={color}
              className={cn(
                "w-8 h-8 rounded-lg border-2 transition-all",
                design.buttonColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
              )}
              style={{ backgroundColor: color }}
              onClick={() => updateField('buttonColor', color)}
            />
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <Label className="text-xs">Font Size</Label>
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          {FONT_SIZES.map((size) => (
            <Button
              key={size.value}
              variant={design.fontSize === size.value ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-8"
              onClick={() => updateField('fontSize', size.value)}
            >
              {size.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-3">
        <Label className="text-xs">Font</Label>
        <div className="grid grid-cols-2 gap-1">
          {FONT_FAMILIES.map((font) => (
            <Button
              key={font.value}
              variant={design.fontFamily === font.value ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => updateField('fontFamily', font.value)}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Corner Roundness</Label>
          <span className="text-xs text-muted-foreground">{design.borderRadius || 12}px</span>
        </div>
        <Slider
          value={[design.borderRadius || 12]}
          onValueChange={([value]) => updateField('borderRadius', value)}
          min={0}
          max={32}
          step={2}
        />
      </div>

      {/* Image */}
      <div className="space-y-3">
        <Label className="text-xs">Page Image</Label>
        {design.imageUrl ? (
          <div className="relative">
            <img 
              src={design.imageUrl} 
              alt="Page" 
              className="w-full h-24 object-cover rounded-lg"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
              <Button size="sm" variant="secondary" onClick={onOpenImagePicker}>
                Change
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateField('imageUrl', undefined)}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full h-24 border-dashed"
            onClick={onOpenImagePicker}
          >
            Add Image
          </Button>
        )}

        {design.imageUrl && (
          <>
            <Label className="text-xs mt-3">Image Size</Label>
            <div className="flex gap-1 p-1 bg-secondary rounded-lg">
              {(['S', 'M', 'L', 'XL'] as const).map((size) => (
                <Button
                  key={size}
                  variant={design.imageSize === size ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8"
                  onClick={() => updateField('imageSize', size)}
                >
                  {size}
                </Button>
              ))}
            </div>

            <Label className="text-xs mt-3">Image Position</Label>
            <div className="flex gap-1 p-1 bg-secondary rounded-lg">
              {[
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
                { value: 'background', label: 'Background' },
              ].map((pos) => (
                <Button
                  key={pos.value}
                  variant={design.imagePosition === pos.value ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8"
                  onClick={() => updateField('imagePosition', pos.value as StepDesign['imagePosition'])}
                >
                  {pos.label}
                </Button>
              ))}
            </div>

            {/* Image Overlay */}
            {design.imagePosition === 'background' && (
              <div className="space-y-3 p-3 bg-secondary/50 rounded-lg mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Image Overlay</Label>
                  <Switch
                    checked={design.imageOverlay || false}
                    onCheckedChange={(checked) => updateField('imageOverlay', checked)}
                  />
                </div>
                
                {design.imageOverlay && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Overlay Color</Label>
                      <Input
                        type="color"
                        value={design.imageOverlayColor || '#000000'}
                        onChange={(e) => updateField('imageOverlayColor', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Opacity</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((design.imageOverlayOpacity || 0.5) * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[(design.imageOverlayOpacity || 0.5) * 100]}
                        onValueChange={([value]) => updateField('imageOverlayOpacity', value / 100)}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
