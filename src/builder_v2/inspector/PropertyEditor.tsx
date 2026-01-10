/**
 * PropertyEditor - Rich property controls for canvas elements
 * Context-aware inspector that shows different controls based on selection
 * Framer-style comprehensive editing with layout, style, and typography controls
 */

import { useState, useRef, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Link,
  Loader2,
  ChevronRight,
  Palette,
  Layout,
  Type as TypeIcon,
  Settings2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { CanvasNode, Page } from '../types';
import { normalizeVideoUrl, isValidVideoUrl } from '../assets/mediaUtils';
import { ColorControl } from './controls/ColorControl';
import { AlignmentControl } from './controls/AlignmentControl';
import { ShadowControl } from './controls/ShadowControl';
import { FontSizeControl, FontWeightControl } from './controls/FontControl';
import { cn } from '@/lib/utils';

interface PropertyEditorProps {
  selectedNode: CanvasNode | null;
  selectedPage: Page | null;
  onUpdateNode: (nodeId: string, props: Record<string, unknown>) => void;
  onUpdatePage: (pageId: string, updates: Partial<Page>) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
}

interface PropertyFieldProps {
  label: string;
  children: ReactNode;
}

function PropertyField({ label, children }: PropertyFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

interface PropertySectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function PropertySection({ title, icon, defaultOpen = true, children }: PropertySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 hover:bg-slate-50 rounded transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</span>
        </div>
        <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// STYLE CONTROLS - Common styling controls for elements
// ============================================================================

function StyleControls({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <PropertySection title="Style" icon={<Palette size={14} />} defaultOpen={false}>
      <PropertyField label="Text Color">
        <ColorControl
          value={(node.props.color as string) || '#ffffff'}
          onChange={(color) => onUpdate({ color })}
        />
      </PropertyField>
      <PropertyField label="Background">
        <ColorControl
          value={(node.props.backgroundColor as string) || 'transparent'}
          onChange={(backgroundColor) => onUpdate({ backgroundColor })}
        />
      </PropertyField>
      <PropertyField label="Border Radius">
        <Slider
          value={[(node.props.borderRadius as number) || 0]}
          onValueChange={([value]) => onUpdate({ borderRadius: value })}
          min={0}
          max={32}
          step={2}
        />
      </PropertyField>
      <PropertyField label="Shadow">
        <ShadowControl
          value={(node.props.shadow as 'none' | 'sm' | 'md' | 'lg' | 'xl') || 'none'}
          onChange={(shadow) => onUpdate({ shadow })}
        />
      </PropertyField>
    </PropertySection>
  );
}

function TypographyControls({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <PropertySection title="Typography" icon={<TypeIcon size={14} />} defaultOpen={false}>
      <PropertyField label="Alignment">
        <AlignmentControl
          value={(node.props.textAlign as 'left' | 'center' | 'right' | 'justify') || 'center'}
          onChange={(textAlign) => onUpdate({ textAlign })}
        />
      </PropertyField>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="Size">
          <FontSizeControl
            value={(node.props.fontSize as string) || 'base'}
            onChange={(fontSize) => onUpdate({ fontSize })}
          />
        </PropertyField>
        <PropertyField label="Weight">
          <FontWeightControl
            value={(node.props.fontWeight as string) || 'normal'}
            onChange={(fontWeight) => onUpdate({ fontWeight })}
          />
        </PropertyField>
      </div>
    </PropertySection>
  );
}

function LayoutControls({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <PropertySection title="Layout" icon={<Layout size={14} />} defaultOpen={false}>
      <PropertyField label="Max Width">
        <Select
          value={(node.props.maxWidth as string) || 'auto'}
          onValueChange={(value) => onUpdate({ maxWidth: value })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="280px">Small (280px)</SelectItem>
            <SelectItem value="320px">Medium (320px)</SelectItem>
            <SelectItem value="400px">Large (400px)</SelectItem>
            <SelectItem value="100%">Full Width</SelectItem>
          </SelectContent>
        </Select>
      </PropertyField>
      <PropertyField label={`Padding: ${(node.props.padding as number) || 0}px`}>
        <Slider
          value={[(node.props.padding as number) || 0]}
          onValueChange={([value]) => onUpdate({ padding: value })}
          min={0}
          max={64}
          step={4}
        />
      </PropertyField>
      <PropertyField label={`Gap: ${(node.props.gap as number) || 16}px`}>
        <Slider
          value={[(node.props.gap as number) || 16]}
          onValueChange={([value]) => onUpdate({ gap: value })}
          min={0}
          max={64}
          step={4}
        />
      </PropertyField>
    </PropertySection>
  );
}

// ============================================================================
// ELEMENT-SPECIFIC PROPERTY EDITORS
// ============================================================================

function HeadingProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Content" icon={<Settings2 size={14} />}>
        <PropertyField label="Text">
          <Textarea
            value={(node.props.text as string) || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="min-h-[80px] resize-none"
            placeholder="Enter heading text"
          />
        </PropertyField>
        <PropertyField label="Level">
          <Select
            value={(node.props.level as string) || 'h1'}
            onValueChange={(value) => onUpdate({ level: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">Heading 1 (Large)</SelectItem>
              <SelectItem value="h2">Heading 2 (Medium)</SelectItem>
              <SelectItem value="h3">Heading 3 (Small)</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
      </PropertySection>
      <TypographyControls node={node} onUpdate={onUpdate} />
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function ParagraphProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Content" icon={<Settings2 size={14} />}>
        <PropertyField label="Text">
          <Textarea
            value={(node.props.text as string) || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="min-h-[120px] resize-none"
            placeholder="Enter paragraph text"
          />
        </PropertyField>
      </PropertySection>
      <TypographyControls node={node} onUpdate={onUpdate} />
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function ButtonProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Content" icon={<Settings2 size={14} />}>
        <PropertyField label="Button Text">
          <Input
            value={(node.props.label as string) || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Button label"
          />
        </PropertyField>
        <PropertyField label="Style">
          <Select
            value={(node.props.variant as string) || 'primary'}
            onValueChange={(value) => onUpdate({ variant: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary (Filled)</SelectItem>
              <SelectItem value="secondary">Secondary (Subtle)</SelectItem>
              <SelectItem value="outline">Outline (Border)</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
        <PropertyField label="Size">
          <Select
            value={(node.props.size as string) || 'default'}
            onValueChange={(value) => onUpdate({ size: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
        <PropertyField label="Full Width">
          <div className="flex items-center gap-2">
            <Switch
              checked={(node.props.fullWidth as boolean) ?? true}
              onCheckedChange={(checked) => onUpdate({ fullWidth: checked })}
            />
            <span className="text-sm text-slate-600">Stretch to container</span>
          </div>
        </PropertyField>
      </PropertySection>
      <PropertySection title="Action" icon={<Settings2 size={14} />}>
        <PropertyField label="On Click">
          <Select
            value={(node.props.action as string) || 'next'}
            onValueChange={(value) => onUpdate({ action: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next">Go to Next Page</SelectItem>
              <SelectItem value="submit">Submit Form</SelectItem>
              <SelectItem value="url">Open URL</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
        {node.props.action === 'url' && (
          <PropertyField label="URL">
            <Input
              value={(node.props.url as string) || ''}
              onChange={(e) => onUpdate({ url: e.target.value })}
              placeholder="https://..."
            />
          </PropertyField>
        )}
      </PropertySection>
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function InputProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Content" icon={<Settings2 size={14} />}>
        <PropertyField label="Placeholder">
          <Input
            value={(node.props.placeholder as string) || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            placeholder="Enter placeholder text"
          />
        </PropertyField>
        <PropertyField label="Field Name">
          <Input
            value={(node.props.fieldName as string) || ''}
            onChange={(e) => onUpdate({ fieldName: e.target.value })}
            placeholder="e.g., email, name, phone"
          />
        </PropertyField>
        <PropertyField label="Required">
          <div className="flex items-center gap-2">
            <Switch
              checked={(node.props.required as boolean) || false}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
            />
            <span className="text-sm text-slate-600">This field is required</span>
          </div>
        </PropertyField>
      </PropertySection>
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function SpacerProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  const height = (node.props.height as number) || 24;

  return (
    <div className="space-y-4">
      <PropertySection title="Size" icon={<Layout size={14} />}>
        <PropertyField label={`Height: ${height}px`}>
          <Slider
            value={[height]}
            onValueChange={([value]) => onUpdate({ height: value })}
            min={8}
            max={120}
            step={4}
          />
        </PropertyField>
      </PropertySection>
    </div>
  );
}

function VideoProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  const [urlInput, setUrlInput] = useState((node.props.url as string) || '');
  const [isValid, setIsValid] = useState(true);

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    const normalized = normalizeVideoUrl(value);
    const valid = !value || isValidVideoUrl(value);
    setIsValid(valid);
    if (valid) {
      onUpdate({ url: normalized });
    }
  };

  return (
    <div className="space-y-4">
      <PropertySection title="Video" icon={<Settings2 size={14} />}>
        <PropertyField label="Video URL">
          <div className="space-y-2">
            <Input
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste YouTube, Vimeo, or Loom URL"
              className={!isValid ? 'border-destructive' : ''}
            />
            {!isValid && urlInput && (
              <p className="text-xs text-destructive">Please enter a valid video URL</p>
            )}
            <p className="text-[10px] text-slate-400">
              Supports YouTube, Vimeo, Loom, and Wistia
            </p>
          </div>
        </PropertyField>
        <PropertyField label="Aspect Ratio">
          <Select
            value={(node.props.aspectRatio as string) || '16:9'}
            onValueChange={(value) => onUpdate({ aspectRatio: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 (Standard)</SelectItem>
              <SelectItem value="4:3">4:3</SelectItem>
              <SelectItem value="1:1">1:1 (Square)</SelectItem>
              <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
      </PropertySection>
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function CalendarProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Calendar" icon={<Settings2 size={14} />}>
        <PropertyField label="Calendar URL">
          <Input
            value={(node.props.url as string) || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="Calendly or Cal.com URL"
          />
        </PropertyField>
        <PropertyField label={`Height: ${(node.props.height as number) || 500}px`}>
          <Slider
            value={[(node.props.height as number) || 500]}
            onValueChange={([value]) => onUpdate({ height: value })}
            min={300}
            max={800}
            step={50}
          />
        </PropertyField>
      </PropertySection>
    </div>
  );
}

function OptionGridProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  const options = (node.props.options as Array<{ id: string; label: string; emoji?: string }>) || [];

  const updateOption = (index: number, updates: Partial<{ label: string; emoji: string }>) => {
    const newOptions = options.map((opt, i) => (i === index ? { ...opt, ...updates } : opt));
    onUpdate({ options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...options, { id: `opt-${Date.now()}`, label: 'New Option', emoji: '✨' }];
    onUpdate({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <PropertySection title="Options" icon={<Settings2 size={14} />}>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.emoji || ''}
                onChange={(e) => updateOption(index, { emoji: e.target.value })}
                className="w-12 text-center"
                placeholder="🎯"
              />
              <Input
                value={option.label}
                onChange={(e) => updateOption(index, { label: e.target.value })}
                className="flex-1"
                placeholder="Option label"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-500"
                onClick={() => removeOption(index)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOption} className="w-full">
            Add Option
          </Button>
        </div>
      </PropertySection>
      <PropertySection title="Behavior" icon={<Settings2 size={14} />}>
        <PropertyField label="Auto-advance">
          <div className="flex items-center gap-2">
            <Switch
              checked={(node.props.autoAdvance as boolean) || false}
              onCheckedChange={(checked) => onUpdate({ autoAdvance: checked })}
            />
            <span className="text-sm text-slate-600">Go to next page on selection</span>
          </div>
        </PropertyField>
        <PropertyField label="Layout">
          <Select
            value={(node.props.layout as string) || 'stack'}
            onValueChange={(value) => onUpdate({ layout: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stack">Stacked</SelectItem>
              <SelectItem value="grid-2">2 Columns</SelectItem>
              <SelectItem value="grid-3">3 Columns</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
      </PropertySection>
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function SectionProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Section" icon={<Settings2 size={14} />}>
        <PropertyField label="Section Type">
          <Select
            value={(node.props.variant as string) || 'content'}
            onValueChange={(value) => onUpdate({ variant: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hero">Hero (Centered, prominent)</SelectItem>
              <SelectItem value="content">Content (Standard)</SelectItem>
              <SelectItem value="form">Form (Compact inputs)</SelectItem>
              <SelectItem value="cta">CTA (Button focused)</SelectItem>
              <SelectItem value="media">Media (Full width)</SelectItem>
              <SelectItem value="options">Options (Choice grid)</SelectItem>
              <SelectItem value="embed">Embed (Calendar/Video)</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
      </PropertySection>
      <LayoutControls node={node} onUpdate={onUpdate} />
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function ImageProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onUpdate({ src: dataUrl });
        setIsUploading(false);
        toast({ title: 'Image added' });
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast({ title: 'Upload failed', variant: 'destructive' });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <PropertySection title="Image" icon={<Settings2 size={14} />}>
        <PropertyField label="Image">
          <div className="space-y-2">
            {node.props.src && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border">
                <img 
                  src={node.props.src as string} 
                  alt={node.props.alt as string || 'Preview'} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 size={12} className="mr-1.5 animate-spin" />
                ) : (
                  <Upload size={12} className="mr-1.5" />
                )}
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Link size={10} />
              <span>Or paste URL:</span>
            </div>
            <Input
              value={(node.props.src as string) || ''}
              onChange={(e) => onUpdate({ src: e.target.value })}
              placeholder="https://..."
              className="text-xs"
            />
          </div>
        </PropertyField>
        <PropertyField label="Alt Text">
          <Input
            value={(node.props.alt as string) || ''}
            onChange={(e) => onUpdate({ alt: e.target.value })}
            placeholder="Describe this image"
            className="text-xs"
          />
        </PropertyField>
      </PropertySection>
      <PropertySection title="Size" icon={<Layout size={14} />}>
        <PropertyField label="Max Width">
          <Select
            value={(node.props.maxWidth as string) || '320px'}
            onValueChange={(value) => onUpdate({ maxWidth: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="200px">Small (200px)</SelectItem>
              <SelectItem value="280px">Medium (280px)</SelectItem>
              <SelectItem value="320px">Large (320px)</SelectItem>
              <SelectItem value="100%">Full Width</SelectItem>
            </SelectContent>
          </Select>
        </PropertyField>
        <PropertyField label="Border Radius">
          <Slider
            value={[(node.props.borderRadius as number) || 12]}
            onValueChange={([value]) => onUpdate({ borderRadius: value })}
            min={0}
            max={32}
            step={2}
          />
        </PropertyField>
      </PropertySection>
      <StyleControls node={node} onUpdate={onUpdate} />
    </div>
  );
}

function ConsentProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertySection title="Consent" icon={<Settings2 size={14} />}>
        <PropertyField label="Label Text">
          <Textarea
            value={(node.props.label as string) || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="min-h-[60px] resize-none"
            placeholder="I agree to receive communications..."
          />
        </PropertyField>
        <PropertyField label="Link Text">
          <Input
            value={(node.props.linkText as string) || ''}
            onChange={(e) => onUpdate({ linkText: e.target.value })}
            placeholder="Privacy Policy"
          />
        </PropertyField>
        <PropertyField label="Link URL">
          <Input
            value={(node.props.linkUrl as string) || ''}
            onChange={(e) => onUpdate({ linkUrl: e.target.value })}
            placeholder="/privacy"
          />
        </PropertyField>
        <PropertyField label="Required">
          <div className="flex items-center gap-2">
            <Switch
              checked={(node.props.required as boolean) || false}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
            />
            <span className="text-sm text-slate-600">User must agree</span>
          </div>
        </PropertyField>
      </PropertySection>
    </div>
  );
}

function getPropertyEditor(node: CanvasNode, onUpdate: (props: Record<string, unknown>) => void) {
  switch (node.type) {
    case 'heading':
      return <HeadingProperties node={node} onUpdate={onUpdate} />;
    case 'paragraph':
      return <ParagraphProperties node={node} onUpdate={onUpdate} />;
    case 'cta_button':
      return <ButtonProperties node={node} onUpdate={onUpdate} />;
    case 'text_input':
    case 'email_input':
    case 'phone_input':
      return <InputProperties node={node} onUpdate={onUpdate} />;
    case 'spacer':
      return <SpacerProperties node={node} onUpdate={onUpdate} />;
    case 'video_embed':
      return <VideoProperties node={node} onUpdate={onUpdate} />;
    case 'calendar_embed':
      return <CalendarProperties node={node} onUpdate={onUpdate} />;
    case 'option_grid':
      return <OptionGridProperties node={node} onUpdate={onUpdate} />;
    case 'section':
      return <SectionProperties node={node} onUpdate={onUpdate} />;
    case 'image':
    case 'image_block':
      return <ImageProperties node={node} onUpdate={onUpdate} />;
    case 'consent_checkbox':
      return <ConsentProperties node={node} onUpdate={onUpdate} />;
    default:
      return (
        <div className="text-sm text-slate-500 text-center py-4">
          No editable properties for this element type.
        </div>
      );
  }
}

function getElementDisplayName(type: string): string {
  const names: Record<string, string> = {
    frame: 'Page Frame',
    section: 'Section',
    heading: 'Heading',
    paragraph: 'Text',
    cta_button: 'Button',
    text_input: 'Text Input',
    email_input: 'Email Input',
    phone_input: 'Phone Input',
    spacer: 'Spacer',
    divider: 'Divider',
    video_embed: 'Video',
    calendar_embed: 'Calendar',
    option_grid: 'Multiple Choice',
    image: 'Image',
    image_block: 'Image',
    icon: 'Icon',
    info_card: 'Info Card',
    consent_checkbox: 'Consent',
  };
  return names[type] || type;
}

export function PropertyEditor({
  selectedNode,
  selectedPage,
  onUpdateNode,
  onUpdatePage,
  onDeleteNode,
  onMoveNode,
}: PropertyEditorProps) {
  // Page settings (no element selected)
  if (!selectedNode && selectedPage) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Page Settings</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <PropertyField label="Page Name">
              <Input
                value={selectedPage.name}
                onChange={(e) => onUpdatePage(selectedPage.id, { name: e.target.value })}
                placeholder="Page name"
              />
            </PropertyField>
            <PropertyField label="Page Type">
              <Select
                value={selectedPage.type}
                onValueChange={(value) => onUpdatePage(selectedPage.id, { type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landing">Landing</SelectItem>
                  <SelectItem value="optin">Opt-In</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="thank_you">Thank You</SelectItem>
                </SelectContent>
              </Select>
            </PropertyField>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // No selection
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-slate-500 text-center">
            Click an element in the preview to edit its properties
          </p>
        </div>
      </div>
    );
  }

  const handleUpdate = (props: Record<string, unknown>) => {
    onUpdateNode(selectedNode.id, props);
  };

  const isFrame = selectedNode.type === 'frame';

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {getElementDisplayName(selectedNode.type)}
          </h2>
          {!isFrame && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-900"
                onClick={() => onMoveNode(selectedNode.id, 'up')}
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-900"
                onClick={() => onMoveNode(selectedNode.id, 'down')}
              >
                <ChevronDown size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-red-500"
                onClick={() => onDeleteNode(selectedNode.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {getPropertyEditor(selectedNode, handleUpdate)}
        </div>
      </ScrollArea>
    </div>
  );
}
