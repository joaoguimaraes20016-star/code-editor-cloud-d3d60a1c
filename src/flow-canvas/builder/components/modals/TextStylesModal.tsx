import React, { useState } from 'react';
import { Type, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TextStylesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset?: (preset: TextPreset) => void;
  currentSettings?: {
    lineHeight?: number;
    letterSpacing?: number;
  };
  onSettingsChange?: (settings: { lineHeight?: number; letterSpacing?: number }) => void;
}

export interface TextPreset {
  name: string;
  size: string;
  weight: 'normal' | 'medium' | 'semibold' | 'bold';
  tag: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

const textPresets: TextPreset[] = [
  { name: 'Heading 1', size: '3rem', weight: 'bold', tag: 'h1' },
  { name: 'Heading 2', size: '2.25rem', weight: 'semibold', tag: 'h2' },
  { name: 'Heading 3', size: '1.5rem', weight: 'semibold', tag: 'h3' },
  { name: 'Body Large', size: '1.125rem', weight: 'normal', tag: 'p' },
  { name: 'Body', size: '1rem', weight: 'normal', tag: 'p' },
  { name: 'Caption', size: '0.875rem', weight: 'normal', tag: 'span' },
];

const weightMap: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const TextStylesModal: React.FC<TextStylesModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset,
  currentSettings,
  onSettingsChange,
}) => {
  const [lineHeight, setLineHeight] = useState(currentSettings?.lineHeight || 160);
  const [letterSpacing, setLetterSpacing] = useState(currentSettings?.letterSpacing || 0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handlePresetClick = (preset: TextPreset) => {
    setSelectedPreset(preset.name);
    if (onApplyPreset) {
      onApplyPreset(preset);
      toast.success(`${preset.name} style applied`);
    }
  };

  const handleLineHeightChange = (value: number[]) => {
    setLineHeight(value[0]);
    onSettingsChange?.({ lineHeight: value[0], letterSpacing });
  };

  const handleLetterSpacingChange = (value: number[]) => {
    setLetterSpacing(value[0]);
    onSettingsChange?.({ lineHeight, letterSpacing: value[0] });
  };

  const handleApplySettings = () => {
    onSettingsChange?.({ lineHeight, letterSpacing });
    toast.success('Typography settings applied');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Type className="w-5 h-5 text-builder-accent" />
            Text Styles
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Typography Scale */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-builder-text">Typography Scale</label>
            <p className="text-xs text-builder-text-muted">Click a preset to apply it to selected text elements</p>
            <div className="space-y-2">
              {textPresets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 bg-builder-bg border rounded-lg transition-all",
                    selectedPreset === preset.name 
                      ? "border-builder-accent bg-builder-accent/5" 
                      : "border-builder-border hover:border-builder-accent/50"
                  )}
                >
                  <div className="flex-1 text-left">
                    <span
                      className="block text-builder-text"
                      style={{ 
                        fontSize: preset.size, 
                        fontWeight: weightMap[preset.weight],
                        lineHeight: 1.2
                      }}
                    >
                      {preset.name === 'Heading 1' ? 'Main Title' :
                       preset.name === 'Heading 2' ? 'Section Title' :
                       preset.name === 'Heading 3' ? 'Subsection' :
                       preset.name === 'Body Large' ? 'Lead paragraph text' :
                       preset.name === 'Body' ? 'Regular paragraph text' :
                       'Small helper text'}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <span className="text-xs font-medium text-builder-text-muted">{preset.name}</span>
                      <span className="text-xs text-builder-text-dim block">{preset.size}</span>
                    </div>
                    {selectedPreset === preset.name && (
                      <Check className="w-4 h-4 text-builder-accent" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Global Settings */}
          <div className="space-y-4 pt-4 border-t border-builder-border">
            <label className="text-sm font-medium text-builder-text">Global Text Settings</label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-builder-text-muted">Line Height</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-builder-text w-8 text-right">{(lineHeight / 100).toFixed(1)}</span>
                  <Slider 
                    value={[lineHeight]} 
                    onValueChange={handleLineHeightChange}
                    max={200} 
                    min={100} 
                    step={10} 
                    className="w-24" 
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-builder-text-muted">Letter Spacing</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-builder-text w-8 text-right">{letterSpacing}px</span>
                  <Slider 
                    value={[letterSpacing]} 
                    onValueChange={handleLetterSpacingChange}
                    max={10} 
                    min={-5} 
                    step={1} 
                    className="w-24" 
                  />
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleApplySettings}
              className="w-full bg-builder-accent text-white hover:brightness-110"
            >
              Apply Global Settings
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-builder-text-dim text-center">
            Presets apply to selected elements. Global settings affect all text in your funnel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
