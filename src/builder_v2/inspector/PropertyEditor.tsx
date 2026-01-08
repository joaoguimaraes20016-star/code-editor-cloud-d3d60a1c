/**
 * PropertyEditor - Rich property controls for canvas elements
 * Context-aware inspector that shows different controls based on selection
 */

import React from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Type,
  Palette,
  Layout,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { CanvasNode, Page } from '../types';

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
  children: React.ReactNode;
}

function PropertyField({ label, children }: PropertyFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

// Element-specific property editors
function HeadingProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

function ParagraphProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertyField label="Text">
        <Textarea
          value={(node.props.text as string) || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="min-h-[120px] resize-none"
          placeholder="Enter paragraph text"
        />
      </PropertyField>
    </div>
  );
}

function ButtonProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
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
      <PropertyField label="Action">
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
    </div>
  );
}

function InputProperties({ node, onUpdate, inputType }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void; inputType: string }) {
  const typeLabels: Record<string, string> = {
    text_input: 'Text',
    email_input: 'Email',
    phone_input: 'Phone',
  };

  return (
    <div className="space-y-4">
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
    </div>
  );
}

function SpacerProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  const height = (node.props.height as number) || 24;

  return (
    <div className="space-y-4">
      <PropertyField label={`Height: ${height}px`}>
        <Slider
          value={[height]}
          onValueChange={([value]) => onUpdate({ height: value })}
          min={8}
          max={120}
          step={4}
        />
      </PropertyField>
    </div>
  );
}

function VideoProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertyField label="Video URL">
        <Input
          value={(node.props.url as string) || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="YouTube, Vimeo, or Loom URL"
        />
      </PropertyField>
    </div>
  );
}

function CalendarProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertyField label="Calendar URL">
        <Input
          value={(node.props.url as string) || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="Calendly or Cal.com URL"
        />
      </PropertyField>
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
      <PropertyField label="Options">
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
      </PropertyField>
      <PropertyField label="Auto-advance">
        <div className="flex items-center gap-2">
          <Switch
            checked={(node.props.autoAdvance as boolean) || false}
            onCheckedChange={(checked) => onUpdate({ autoAdvance: checked })}
          />
          <span className="text-sm text-slate-600">Go to next page on selection</span>
        </div>
      </PropertyField>
    </div>
  );
}

function SectionProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

function ImageProperties({ node, onUpdate }: { node: CanvasNode; onUpdate: (props: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <PropertyField label="Image URL">
        <Input
          value={(node.props.src as string) || ''}
          onChange={(e) => onUpdate({ src: e.target.value })}
          placeholder="https://..."
        />
      </PropertyField>
      <PropertyField label="Alt Text">
        <Input
          value={(node.props.alt as string) || ''}
          onChange={(e) => onUpdate({ alt: e.target.value })}
          placeholder="Image description"
        />
      </PropertyField>
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
      return <InputProperties node={node} onUpdate={onUpdate} inputType={node.type} />;
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
    case 'image_block':
      return <ImageProperties node={node} onUpdate={onUpdate} />;
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
    image_block: 'Image',
    icon: 'Icon',
    info_card: 'Info Card',
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
