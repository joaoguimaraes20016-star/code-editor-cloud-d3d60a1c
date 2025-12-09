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
  // Background gradient options
  useGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  // Image overlay options
  imageOverlay?: boolean;
  imageOverlayColor?: string;
  imageOverlayOpacity?: number;
  // Button gradient options
  useButtonGradient?: boolean;
  buttonGradientFrom?: string;
  buttonGradientTo?: string;
  buttonGradientDirection?: string;
  // Button animation options
  buttonAnimation?: 'none' | 'fade' | 'slide-up' | 'bounce' | 'scale';
  buttonAnimationDuration?: number;
  // Button hover effect
  buttonHoverEffect?: 'none' | 'glow' | 'lift' | 'pulse' | 'shine';
  // Option card styling (multi-choice)
  optionCardBg?: string;
  optionCardBorder?: string;
  optionCardBorderWidth?: number;
  optionCardSelectedBg?: string;
  optionCardSelectedBorder?: string;
  optionCardHoverEffect?: 'none' | 'scale' | 'glow' | 'lift';
  optionCardRadius?: number;
  // Input/Textarea styling (text_question)
  inputBg?: string;
  inputTextColor?: string;
  inputBorder?: string;
  inputBorderWidth?: number;
  inputRadius?: number;
  inputPlaceholderColor?: string;
  inputFocusBorder?: string;
  inputShowIcon?: boolean;
}

interface DesignEditorProps {
  step: FunnelStep;
  design: StepDesign;
  onUpdateDesign: (design: StepDesign) => void;
  onOpenImagePicker: () => void;
  highlightedSection?: string | null;
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

const BUTTON_ANIMATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade In' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'scale', label: 'Scale' },
];

const BUTTON_HOVER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'glow', label: 'Glow' },
  { value: 'lift', label: 'Lift' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'shine', label: 'Shine' },
];

const OPTION_HOVER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'scale', label: 'Scale' },
  { value: 'glow', label: 'Glow' },
  { value: 'lift', label: 'Lift' },
];

export function DesignEditor({ step, design, onUpdateDesign, onOpenImagePicker, highlightedSection }: DesignEditorProps) {
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

  const isHighlighted = (section: string) => highlightedSection === section || highlightedSection?.includes(section);

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
      <div id="editor-section-background" className={cn("space-y-3 p-3 -mx-3 rounded-lg transition-colors", isHighlighted('background') && "bg-primary/10 ring-1 ring-primary/30")}>
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

      {/* Button Styling Section */}
      <div id="editor-section-button-styling" className={cn("space-y-4 border-t pt-4 p-3 -mx-3 rounded-lg transition-colors", isHighlighted('button') && "bg-primary/10 ring-1 ring-primary/30")}>
        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          Button Styling
        </h4>
        
        {/* Button Gradient Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Use Button Gradient</Label>
          <Switch
            checked={design.useButtonGradient || false}
            onCheckedChange={(checked) => updateField('useButtonGradient', checked)}
          />
        </div>

        {/* Solid Button Color */}
        {!design.useButtonGradient && (
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
            <Input
              type="color"
              value={design.buttonColor || '#3b82f6'}
              onChange={(e) => updateField('buttonColor', e.target.value)}
              className="h-8 w-full"
            />
          </div>
        )}

        {/* Button Gradient Controls */}
        {design.useButtonGradient && (
          <div className="space-y-4 p-3 bg-secondary/50 rounded-lg">
            <Label className="text-xs font-medium">Button Gradient Presets</Label>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className={cn(
                    "w-full h-8 rounded-md border-2 transition-all",
                    design.buttonGradientFrom === preset.from && design.buttonGradientTo === preset.to
                      ? "ring-2 ring-primary ring-offset-1"
                      : "border-border"
                  )}
                  style={{ 
                    background: `linear-gradient(to right, ${preset.from}, ${preset.to})` 
                  }}
                  onClick={() => onUpdateDesign({ 
                    ...design, 
                    useButtonGradient: true,
                    buttonGradientFrom: preset.from, 
                    buttonGradientTo: preset.to,
                    buttonGradientDirection: design.buttonGradientDirection || '135deg'
                  })}
                  title={preset.label}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">From</Label>
                <Input
                  type="color"
                  value={design.buttonGradientFrom || '#3b82f6'}
                  onChange={(e) => updateField('buttonGradientFrom', e.target.value)}
                  className="h-8 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">To</Label>
                <Input
                  type="color"
                  value={design.buttonGradientTo || '#1d4ed8'}
                  onChange={(e) => updateField('buttonGradientTo', e.target.value)}
                  className="h-8 w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Direction</Label>
              <Select
                value={design.buttonGradientDirection || '135deg'}
                onValueChange={(value) => updateField('buttonGradientDirection', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90deg">Horizontal →</SelectItem>
                  <SelectItem value="180deg">Vertical ↓</SelectItem>
                  <SelectItem value="135deg">Diagonal ↘</SelectItem>
                  <SelectItem value="45deg">Diagonal ↗</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Button Gradient Preview */}
            <div 
              className="h-10 rounded-lg flex items-center justify-center text-sm font-medium text-white"
              style={{
                background: `linear-gradient(${design.buttonGradientDirection || '135deg'}, ${design.buttonGradientFrom || '#3b82f6'}, ${design.buttonGradientTo || '#1d4ed8'})`
              }}
            >
              Button Preview
            </div>
          </div>
        )}

        {/* Button Text Color */}
        <div className="space-y-2">
          <Label className="text-xs">Button Text Color</Label>
          <div className="flex gap-2">
            {['#ffffff', '#000000', '#f5f5f5', '#0a0a0a'].map((color) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 transition-all",
                  design.buttonTextColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                )}
                style={{ backgroundColor: color }}
                onClick={() => updateField('buttonTextColor', color)}
              />
            ))}
          </div>
        </div>

        {/* Button Animation */}
        <div className="space-y-2">
          <Label className="text-xs">Button Appear Animation</Label>
          <div className="flex flex-wrap gap-1">
            {BUTTON_ANIMATION_OPTIONS.map((anim) => (
              <Button
                key={anim.value}
                variant={design.buttonAnimation === anim.value || (!design.buttonAnimation && anim.value === 'none') ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateField('buttonAnimation', anim.value)}
              >
                {anim.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            How the Next Question button appears after selection
          </p>
        </div>

        {/* Animation Duration */}
        {design.buttonAnimation && design.buttonAnimation !== 'none' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Animation Duration</Label>
              <span className="text-xs text-muted-foreground">{design.buttonAnimationDuration || 300}ms</span>
            </div>
            <Slider
              value={[design.buttonAnimationDuration || 300]}
              onValueChange={([value]) => updateField('buttonAnimationDuration', value)}
              min={100}
              max={800}
              step={50}
            />
          </div>
        )}

        {/* Button Hover Effect */}
        <div className="space-y-2">
          <Label className="text-xs">Button Hover Effect</Label>
          <div className="flex flex-wrap gap-1">
            {BUTTON_HOVER_OPTIONS.map((effect) => (
              <Button
                key={effect.value}
                variant={design.buttonHoverEffect === effect.value || (!design.buttonHoverEffect && effect.value === 'none') ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateField('buttonHoverEffect', effect.value)}
              >
                {effect.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Option Card Styling Section (for multi-choice) */}
      {step.step_type === 'multi_choice' && (
        <div id="editor-section-option-cards" className={cn("space-y-4 border-t pt-4 p-3 -mx-3 rounded-lg transition-colors", isHighlighted('options') && "bg-primary/10 ring-1 ring-primary/30")}>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
            Option Cards
          </h4>
          
          {/* Option Card Background */}
          <div className="space-y-2">
            <Label className="text-xs">Card Background</Label>
            <div className="flex flex-wrap gap-2">
              {['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.optionCardBg === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('optionCardBg', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={design.optionCardBg || '#1a1a1a'}
              onChange={(e) => updateField('optionCardBg', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Option Card Border */}
          <div className="space-y-2">
            <Label className="text-xs">Card Border Color</Label>
            <div className="flex flex-wrap gap-2">
              {['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.3)', '#3b82f6', '#f59e0b', '#10b981'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.optionCardBorder === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('optionCardBorder', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={design.optionCardBorder || '#333333'}
              onChange={(e) => updateField('optionCardBorder', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Border Width */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Border Width</Label>
              <span className="text-xs text-muted-foreground">{design.optionCardBorderWidth || 1}px</span>
            </div>
            <Slider
              value={[design.optionCardBorderWidth || 1]}
              onValueChange={([value]) => updateField('optionCardBorderWidth', value)}
              min={0}
              max={4}
              step={1}
            />
          </div>

          {/* Card Corner Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Card Roundness</Label>
              <span className="text-xs text-muted-foreground">{design.optionCardRadius || 12}px</span>
            </div>
            <Slider
              value={[design.optionCardRadius || 12]}
              onValueChange={([value]) => updateField('optionCardRadius', value)}
              min={0}
              max={24}
              step={2}
            />
          </div>

          {/* Selected State Colors */}
          <div className="space-y-3 p-3 bg-secondary/50 rounded-lg">
            <Label className="text-xs font-medium">Selected State</Label>
            
            <div className="space-y-2">
              <Label className="text-xs">Selected Background</Label>
              <div className="flex flex-wrap gap-2">
                {['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.2)', '#3b82f620', '#f59e0b20', '#10b98120'].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all",
                      design.optionCardSelectedBg === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => updateField('optionCardSelectedBg', color)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={design.optionCardSelectedBg || '#2a2a2a'}
                onChange={(e) => updateField('optionCardSelectedBg', e.target.value)}
                className="h-8 w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Selected Border</Label>
              <div className="flex flex-wrap gap-2">
                {['rgba(255,255,255,0.3)', '#ffffff', '#3b82f6', '#f59e0b', '#10b981'].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all",
                      design.optionCardSelectedBorder === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => updateField('optionCardSelectedBorder', color)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={design.optionCardSelectedBorder || '#ffffff'}
                onChange={(e) => updateField('optionCardSelectedBorder', e.target.value)}
                className="h-8 w-full"
              />
            </div>
          </div>

          {/* Option Card Hover Effect */}
          <div className="space-y-2">
            <Label className="text-xs">Card Hover Effect</Label>
            <div className="flex flex-wrap gap-1">
              {OPTION_HOVER_OPTIONS.map((effect) => (
                <Button
                  key={effect.value}
                  variant={design.optionCardHoverEffect === effect.value || (!design.optionCardHoverEffect && effect.value === 'scale') ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => updateField('optionCardHoverEffect', effect.value)}
                >
                  {effect.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Field Styling Section (for text_question, email, phone, opt_in) */}
      {['text_question', 'email_capture', 'phone_capture', 'opt_in'].includes(step.step_type) && (
        <div id="editor-section-input-styling" className={cn("space-y-4 border-t pt-4 p-3 -mx-3 rounded-lg transition-colors", isHighlighted('input') && "bg-primary/10 ring-1 ring-primary/30")}>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
            Input Field Styling
          </h4>
          
          {/* Show Icon Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Chat Icon</Label>
            <Switch
              checked={design.inputShowIcon !== false}
              onCheckedChange={(checked) => updateField('inputShowIcon', checked)}
            />
          </div>
          
          {/* Input Background */}
          <div className="space-y-2">
            <Label className="text-xs">Input Background</Label>
            <div className="flex flex-wrap gap-2">
              {['#ffffff', '#f5f5f5', '#e5e5e5', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.1)', 'transparent'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.inputBg === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('inputBg', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={design.inputBg || '#ffffff'}
              onChange={(e) => updateField('inputBg', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Input Text Color */}
          <div className="space-y-2">
            <Label className="text-xs">Text Color</Label>
            <div className="flex flex-wrap gap-2">
              {['#000000', '#1a1a1a', '#333333', '#666666', '#ffffff', '#a3a3a3'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.inputTextColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('inputTextColor', color)}
                />
              ))}
            </div>
          </div>

          {/* Placeholder Color */}
          <div className="space-y-2">
            <Label className="text-xs">Placeholder Color</Label>
            <div className="flex flex-wrap gap-2">
              {['#9ca3af', '#6b7280', '#a3a3a3', '#d4d4d4', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.inputPlaceholderColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('inputPlaceholderColor', color)}
                />
              ))}
            </div>
          </div>

          {/* Input Border Color */}
          <div className="space-y-2">
            <Label className="text-xs">Border Color</Label>
            <div className="flex flex-wrap gap-2">
              {['#e5e7eb', '#d1d5db', '#9ca3af', 'transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.2)'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.inputBorder === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
                  onClick={() => updateField('inputBorder', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={design.inputBorder || '#e5e7eb'}
              onChange={(e) => updateField('inputBorder', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Border Width */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Border Width</Label>
              <span className="text-xs text-muted-foreground">{design.inputBorderWidth ?? 1}px</span>
            </div>
            <Slider
              value={[design.inputBorderWidth ?? 1]}
              onValueChange={([value]) => updateField('inputBorderWidth', value)}
              min={0}
              max={4}
              step={1}
            />
          </div>

          {/* Input Corner Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Corner Roundness</Label>
              <span className="text-xs text-muted-foreground">{design.inputRadius || 12}px</span>
            </div>
            <Slider
              value={[design.inputRadius || 12]}
              onValueChange={([value]) => updateField('inputRadius', value)}
              min={0}
              max={24}
              step={2}
            />
          </div>

          {/* Focus Border Color */}
          <div className="space-y-2">
            <Label className="text-xs">Focus Border Color</Label>
            <div className="flex flex-wrap gap-2">
              {['#3b82f6', '#2563eb', '#1d4ed8', '#10b981', '#f59e0b', '#8b5cf6'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    design.inputFocusBorder === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('inputFocusBorder', color)}
                />
              ))}
            </div>
            <Input
              type="color"
              value={design.inputFocusBorder || '#3b82f6'}
              onChange={(e) => updateField('inputFocusBorder', e.target.value)}
              className="h-8 w-full"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2 p-3 bg-secondary/50 rounded-lg">
            <Label className="text-xs font-medium">Preview</Label>
            <div 
              className="relative flex items-start gap-3 p-4"
              style={{ 
                backgroundColor: design.inputBg || '#ffffff',
                borderRadius: `${design.inputRadius || 12}px`,
                border: `${design.inputBorderWidth ?? 1}px solid ${design.inputBorder || '#e5e7eb'}`
              }}
            >
              {design.inputShowIcon !== false && (
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: design.inputPlaceholderColor || '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
              <span style={{ color: design.inputPlaceholderColor || '#9ca3af' }} className="text-sm">
                Type here
              </span>
            </div>
          </div>
        </div>
      )}

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
