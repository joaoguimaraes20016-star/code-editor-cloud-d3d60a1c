/**
 * SectionPicker - Perspective-style collapsible section picker
 * Left panel for adding sections and elements to the canvas
 */

import { useState } from 'react';
import {
  Type,
  AlignLeft,
  MousePointerClick,
  Play,
  ClipboardList,
  ShieldCheck,
  CheckCircle,
  Layout,
  Image,
  Mail,
  Phone,
  List,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Divide,
  Square,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  allSectionTemplates,
  sectionTemplatesByCategory,
  categoryLabels,
  type SectionTemplate,
} from '../templates/sectionTemplates';
import type { CanvasNode } from '../types';

interface SectionPickerProps {
  onAddSection: (node: CanvasNode) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  type: <Type size={16} />,
  'align-left': <AlignLeft size={16} />,
  'mouse-pointer-click': <MousePointerClick size={16} />,
  'square-mouse-pointer': <Square size={16} />,
  play: <Play size={16} />,
  'clipboard-list': <ClipboardList size={16} />,
  'shield-check': <ShieldCheck size={16} />,
  'check-circle': <CheckCircle size={16} />,
  layout: <Layout size={16} />,
  image: <Image size={16} />,
  mail: <Mail size={16} />,
  phone: <Phone size={16} />,
  list: <List size={16} />,
  calendar: <Calendar size={16} />,
  text: <Type size={16} />,
};

const categoryIconMap: Record<string, React.ReactNode> = {
  hero: <Layout size={18} />,
  content: <Type size={18} />,
  cta: <MousePointerClick size={18} />,
  media: <Play size={18} />,
  form: <ClipboardList size={18} />,
  social_proof: <ShieldCheck size={18} />,
  features: <CheckCircle size={18} />,
};

// Basic element blocks
const basicBlocks = [
  { id: 'heading', name: 'Heading', icon: 'type', type: 'heading', props: { text: 'Heading', level: 'h2' } },
  { id: 'paragraph', name: 'Text', icon: 'align-left', type: 'paragraph', props: { text: 'Add your text here.' } },
  { id: 'button', name: 'Button', icon: 'mouse-pointer-click', type: 'cta_button', props: { label: 'Button', variant: 'primary', action: 'next' } },
  { id: 'image', name: 'Image', icon: 'image', type: 'image_block', props: { src: '', alt: 'Image' } },
  { id: 'spacer', name: 'Spacer', icon: 'minus', type: 'spacer', props: { height: 24 } },
  { id: 'divider', name: 'Divider', icon: 'minus', type: 'divider', props: {} },
];

interface BlockItemProps {
  name: string;
  icon: string;
  onClick: () => void;
}

function BlockItem({ name, icon, onClick }: BlockItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg hover:bg-slate-100 transition-colors group"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-slate-900 transition-colors">
        {icon === 'minus' ? <Minus size={16} /> : iconMap[icon] || <Square size={16} />}
      </div>
      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{name}</span>
    </button>
  );
}

interface SectionItemProps {
  template: SectionTemplate;
  onClick: () => void;
}

function SectionItem({ template, onClick }: SectionItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg hover:bg-slate-100 transition-colors group"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-slate-900 transition-colors">
        {iconMap[template.icon] || <Square size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{template.name}</div>
        <div className="text-xs text-slate-500 truncate">{template.description}</div>
      </div>
    </button>
  );
}

interface CategorySectionProps {
  category: string;
  templates: SectionTemplate[];
  onAddSection: (node: CanvasNode) => void;
  defaultOpen?: boolean;
}

function CategorySection({ category, templates, onAddSection, defaultOpen = false }: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors">
        <div className="text-slate-500">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="text-slate-600">
          {categoryIconMap[category]}
        </div>
        <span className="text-sm font-semibold text-slate-700">{categoryLabels[category] || category}</span>
        <span className="ml-auto text-xs text-slate-400">{templates.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5">
        {templates.map((template) => (
          <SectionItem
            key={template.id}
            template={template}
            onClick={() => onAddSection(template.createNode())}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SectionPicker({ onAddSection }: SectionPickerProps) {
  const [basicOpen, setBasicOpen] = useState(true);

  const handleAddBasicBlock = (block: typeof basicBlocks[0]) => {
    // For basic blocks, wrap in a section
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

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Add Section</h2>
        <p className="text-xs text-slate-500 mt-0.5">Drag or click to add</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Basic Blocks */}
          <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors">
              <div className="text-slate-500">
                {basicOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="text-slate-600">
                <Plus size={18} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Basic Blocks</span>
              <span className="ml-auto text-xs text-slate-400">{basicBlocks.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-0.5">
              {basicBlocks.map((block) => (
                <BlockItem
                  key={block.id}
                  name={block.name}
                  icon={block.icon}
                  onClick={() => handleAddBasicBlock(block)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Section categories */}
          {Object.entries(sectionTemplatesByCategory).map(([category, templates]) => (
            <CategorySection
              key={category}
              category={category}
              templates={templates}
              onAddSection={onAddSection}
              defaultOpen={category === 'hero'}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
