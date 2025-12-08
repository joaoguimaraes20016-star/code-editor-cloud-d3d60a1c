import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type,
  Palette,
  Box
} from 'lucide-react';

export interface ElementStyle {
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderRadius?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  margin?: { top: number; right: number; bottom: number; left: number };
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

interface ElementStyleEditorProps {
  elementType: 'headline' | 'subtext' | 'button' | 'input' | 'image';
  style: ElementStyle;
  onChange: (style: ElementStyle) => void;
}

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair' },
  { value: 'Space Grotesk', label: 'Space' },
];

const COLOR_PRESETS = [
  '#ffffff', '#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#262626', '#0a0a0a',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

export function ElementStyleEditor({ elementType, style, onChange }: ElementStyleEditorProps) {
  const updateStyle = <K extends keyof ElementStyle>(key: K, value: ElementStyle[K]) => {
    onChange({ ...style, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Box className="h-4 w-4" />
        <span className="capitalize">{elementType} Style</span>
      </div>

      <Tabs defaultValue="typography">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="typography" className="text-xs">
            <Type className="h-3.5 w-3.5 mr-1" />
            Type
          </TabsTrigger>
          <TabsTrigger value="colors" className="text-xs">
            <Palette className="h-3.5 w-3.5 mr-1" />
            Color
          </TabsTrigger>
          <TabsTrigger value="spacing" className="text-xs">
            <Box className="h-3.5 w-3.5 mr-1" />
            Space
          </TabsTrigger>
        </TabsList>

        <TabsContent value="typography" className="space-y-4 mt-4">
          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Font Size</Label>
              <span className="text-xs text-muted-foreground">{style.fontSize || 16}px</span>
            </div>
            <Slider
              value={[style.fontSize || 16]}
              onValueChange={([value]) => updateStyle('fontSize', value)}
              min={10}
              max={72}
              step={1}
            />
          </div>

          {/* Font Weight */}
          <div className="space-y-2">
            <Label className="text-xs">Font Weight</Label>
            <div className="grid grid-cols-4 gap-1">
              {(['normal', 'medium', 'semibold', 'bold'] as const).map((weight) => (
                <Button
                  key={weight}
                  variant={style.fontWeight === weight ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs capitalize h-8"
                  onClick={() => updateStyle('fontWeight', weight)}
                >
                  {weight}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <Label className="text-xs">Font Family</Label>
            <div className="grid grid-cols-2 gap-1">
              {FONT_FAMILIES.map((font) => (
                <Button
                  key={font.value}
                  variant={style.fontFamily === font.value ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-8"
                  style={{ fontFamily: font.value }}
                  onClick={() => updateStyle('fontFamily', font.value)}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Text Align */}
          <div className="space-y-2">
            <Label className="text-xs">Text Align</Label>
            <div className="flex gap-1">
              <Button
                variant={style.textAlign === 'left' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => updateStyle('textAlign', 'left')}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={style.textAlign === 'center' || !style.textAlign ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => updateStyle('textAlign', 'center')}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={style.textAlign === 'right' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => updateStyle('textAlign', 'right')}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4 mt-4">
          {/* Text Color */}
          <div className="space-y-2">
            <Label className="text-xs">Text Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.slice(0, 8).map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-7 h-7 rounded-md border-2 transition-all",
                    style.color === color 
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background" 
                      : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateStyle('color', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={style.color || '#ffffff'}
              onChange={(e) => updateStyle('color', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Background Color (for buttons) */}
          {(elementType === 'button' || elementType === 'input') && (
            <div className="space-y-2">
              <Label className="text-xs">Background Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.slice(8).map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-md border-2 transition-all",
                      style.backgroundColor === color 
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background" 
                        : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => updateStyle('backgroundColor', color)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={style.backgroundColor || '#3b82f6'}
                onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                className="h-8 w-full"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="spacing" className="space-y-4 mt-4">
          {/* Border Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Corner Radius</Label>
              <span className="text-xs text-muted-foreground">{style.borderRadius || 8}px</span>
            </div>
            <Slider
              value={[style.borderRadius || 8]}
              onValueChange={([value]) => updateStyle('borderRadius', value)}
              min={0}
              max={32}
              step={2}
            />
          </div>

          {/* Shadow */}
          <div className="space-y-2">
            <Label className="text-xs">Shadow</Label>
            <div className="grid grid-cols-5 gap-1">
              {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((shadow) => (
                <Button
                  key={shadow}
                  variant={style.shadow === shadow ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => updateStyle('shadow', shadow)}
                >
                  {shadow}
                </Button>
              ))}
            </div>
          </div>

          {/* Padding */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Padding</Label>
              <span className="text-xs text-muted-foreground">
                {style.padding?.top || 12}px
              </span>
            </div>
            <Slider
              value={[style.padding?.top || 12]}
              onValueChange={([value]) => updateStyle('padding', { 
                top: value, 
                right: value, 
                bottom: value, 
                left: value 
              })}
              min={0}
              max={48}
              step={4}
            />
          </div>

          {/* Margin Top */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Margin Top</Label>
              <span className="text-xs text-muted-foreground">
                {style.margin?.top || 0}px
              </span>
            </div>
            <Slider
              value={[style.margin?.top || 0]}
              onValueChange={([value]) => updateStyle('margin', { 
                ...style.margin,
                top: value,
                right: style.margin?.right || 0,
                bottom: style.margin?.bottom || 0,
                left: style.margin?.left || 0,
              })}
              min={0}
              max={64}
              step={4}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}