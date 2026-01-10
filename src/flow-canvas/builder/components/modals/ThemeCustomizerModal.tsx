import React from 'react';
import { Palette, Sun, Moon, Type as TypeIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    theme?: 'light' | 'dark';
    primary_color?: string;
    font_family?: string;
  };
  onUpdateSettings: (key: string, value: string) => void;
}

const presetColors = [
  { name: 'Cyan', value: '#00d4ff' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Blue', value: '#3b82f6' },
];

const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Raleway', label: 'Raleway' },
];

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Palette className="w-5 h-5 text-builder-accent" />
            Theme Customizer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Color Mode */}
          <div className="space-y-3">
            <Label className="text-builder-text">Color Mode</Label>
            <div className="flex gap-3">
              <button
                onClick={() => onUpdateSettings('theme', 'light')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
                  settings.theme === 'light' || !settings.theme
                    ? 'border-builder-accent bg-builder-accent/10'
                    : 'border-builder-border hover:border-builder-accent/50'
                )}
              >
                <Sun className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-builder-text">Light</span>
              </button>
              <button
                onClick={() => onUpdateSettings('theme', 'dark')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
                  settings.theme === 'dark'
                    ? 'border-builder-accent bg-builder-accent/10'
                    : 'border-builder-border hover:border-builder-accent/50'
                )}
              >
                <Moon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-builder-text">Dark</span>
              </button>
            </div>
          </div>

          {/* Primary Color */}
          <div className="space-y-3">
            <Label className="text-builder-text">Primary Color</Label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onUpdateSettings('primary_color', color.value)}
                  className={cn(
                    'w-10 h-10 rounded-lg border-2 transition-all',
                    settings.primary_color === color.value
                      ? 'border-builder-text scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg border border-builder-border" 
                style={{ backgroundColor: settings.primary_color || '#00d4ff' }}
              />
              <Input
                value={settings.primary_color || '#00d4ff'}
                onChange={(e) => onUpdateSettings('primary_color', e.target.value)}
                className="builder-input flex-1 font-mono text-sm"
                placeholder="#00d4ff"
              />
            </div>
          </div>

          {/* Font Family */}
          <div className="space-y-3">
            <Label className="text-builder-text flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-builder-text-muted" />
              Font Family
            </Label>
            <Select
              value={settings.font_family || 'Inter'}
              onValueChange={(value) => onUpdateSettings('font_family', value)}
            >
              <SelectTrigger className="builder-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-builder-surface border-builder-border">
                {fontOptions.map((font) => (
                  <SelectItem 
                    key={font.value} 
                    value={font.value}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div 
              className="p-4 bg-builder-bg rounded-lg text-center"
              style={{ fontFamily: settings.font_family || 'Inter' }}
            >
              <p className="text-lg font-semibold text-builder-text">The quick brown fox</p>
              <p className="text-sm text-builder-text-muted">jumps over the lazy dog</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
