import React, { useState } from 'react';
import { Plus, Search, Type, Image, Video, MessageSquare, ListChecks, Calendar, Upload, ChevronDown, Sparkles, LayoutGrid, MousePointer } from 'lucide-react';
import { Block, BlockType } from '@/types/infostack';
import { generateId } from '../utils/helpers';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface AddSectionPopoverProps {
  onAddBlock: (block: Block) => void;
  onOpenAIGenerate?: () => void;
  position?: 'above' | 'below';
  variant?: 'button' | 'inline';
  className?: string;
}

interface BlockTemplate {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'basic' | 'interactive';
  template: () => Block;
}

const blockTemplates: BlockTemplate[] = [
  // Basic Blocks
  {
    type: 'text-block',
    label: 'Text',
    icon: <Type size={18} />,
    description: 'Paragraph or heading text',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'text-block',
      label: 'Text Block',
      elements: [
        { id: generateId(), type: 'heading', content: 'Your heading here', props: { level: 2 } },
        { id: generateId(), type: 'text', content: 'Add your paragraph text here. Click to edit.', props: {} },
      ],
      props: {},
    }),
  },
  {
    type: 'media',
    label: 'Image',
    icon: <Image size={18} />,
    description: 'Add an image',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'media',
      label: 'Image Block',
      elements: [
        { id: generateId(), type: 'image', content: '', props: { src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop', alt: 'Placeholder image' } },
      ],
      props: {},
    }),
  },
  {
    type: 'media',
    label: 'Video',
    icon: <Video size={18} />,
    description: 'Embed a video',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'media',
      label: 'Video Block',
      elements: [
        { id: generateId(), type: 'video', content: '', props: { src: '', placeholder: 'Paste video URL' } },
      ],
      props: {},
    }),
  },
  {
    type: 'cta',
    label: 'Button',
    icon: <MousePointer size={18} />,
    description: 'Call-to-action button',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'cta',
      label: 'Button Block',
      elements: [
        { id: generateId(), type: 'button', content: 'Click me', props: { variant: 'primary' } },
      ],
      props: {},
    }),
  },
  {
    type: 'custom',
    label: 'Divider',
    icon: <div className="w-4 h-0.5 bg-current" />,
    description: 'Horizontal line separator',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'custom',
      label: 'Divider',
      elements: [
        { id: generateId(), type: 'divider', content: '', props: {} },
      ],
      props: {},
    }),
  },
  {
    type: 'testimonial',
    label: 'Reviews',
    icon: <MessageSquare size={18} />,
    description: 'Customer testimonials',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'testimonial',
      label: 'Testimonial',
      elements: [
        { id: generateId(), type: 'text', content: '"This product changed my life! Highly recommend to everyone."', props: {} },
        { id: generateId(), type: 'text', content: '— Sarah Johnson, CEO', props: { variant: 'caption' } },
      ],
      props: { rating: 5, avatar: '' },
    }),
  },
  {
    type: 'hero',
    label: 'Hero',
    icon: <LayoutGrid size={18} />,
    description: 'Hero section with image',
    category: 'basic',
    template: () => ({
      id: generateId(),
      type: 'hero',
      label: 'Hero Section',
      elements: [
        { id: generateId(), type: 'heading', content: 'Welcome to our platform', props: { level: 1 } },
        { id: generateId(), type: 'text', content: 'Build beautiful landing pages in minutes. No coding required.', props: {} },
        { id: generateId(), type: 'button', content: 'Get Started', props: { variant: 'primary', size: 'lg' } },
      ],
      props: { backgroundImage: '', overlay: true },
    }),
  },
  
  // Interactive Blocks
  {
    type: 'form-field',
    label: 'Multiple Choice',
    icon: <ListChecks size={18} />,
    description: 'Multi-select question',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Multiple Choice',
      elements: [
        { id: generateId(), type: 'heading', content: 'Select all that apply:', props: { level: 3 } },
        { id: generateId(), type: 'checkbox', content: 'Option A', props: { name: 'choice', value: 'a' } },
        { id: generateId(), type: 'checkbox', content: 'Option B', props: { name: 'choice', value: 'b' } },
        { id: generateId(), type: 'checkbox', content: 'Option C', props: { name: 'choice', value: 'c' } },
        { id: generateId(), type: 'button', content: 'Submit and proceed', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', required: false },
    }),
  },
  {
    type: 'form-field',
    label: 'Single Choice',
    icon: <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-current" /></div>,
    description: 'Radio button question',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Single Choice',
      elements: [
        { id: generateId(), type: 'heading', content: 'Choose one option:', props: { level: 3 } },
        { id: generateId(), type: 'radio', content: 'Option A', props: { name: 'single_choice', value: 'a' } },
        { id: generateId(), type: 'radio', content: 'Option B', props: { name: 'single_choice', value: 'b' } },
        { id: generateId(), type: 'radio', content: 'Option C', props: { name: 'single_choice', value: 'c' } },
        { id: generateId(), type: 'button', content: 'Continue', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', required: true },
    }),
  },
  {
    type: 'form-field',
    label: 'Quiz Question',
    icon: <Sparkles size={18} />,
    description: 'Quiz with correct answer',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Quiz Question',
      elements: [
        { id: generateId(), type: 'heading', content: 'What is the answer?', props: { level: 3 } },
        { id: generateId(), type: 'radio', content: 'Answer A', props: { name: 'quiz', value: 'a', isCorrect: false } },
        { id: generateId(), type: 'radio', content: 'Answer B (Correct)', props: { name: 'quiz', value: 'b', isCorrect: true } },
        { id: generateId(), type: 'radio', content: 'Answer C', props: { name: 'quiz', value: 'c', isCorrect: false } },
        { id: generateId(), type: 'button', content: 'Check Answer', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', showCorrectAnswer: true },
    }),
  },
  {
    type: 'form-field',
    label: 'Form Input',
    icon: <Type size={18} />,
    description: 'Text input field',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Form Input',
      elements: [
        { id: generateId(), type: 'text', content: 'Enter your email', props: { variant: 'label' } },
        { id: generateId(), type: 'input', content: '', props: { type: 'email', placeholder: 'you@example.com', required: true } },
        { id: generateId(), type: 'button', content: 'Submit', props: { variant: 'primary' } },
      ],
      props: { trackingId: '' },
    }),
  },
  {
    type: 'form-field',
    label: 'Date Picker',
    icon: <Calendar size={18} />,
    description: 'Date selection',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Date Picker',
      elements: [
        { id: generateId(), type: 'text', content: 'Select a date', props: { variant: 'label' } },
        { id: generateId(), type: 'input', content: '', props: { type: 'date', placeholder: 'Choose date' } },
        { id: generateId(), type: 'button', content: 'Confirm', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', minDate: '', maxDate: '' },
    }),
  },
  {
    type: 'form-field',
    label: 'Dropdown',
    icon: <ChevronDown size={18} />,
    description: 'Select dropdown',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Dropdown',
      elements: [
        { id: generateId(), type: 'text', content: 'Choose an option', props: { variant: 'label' } },
        { id: generateId(), type: 'select', content: '', props: { options: ['Option 1', 'Option 2', 'Option 3'], placeholder: 'Select...' } },
        { id: generateId(), type: 'button', content: 'Continue', props: { variant: 'primary' } },
      ],
      props: { trackingId: '' },
    }),
  },
  {
    type: 'form-field',
    label: 'File Upload',
    icon: <Upload size={18} />,
    description: 'Upload files',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'File Upload',
      elements: [
        { id: generateId(), type: 'text', content: 'Upload your file', props: { variant: 'label' } },
        { id: generateId(), type: 'input', content: '', props: { type: 'file', accept: '.pdf,.doc,.docx,.jpg,.png', multiple: false } },
        { id: generateId(), type: 'button', content: 'Upload', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', maxSize: '10MB', allowedTypes: ['pdf', 'doc', 'jpg', 'png'] },
    }),
  },
  {
    type: 'booking',
    label: 'Appointment',
    icon: <Calendar size={18} />,
    description: 'Schedule appointments',
    category: 'interactive',
    template: () => ({
      id: generateId(),
      type: 'booking',
      label: 'Appointment Booking',
      elements: [
        { id: generateId(), type: 'heading', content: 'Book your appointment', props: { level: 2 } },
        { id: generateId(), type: 'text', content: 'Select a date and time that works for you.', props: {} },
        { id: generateId(), type: 'input', content: '', props: { type: 'datetime-local', placeholder: 'Select date & time' } },
        { id: generateId(), type: 'button', content: 'Book Now', props: { variant: 'primary' } },
      ],
      props: { trackingId: '', duration: 30, timezone: 'auto' },
    }),
  },
];

export const AddSectionPopover: React.FC<AddSectionPopoverProps> = ({
  onAddBlock,
  onOpenAIGenerate,
  position = 'below',
  variant = 'button',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'interactive'>('basic');

  const filteredTemplates = blockTemplates.filter(template => {
    const matchesSearch = template.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = template.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  const handleAddBlock = (template: BlockTemplate) => {
    onAddBlock(template.template());
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {variant === 'button' ? (
          <button
            className={`
              flex items-center justify-center w-10 h-10 rounded-full
              bg-[hsl(var(--builder-accent))] text-white
              shadow-lg shadow-[hsl(var(--builder-accent)/0.3)]
              hover:brightness-110 transition-all duration-200
              ${className}
            `}
          >
            <Plus size={20} />
          </button>
        ) : (
          <button
            className={`
              flex items-center justify-center w-full py-3 border-2 border-dashed
              border-[hsl(var(--builder-border))] rounded-lg
              text-[hsl(var(--builder-text-muted))] hover:text-[hsl(var(--builder-text))]
              hover:border-[hsl(var(--builder-accent-muted))] hover:bg-[hsl(var(--builder-surface-hover))]
              transition-all duration-200 gap-2
              ${className}
            `}
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Add section</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))] shadow-2xl"
        side={position === 'above' ? 'top' : 'bottom'}
        align="center"
        sideOffset={8}
      >
        {/* Search */}
        <div className="p-3 border-b border-[hsl(var(--builder-border-subtle))]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--builder-text-muted))]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blocks..."
              className="pl-9 h-8 text-sm bg-[hsl(var(--builder-surface-hover))] border-[hsl(var(--builder-border))] text-[hsl(var(--builder-text))] placeholder:text-[hsl(var(--builder-text-dim))]"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'basic' | 'interactive')} className="w-full">
          <TabsList className="w-full h-auto p-1 bg-[hsl(var(--builder-surface-hover))] rounded-none border-b border-[hsl(var(--builder-border-subtle))]">
            <TabsTrigger 
              value="basic" 
              className="flex-1 text-xs py-2 data-[state=active]:bg-[hsl(var(--builder-accent))] data-[state=active]:text-white"
            >
              Basic Blocks
            </TabsTrigger>
            <TabsTrigger 
              value="interactive" 
              className="flex-1 text-xs py-2 data-[state=active]:bg-[hsl(var(--builder-accent))] data-[state=active]:text-white"
            >
              Interactive Blocks
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="max-h-[300px] overflow-y-auto builder-scroll">
              {filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-[hsl(var(--builder-text-muted))] text-sm">
                  No blocks found
                </div>
              ) : (
                <div className="p-2 grid grid-cols-2 gap-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={`${template.type}-${template.label}`}
                      onClick={() => handleAddBlock(template)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[hsl(var(--builder-surface))] hover:bg-[hsl(var(--builder-surface-hover))] border border-transparent hover:border-[hsl(var(--builder-border))] transition-colors text-center group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[hsl(var(--builder-surface-active))] flex items-center justify-center text-[hsl(var(--builder-text-muted))] group-hover:text-[hsl(var(--builder-accent))] group-hover:bg-[hsl(var(--builder-accent)/0.1)] transition-colors">
                        {template.icon}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[hsl(var(--builder-text))]">
                          {template.label}
                        </div>
                        <div className="text-[10px] text-[hsl(var(--builder-text-dim))] mt-0.5">
                          {template.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate with AI */}
        <div className="p-2 border-t border-[hsl(var(--builder-border-subtle))]">
          <button 
            onClick={() => {
              setIsOpen(false);
              onOpenAIGenerate?.();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg btn-gradient text-sm font-medium ai-glow"
          >
            <Sparkles size={14} />
            Generate with AI
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};