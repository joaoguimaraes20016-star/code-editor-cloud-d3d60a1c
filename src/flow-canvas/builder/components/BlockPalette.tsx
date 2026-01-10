import React, { useState } from 'react';
import { Block, Element, BlockType } from '@/types/infostack';
import { generateId } from '../utils/helpers';
import { cn } from '@/lib/utils';
import {
  X,
  Search,
  LayoutTemplate,
  FormInput,
  Quote,
  MousePointer2,
  Type,
  Image,
  Video,
  Star,
  MessageSquare,
  List,
  Grid3X3,
  ChevronRight,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BlockTemplate {
  id: string;
  type: BlockType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'layout' | 'content' | 'form' | 'media' | 'social';
  preview: () => Block;
}

const blockTemplates: BlockTemplate[] = [
  {
    id: 'hero',
    type: 'hero',
    name: 'Hero Section',
    description: 'Large heading with subtitle and CTA',
    icon: <LayoutTemplate className="w-5 h-5" />,
    category: 'layout',
    preview: () => ({
      id: generateId(),
      type: 'hero',
      label: 'Hero',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Your Compelling Headline',
          props: { level: 1 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'A powerful subheading that explains your value proposition.',
          props: {},
        },
        {
          id: generateId(),
          type: 'button',
          content: 'Get Started',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'form',
    type: 'form-field',
    name: 'Form Block',
    description: 'Input fields for lead capture',
    icon: <FormInput className="w-5 h-5" />,
    category: 'form',
    preview: () => ({
      id: generateId(),
      type: 'form-field',
      label: 'Form',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Get in Touch',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'input',
          content: '',
          props: { placeholder: 'Your name', type: 'text' },
        },
        {
          id: generateId(),
          type: 'input',
          content: '',
          props: { placeholder: 'your@email.com', type: 'email' },
        },
        {
          id: generateId(),
          type: 'button',
          content: 'Submit',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'testimonial',
    type: 'testimonial',
    name: 'Testimonial',
    description: 'Customer quote with attribution',
    icon: <Quote className="w-5 h-5" />,
    category: 'social',
    preview: () => ({
      id: generateId(),
      type: 'testimonial',
      label: 'Testimonial',
      elements: [
        {
          id: generateId(),
          type: 'text',
          content: '"This product completely transformed how we work. Highly recommend!"',
          props: {},
        },
        {
          id: generateId(),
          type: 'text',
          content: '— Sarah Johnson, CEO at TechCorp',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'cta',
    type: 'cta',
    name: 'Call to Action',
    description: 'Prominent action button',
    icon: <MousePointer2 className="w-5 h-5" />,
    category: 'layout',
    preview: () => ({
      id: generateId(),
      type: 'cta',
      label: 'CTA',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Ready to get started?',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Join thousands of satisfied customers today.',
          props: {},
        },
        {
          id: generateId(),
          type: 'button',
          content: 'Start Free Trial',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'text-block',
    type: 'text-block',
    name: 'Text Block',
    description: 'Rich text content',
    icon: <Type className="w-5 h-5" />,
    category: 'content',
    preview: () => ({
      id: generateId(),
      type: 'text-block',
      label: 'Text Block',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Section Title',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'media',
    type: 'media',
    name: 'Media Block',
    description: 'Image or video placeholder',
    icon: <Image className="w-5 h-5" />,
    category: 'media',
    preview: () => ({
      id: generateId(),
      type: 'media',
      label: 'Media',
      elements: [
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'video',
    type: 'media',
    name: 'Video Block',
    description: 'Embedded video content',
    icon: <Video className="w-5 h-5" />,
    category: 'media',
    preview: () => ({
      id: generateId(),
      type: 'media',
      label: 'Video',
      elements: [
        {
          id: generateId(),
          type: 'video',
          content: '',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'feature',
    type: 'feature',
    name: 'Feature Card',
    description: 'Highlight a key feature',
    icon: <Star className="w-5 h-5" />,
    category: 'content',
    preview: () => ({
      id: generateId(),
      type: 'feature',
      label: 'Feature',
      elements: [
        {
          id: generateId(),
          type: 'icon',
          content: 'star',
          props: {},
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'Feature Title',
          props: { level: 3 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Brief description of this amazing feature and how it helps users.',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'faq',
    type: 'faq',
    name: 'FAQ Item',
    description: 'Question and answer pair',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'content',
    preview: () => ({
      id: generateId(),
      type: 'faq',
      label: 'FAQ',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'How does this work?',
          props: { level: 3 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Here is the detailed answer to this frequently asked question that explains everything clearly.',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'about',
    type: 'about',
    name: 'About Us',
    description: 'Company or personal introduction',
    icon: <LayoutTemplate className="w-5 h-5" />,
    category: 'content',
    preview: () => ({
      id: generateId(),
      type: 'about',
      label: 'About Us',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'About Our Company',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'We are a passionate team dedicated to creating amazing products that help people achieve their goals. Founded in 2020, we have grown to serve thousands of customers worldwide.',
          props: {},
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Our mission is to simplify complex processes and empower businesses to succeed in the digital age.',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'testimonials-grid',
    type: 'testimonial',
    name: 'Testimonials Grid',
    description: 'Multiple customer testimonials',
    icon: <Grid3X3 className="w-5 h-5" />,
    category: 'social',
    preview: () => ({
      id: generateId(),
      type: 'testimonial',
      label: 'Testimonials',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'What Our Customers Say',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: '"This product has completely transformed how we work. The results speak for themselves - 300% increase in productivity!"',
          props: {},
        },
        {
          id: generateId(),
          type: 'text',
          content: '— Sarah Johnson, CEO at TechCorp',
          props: { fontWeight: 'semibold' },
        },
        {
          id: generateId(),
          type: 'divider',
          content: '',
          props: {},
        },
        {
          id: generateId(),
          type: 'text',
          content: '"Best investment we have made this year. The support team is incredible and always ready to help."',
          props: {},
        },
        {
          id: generateId(),
          type: 'text',
          content: '— Michael Chen, Founder at StartupXYZ',
          props: { fontWeight: 'semibold' },
        },
      ],
      props: {},
    }),
  },
  {
    id: 'pricing',
    type: 'pricing',
    name: 'Pricing Table',
    description: 'Pricing plans comparison',
    icon: <List className="w-5 h-5" />,
    category: 'layout',
    preview: () => ({
      id: generateId(),
      type: 'pricing',
      label: 'Pricing',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Choose Your Plan',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Simple, transparent pricing that grows with you.',
          props: {},
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'Starter - $19/mo',
          props: { level: 3 },
        },
        {
          id: generateId(),
          type: 'text',
          content: '✓ Up to 1,000 contacts\n✓ Basic analytics\n✓ Email support',
          props: {},
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'Pro - $49/mo',
          props: { level: 3 },
        },
        {
          id: generateId(),
          type: 'text',
          content: '✓ Up to 10,000 contacts\n✓ Advanced analytics\n✓ Priority support\n✓ Custom integrations',
          props: {},
        },
        {
          id: generateId(),
          type: 'button',
          content: 'Get Started',
          props: {},
          styles: { backgroundColor: '#8B5CF6' },
        },
      ],
      props: {},
    }),
  },
  {
    id: 'faq-section',
    type: 'faq',
    name: 'FAQ Section',
    description: 'Multiple FAQ items',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'content',
    preview: () => ({
      id: generateId(),
      type: 'faq',
      label: 'FAQ Section',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Frequently Asked Questions',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'How do I get started?',
          props: { level: 4 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Simply sign up for a free account and follow our quick setup guide. You will be up and running in minutes!',
          props: {},
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'Is there a free trial?',
          props: { level: 4 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required.',
          props: {},
        },
        {
          id: generateId(),
          type: 'heading',
          content: 'Can I cancel anytime?',
          props: { level: 4 },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Absolutely. There are no long-term contracts. Cancel anytime with just a few clicks.',
          props: {},
        },
      ],
      props: {},
    }),
  },
  {
    id: 'trust-badges',
    type: 'trust',
    name: 'Trust Badges',
    description: 'Security and trust indicators',
    icon: <Star className="w-5 h-5" />,
    category: 'social',
    preview: () => ({
      id: generateId(),
      type: 'trust',
      label: 'Trust Badges',
      elements: [
        {
          id: generateId(),
          type: 'text',
          content: '🔒 256-bit SSL Encrypted',
          props: { textAlign: 'center' },
        },
        {
          id: generateId(),
          type: 'text',
          content: '⭐ 4.9/5 Rating from 2,000+ Reviews',
          props: { textAlign: 'center' },
        },
        {
          id: generateId(),
          type: 'text',
          content: '🏆 Trusted by 10,000+ Companies',
          props: { textAlign: 'center' },
        },
      ],
      props: {},
    }),
  },
  {
    id: 'logo-bar',
    type: 'logo-bar',
    name: 'Logo Bar',
    description: 'Partner or client logos in a row',
    icon: <Grid3X3 className="w-5 h-5" />,
    category: 'social',
    preview: () => ({
      id: generateId(),
      type: 'logo-bar',
      label: 'Logo Bar',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'Trusted By',
          props: { level: 4, textAlign: 'center' },
        },
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: { src: '/placeholder.svg', objectFit: 'contain', alt: 'Partner Logo 1' },
          styles: { width: '100px', height: '40px' },
        },
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: { src: '/placeholder.svg', objectFit: 'contain', alt: 'Partner Logo 2' },
          styles: { width: '100px', height: '40px' },
        },
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: { src: '/placeholder.svg', objectFit: 'contain', alt: 'Partner Logo 3' },
          styles: { width: '100px', height: '40px' },
        },
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: { src: '/placeholder.svg', objectFit: 'contain', alt: 'Partner Logo 4' },
          styles: { width: '100px', height: '40px' },
        },
        {
          id: generateId(),
          type: 'image',
          content: '',
          props: { src: '/placeholder.svg', objectFit: 'contain', alt: 'Partner Logo 5' },
          styles: { width: '100px', height: '40px' },
        },
      ],
      props: { direction: 'row', justifyContent: 'center', alignItems: 'center', gap: '24px', wrap: true },
    }),
  },
  {
    id: 'footer-links',
    type: 'footer',
    name: 'Footer Links',
    description: 'Terms, privacy and legal links',
    icon: <LayoutTemplate className="w-5 h-5" />,
    category: 'layout',
    preview: () => ({
      id: generateId(),
      type: 'footer',
      label: 'Footer',
      elements: [
        {
          id: generateId(),
          type: 'text',
          content: 'Terms of Use',
          props: { linkUrl: '/terms', fontSize: '12px', textAlign: 'center' },
        },
        {
          id: generateId(),
          type: 'text',
          content: 'Privacy Policy',
          props: { linkUrl: '/privacy', fontSize: '12px', textAlign: 'center' },
        },
        {
          id: generateId(),
          type: 'text',
          content: `© ${new Date().getFullYear()} Company Name`,
          props: { fontSize: '12px', textAlign: 'center' },
        },
      ],
      props: { direction: 'row', justifyContent: 'center', alignItems: 'center', gap: '16px' },
    }),
},
];

// Page Templates - multi-block presets
interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  blocks: () => Block[];
}

const pageTemplates: PageTemplate[] = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Hero, Features, CTA, and Footer',
    icon: <FileText className="w-5 h-5" />,
    blocks: () => [
      blockTemplates.find(t => t.id === 'hero')!.preview(),
      blockTemplates.find(t => t.id === 'feature')!.preview(),
      blockTemplates.find(t => t.id === 'testimonial')!.preview(),
      blockTemplates.find(t => t.id === 'cta')!.preview(),
      blockTemplates.find(t => t.id === 'footer-links')!.preview(),
    ],
  },
  {
    id: 'coming-soon',
    name: 'Coming Soon',
    description: 'Teaser page with email capture',
    icon: <FileText className="w-5 h-5" />,
    blocks: () => [
      {
        id: generateId(),
        type: 'hero' as BlockType,
        label: 'Coming Soon Hero',
        elements: [
          { id: generateId(), type: 'heading', content: 'Something Amazing is Coming', props: { level: 1, textAlign: 'center' } },
          { id: generateId(), type: 'text', content: 'We\'re working hard to bring you something special. Stay tuned!', props: { textAlign: 'center' } },
        ],
        props: {},
      },
      blockTemplates.find(t => t.id === 'form')!.preview(),
      blockTemplates.find(t => t.id === 'trust-badges')!.preview(),
    ],
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Optimized for email collection',
    icon: <FileText className="w-5 h-5" />,
    blocks: () => [
      {
        id: generateId(),
        type: 'hero' as BlockType,
        label: 'Lead Capture Hero',
        elements: [
          { id: generateId(), type: 'heading', content: 'Get Your Free Guide', props: { level: 1, textAlign: 'center' } },
          { id: generateId(), type: 'text', content: 'Download our exclusive guide and learn the secrets to success.', props: { textAlign: 'center' } },
        ],
        props: {},
      },
      blockTemplates.find(t => t.id === 'form')!.preview(),
      blockTemplates.find(t => t.id === 'trust-badges')!.preview(),
      blockTemplates.find(t => t.id === 'faq-section')!.preview(),
      blockTemplates.find(t => t.id === 'footer-links')!.preview(),
    ],
  },
];

const categories = [
  { id: 'all', name: 'All Blocks', icon: <Grid3X3 className="w-4 h-4" /> },
  { id: 'layout', name: 'Layout', icon: <LayoutTemplate className="w-4 h-4" /> },
  { id: 'content', name: 'Content', icon: <Type className="w-4 h-4" /> },
  { id: 'form', name: 'Forms', icon: <FormInput className="w-4 h-4" /> },
  { id: 'media', name: 'Media', icon: <Image className="w-4 h-4" /> },
  { id: 'social', name: 'Social Proof', icon: <Quote className="w-4 h-4" /> },
];

interface BlockPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (block: Block) => void;
  onAddBlocks?: (blocks: Block[]) => void;
  onOpenAIGenerate?: () => void;
}

export const BlockPalette: React.FC<BlockPaletteProps> = ({
  isOpen,
  onClose,
  onAddBlock,
  onAddBlocks,
  onOpenAIGenerate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'blocks' | 'templates'>('blocks');

  const filteredTemplates = blockTemplates.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddBlock = (template: BlockTemplate) => {
    const newBlock = template.preview();
    onAddBlock(newBlock);
    onClose();
  };

  const handleAddPageTemplate = (template: PageTemplate) => {
    const blocks = template.blocks();
    if (onAddBlocks) {
      onAddBlocks(blocks);
    } else {
      // Fallback: add blocks one by one
      blocks.forEach(block => onAddBlock(block));
    }
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="left" 
        className="w-80 bg-builder-surface border-builder-border p-0 flex flex-col"
      >
        <SheetHeader className="p-4 border-b border-builder-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-builder-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-builder-accent" />
              Block Palette
            </SheetTitle>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-builder-text-muted" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 builder-input"
            />
          </div>
        </SheetHeader>

        {/* Tabs for Blocks vs Page Templates */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'blocks' | 'templates')} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-3 grid grid-cols-2 bg-builder-surface-hover">
            <TabsTrigger value="blocks" className="text-xs data-[state=active]:bg-builder-accent data-[state=active]:text-white">
              Blocks
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs data-[state=active]:bg-builder-accent data-[state=active]:text-white">
              Page Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocks" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
            {/* Categories */}
            <div className="flex gap-1 p-3 border-b border-builder-border overflow-x-auto builder-scroll">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                    activeCategory === category.id
                      ? 'bg-builder-accent text-white'
                      : 'text-builder-text-muted hover:bg-builder-surface-hover hover:text-builder-text'
                  )}
                >
                  {category.icon}
                  {category.name}
                </button>
              ))}
            </div>

            {/* Block List */}
            <div className="flex-1 overflow-y-auto builder-scroll p-3 space-y-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleAddBlock(template)}
                  className="w-full text-left p-4 rounded-xl bg-builder-bg border border-builder-border-subtle hover:border-builder-accent/50 hover:bg-builder-surface-hover transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-builder-surface-hover text-builder-accent group-hover:bg-builder-accent/10">
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-builder-text">
                          {template.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-builder-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-builder-text-muted mt-0.5">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-builder-text-muted">No blocks match "{searchQuery}"</p>
                  <p className="text-xs text-builder-text-dim mt-2 mb-4">Try a different search or generate with AI</p>
                  <button
                    onClick={() => {
                      onOpenAIGenerate?.();
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-builder-accent/10 text-builder-accent hover:bg-builder-accent/20 transition-colors text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with AI instead
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
            {/* Page Templates List */}
            <div className="flex-1 overflow-y-auto builder-scroll p-3 space-y-2">
              <p className="text-xs text-builder-text-muted px-1 pb-2">
                Add multiple blocks at once with pre-built page layouts
              </p>
              {pageTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleAddPageTemplate(template)}
                  className="w-full text-left p-4 rounded-xl bg-builder-bg border border-builder-border-subtle hover:border-builder-accent/50 hover:bg-builder-surface-hover transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-builder-accent/20 to-intent-qualify/20 text-builder-accent group-hover:from-builder-accent/30 group-hover:to-intent-qualify/30">
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-builder-text">
                          {template.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-builder-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-builder-text-muted mt-0.5">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* AI Generate Section */}
        <div className="p-4 border-t border-builder-border">
          <button 
            onClick={() => {
              onOpenAIGenerate?.();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-builder-accent to-intent-qualify text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};