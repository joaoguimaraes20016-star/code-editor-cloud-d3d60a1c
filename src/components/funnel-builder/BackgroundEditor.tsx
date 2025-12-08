import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ImagePicker } from './ImagePicker';

export interface BackgroundSettings {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    from: string;
    to: string;
    direction: 'to-r' | 'to-l' | 'to-t' | 'to-b' | 'to-br' | 'to-bl' | 'to-tr' | 'to-tl';
  };
  image?: {
    url: string;
    overlay?: string;
    overlayOpacity?: number;
    size: 'cover' | 'contain' | 'auto';
    position: 'center' | 'top' | 'bottom';
  };
}

interface BackgroundEditorProps {
  settings: BackgroundSettings;
  onChange: (settings: BackgroundSettings) => void;
}

const GRADIENT_DIRECTIONS = [
  { value: 'to-r', label: '→' },
  { value: 'to-l', label: '←' },
  { value: 'to-t', label: '↑' },
  { value: 'to-b', label: '↓' },
  { value: 'to-br', label: '↘' },
  { value: 'to-bl', label: '↙' },
  { value: 'to-tr', label: '↗' },
  { value: 'to-tl', label: '↖' },
];

const COLOR_PRESETS = [
  '#0a0a0a', '#1a1a1a', '#2d2d2d', '#0f172a', '#1e1b4b', '#1e3a5f',
  '#ffffff', '#f5f5f5', '#e5e5e5', '#fef3c7', '#dbeafe', '#d1fae5',
];

export function BackgroundEditor({ settings, onChange }: BackgroundEditorProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);

  const updateSettings = (partial: Partial<BackgroundSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="space-y-4">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
        Background
      </Label>

      <Tabs 
        value={settings.type} 
        onValueChange={(v) => updateSettings({ type: v as BackgroundSettings['type'] })}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="solid">Solid</TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
        </TabsList>

        <TabsContent value="solid" className="space-y-3 mt-4">
          <Label className="text-xs">Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 transition-all",
                  settings.color === color 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : "border-border hover:border-primary/50"
                )}
                style={{ backgroundColor: color }}
                onClick={() => updateSettings({ color })}
              />
            ))}
          </div>
          <Input
            type="color"
            value={settings.color || '#0a0a0a'}
            onChange={(e) => updateSettings({ color: e.target.value })}
            className="h-10 w-full"
          />
        </TabsContent>

        <TabsContent value="gradient" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">From</Label>
              <Input
                type="color"
                value={settings.gradient?.from || '#1e1b4b'}
                onChange={(e) => updateSettings({
                  gradient: { 
                    ...settings.gradient, 
                    from: e.target.value,
                    to: settings.gradient?.to || '#0f172a',
                    direction: settings.gradient?.direction || 'to-br'
                  }
                })}
                className="h-10 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To</Label>
              <Input
                type="color"
                value={settings.gradient?.to || '#0f172a'}
                onChange={(e) => updateSettings({
                  gradient: { 
                    ...settings.gradient, 
                    to: e.target.value,
                    from: settings.gradient?.from || '#1e1b4b',
                    direction: settings.gradient?.direction || 'to-br'
                  }
                })}
                className="h-10 w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Direction</Label>
            <div className="grid grid-cols-4 gap-1">
              {GRADIENT_DIRECTIONS.map((dir) => (
                <Button
                  key={dir.value}
                  variant={settings.gradient?.direction === dir.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => updateSettings({
                    gradient: { 
                      ...settings.gradient!,
                      direction: dir.value as any
                    }
                  })}
                >
                  {dir.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div 
            className="h-20 rounded-lg border"
            style={{
              background: `linear-gradient(${settings.gradient?.direction?.replace('to-', 'to ').replace('-', ' ') || 'to bottom right'}, ${settings.gradient?.from || '#1e1b4b'}, ${settings.gradient?.to || '#0f172a'})`
            }}
          />
        </TabsContent>

        <TabsContent value="image" className="space-y-4 mt-4">
          {settings.image?.url ? (
            <div className="relative group">
              <div 
                className="h-24 rounded-lg bg-cover bg-center border"
                style={{ backgroundImage: `url(${settings.image.url})` }}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <Button size="sm" variant="secondary" onClick={() => setShowImagePicker(true)}>
                  Change
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => updateSettings({ image: undefined })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full h-24 border-dashed"
              onClick={() => setShowImagePicker(true)}
            >
              Choose Background Image
            </Button>
          )}

          {settings.image?.url && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Overlay Color</Label>
                <Input
                  type="color"
                  value={settings.image?.overlay || '#000000'}
                  onChange={(e) => updateSettings({
                    image: { ...settings.image!, overlay: e.target.value }
                  })}
                  className="h-8 w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Overlay Opacity</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((settings.image?.overlayOpacity || 0.5) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.image?.overlayOpacity || 0.5]}
                  onValueChange={([value]) => updateSettings({
                    image: { ...settings.image!, overlayOpacity: value }
                  })}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Size</Label>
                <div className="flex gap-1">
                  {(['cover', 'contain', 'auto'] as const).map((size) => (
                    <Button
                      key={size}
                      variant={settings.image?.size === size ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => updateSettings({
                        image: { ...settings.image!, size }
                      })}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ImagePicker
        open={showImagePicker}
        onOpenChange={setShowImagePicker}
        onSelect={(url) => {
          updateSettings({
            type: 'image',
            image: {
              url,
              overlay: '#000000',
              overlayOpacity: 0.5,
              size: 'cover',
              position: 'center',
            }
          });
        }}
      />
    </div>
  );
}