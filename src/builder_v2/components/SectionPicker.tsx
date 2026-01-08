/**
 * SectionPicker - Perspective-style clean section picker
 * Left sidebar with expandable categories, shows template previews on hover
 */

import { useState } from 'react';
import {
  Type,
  AlignLeft,
  MousePointerClick,
  Play,
  Image,
  Mail,
  Phone,
  Calendar,
  Minus,
  LayoutGrid,
  Video,
  ListChecks,
  ChevronRight,
  Users,
  Quote,
  Shield,
  Star,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Timer,
  MapPin,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  allSectionTemplates,
  type SectionTemplate,
} from '../templates/sectionTemplates';
import type { CanvasNode } from '../types';

interface SectionPickerProps {
  onAddSection: (node: CanvasNode) => void;
}

// Category definitions matching Perspective
const sectionCategories = [
  { 
    id: 'hero', 
    name: 'Hero', 
    icon: Sparkles,
    color: 'bg-blue-500',
    templates: ['hero-simple', 'hero-button']
  },
  { 
    id: 'product', 
    name: 'Product', 
    icon: LayoutGrid,
    color: 'bg-blue-600',
    templates: ['features-list', 'content-heading-text']
  },
  { 
    id: 'cta', 
    name: 'Call to action', 
    icon: MousePointerClick,
    color: 'bg-blue-400',
    templates: ['cta-simple', 'cta-text']
  },
  { 
    id: 'about', 
    name: 'About us', 
    icon: Users,
    color: 'bg-blue-300',
    templates: ['content-text', 'content-heading-text']
  },
  { 
    id: 'quiz', 
    name: 'Quiz', 
    icon: HelpCircle,
    color: 'bg-blue-500',
    templates: ['form-multi-choice']
  },
  { 
    id: 'team', 
    name: 'Team', 
    icon: Users,
    color: 'bg-blue-600',
    templates: ['content-heading-text']
  },
  { 
    id: 'testimonials', 
    name: 'Testimonials', 
    icon: Quote,
    color: 'bg-blue-400',
    templates: ['social-badges']
  },
  { 
    id: 'trust', 
    name: 'Trust', 
    icon: Shield,
    color: 'bg-blue-500',
    templates: ['social-badges', 'features-list']
  },
];

// Basic blocks - simple single elements
const basicBlocks = [
  { id: 'text', name: 'Text', icon: AlignLeft, preview: 'text-lines', type: 'paragraph', props: { text: 'Add your text here.' } },
  { id: 'button', name: 'Button', icon: MousePointerClick, preview: 'button', type: 'cta_button', props: { label: 'Continue', variant: 'primary', action: 'next' } },
  { id: 'image', name: 'Image', icon: Image, preview: 'image', type: 'image_block', props: { src: '', alt: 'Image' } },
  { id: 'list', name: 'List', icon: ListChecks, preview: 'list', type: 'info_card', props: { items: [{ icon: '•', text: 'Item 1' }, { icon: '•', text: 'Item 2' }] } },
  { id: 'divider', name: 'Divider', icon: Minus, preview: 'divider', type: 'spacer', props: { height: 24 } },
  { id: 'video', name: 'Video', icon: Video, preview: 'video', type: 'video_embed', props: { url: '' } },
  { id: 'reviews', name: 'Reviews', icon: Star, preview: 'reviews', type: 'info_card', props: { items: [{ icon: '⭐', text: '5-star rated' }] } },
];

// Interactive blocks - form elements and embeds
const interactiveBlocks = [
  { id: 'email', name: 'Email Input', icon: Mail, preview: 'input', type: 'email_input', props: { placeholder: 'Email address', fieldName: 'email' } },
  { id: 'phone', name: 'Phone Input', icon: Phone, preview: 'input', type: 'phone_input', props: { placeholder: 'Phone number', fieldName: 'phone' } },
  { id: 'options', name: 'Multiple Choice', icon: LayoutGrid, preview: 'options', type: 'option_grid', props: { options: [{ id: 'a', label: 'Option A', emoji: '✨' }, { id: 'b', label: 'Option B', emoji: '🚀' }], autoAdvance: true } },
  { id: 'calendar', name: 'Calendar', icon: Calendar, preview: 'calendar', type: 'calendar_embed', props: { url: '' } },
  { id: 'faq', name: 'FAQ', icon: HelpCircle, preview: 'faq', type: 'heading', props: { text: 'Frequently Asked Questions', level: 'h2' } },
  { id: 'countdown', name: 'Countdown', icon: Timer, preview: 'countdown', type: 'heading', props: { text: 'Limited Time Offer', level: 'h2' } },
];

// Block preview thumbnails
function BlockPreview({ type }: { type: string }) {
  switch (type) {
    case 'text-lines':
      return (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded bg-slate-300" />
          <div className="h-1.5 w-4/5 rounded bg-slate-300" />
        </div>
      );
    case 'button':
      return <div className="h-5 w-12 rounded-md bg-blue-500" />;
    case 'image':
      return (
        <div className="h-10 w-14 rounded bg-slate-200 flex items-center justify-center">
          <Image size={14} className="text-slate-400" />
        </div>
      );
    case 'video':
      return (
        <div className="h-10 w-14 rounded bg-slate-200 flex items-center justify-center">
          <Play size={14} className="text-slate-400" />
        </div>
      );
    case 'list':
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <div className="h-1 w-1 rounded-full bg-blue-400" />
            <div className="h-1 w-8 rounded bg-slate-300" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1 w-1 rounded-full bg-blue-400" />
            <div className="h-1 w-6 rounded bg-slate-300" />
          </div>
        </div>
      );
    case 'divider':
      return <div className="h-px w-10 bg-slate-300" />;
    case 'reviews':
      return (
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={8} className="text-yellow-400 fill-yellow-400" />
          ))}
        </div>
      );
    case 'input':
      return <div className="h-4 w-12 rounded border border-slate-300 bg-white" />;
    case 'options':
      return (
        <div className="grid grid-cols-2 gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 w-4 rounded bg-slate-200" />
          ))}
        </div>
      );
    case 'calendar':
      return (
        <div className="h-10 w-14 rounded bg-slate-100 flex items-center justify-center">
          <Calendar size={14} className="text-slate-400" />
        </div>
      );
    case 'faq':
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <ChevronRight size={6} className="text-slate-400" />
            <div className="h-1 w-8 rounded bg-slate-300" />
          </div>
          <div className="flex items-center gap-1">
            <ChevronRight size={6} className="text-slate-400" />
            <div className="h-1 w-6 rounded bg-slate-300" />
          </div>
        </div>
      );
    case 'countdown':
      return (
        <div className="flex gap-1">
          {['00', '12', '30'].map((n, i) => (
            <div key={i} className="bg-purple-100 rounded px-1 text-[8px] font-bold text-purple-600">{n}</div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// Individual block item
function BlockItem({ name, icon: Icon, preview, onClick }: { name: string; icon: typeof Type; preview: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all group min-h-[80px]"
    >
      <div className="h-10 flex items-center justify-center">
        <BlockPreview type={preview} />
      </div>
      <span className="text-[11px] font-medium text-slate-600">{name}</span>
    </button>
  );
}

// Expandable category row
function CategoryRow({ 
  name, 
  icon: Icon, 
  color,
  isExpanded, 
  onToggle, 
  onSelectTemplate,
  templates 
}: { 
  name: string; 
  icon: typeof Sparkles;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTemplate: (templateId: string) => void;
  templates: SectionTemplate[];
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
          isExpanded ? "bg-slate-100" : "hover:bg-slate-50"
        )}
      >
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white", color)}>
          <Icon size={14} />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-slate-700">{name}</span>
        <ChevronRight 
          size={16} 
          className={cn(
            "text-slate-400 transition-transform",
            isExpanded && "rotate-90"
          )} 
        />
      </button>
      {isExpanded && templates.length > 0 && (
        <div className="ml-10 mt-1 mb-2 space-y-1">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className="w-full text-left px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-primary/5 hover:text-primary transition-colors"
            >
              {template.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionPicker({ onAddSection }: SectionPickerProps) {
  const [expandedBlock, setExpandedBlock] = useState<'basic' | 'interactive' | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleAddBlock = (block: { type: string; props: Record<string, unknown> }) => {
    const sectionNode: CanvasNode = {
      id: `section-${Date.now()}`,
      type: 'section',
      props: { variant: 'content' },
      children: [
        {
          id: `${block.type}-${Date.now()}`,
          type: block.type,
          props: block.props,
          children: [],
        },
      ],
    };
    onAddSection(sectionNode);
  };

  const handleAddTemplate = (templateId: string) => {
    const template = allSectionTemplates.find(t => t.id === templateId);
    if (template) {
      onAddSection(template.createNode());
    }
  };

  const getTemplatesForCategory = (categoryId: string): SectionTemplate[] => {
    const category = sectionCategories.find(c => c.id === categoryId);
    if (!category) return [];
    return allSectionTemplates.filter(t => category.templates.includes(t.id));
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Header */}
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Add section</h3>
          
          {/* Blocks Section */}
          <div className="space-y-1 mb-4">
            {/* Basic Blocks */}
            <button
              onClick={() => setExpandedBlock(expandedBlock === 'basic' ? null : 'basic')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                expandedBlock === 'basic' ? "bg-slate-100" : "hover:bg-slate-50"
              )}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500 text-white">
                <Type size={14} />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-slate-700">Basic blocks</span>
              <ChevronRight 
                size={16} 
                className={cn(
                  "text-slate-400 transition-transform",
                  expandedBlock === 'basic' && "rotate-90"
                )} 
              />
            </button>
            {expandedBlock === 'basic' && (
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/50 rounded-lg">
                {basicBlocks.map((block) => (
                  <BlockItem
                    key={block.id}
                    name={block.name}
                    icon={block.icon}
                    preview={block.preview}
                    onClick={() => handleAddBlock(block)}
                  />
                ))}
              </div>
            )}

            {/* Interactive Blocks */}
            <button
              onClick={() => setExpandedBlock(expandedBlock === 'interactive' ? null : 'interactive')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                expandedBlock === 'interactive' ? "bg-slate-100" : "hover:bg-slate-50"
              )}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500 text-white">
                <Sparkles size={14} />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-slate-700">Interactive blocks</span>
              <ChevronRight 
                size={16} 
                className={cn(
                  "text-slate-400 transition-transform",
                  expandedBlock === 'interactive' && "rotate-90"
                )} 
              />
            </button>
            {expandedBlock === 'interactive' && (
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/50 rounded-lg">
                {interactiveBlocks.map((block) => (
                  <BlockItem
                    key={block.id}
                    name={block.name}
                    icon={block.icon}
                    preview={block.preview}
                    onClick={() => handleAddBlock(block)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sections divider */}
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Sections
          </div>

          {/* Section categories */}
          <div className="space-y-0.5">
            {sectionCategories.map((category) => (
              <CategoryRow
                key={category.id}
                name={category.name}
                icon={category.icon}
                color={category.color}
                isExpanded={expandedSection === category.id}
                onToggle={() => setExpandedSection(expandedSection === category.id ? null : category.id)}
                onSelectTemplate={handleAddTemplate}
                templates={getTemplatesForCategory(category.id)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
