import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Eye,
  Globe,
  Settings,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  Trash2,
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  Type,
  Square,
  Image,
  Video,
  Calendar,
  Mail,
  Phone,
  CheckCircle,
  AlignLeft,
  Minus,
  Layers,
  PanelLeft,
  Sparkles,
  GripVertical,
  Copy,
  MoreHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

// Builder V2 imports
import '@/builder_v2/EditorLayout.css';
import { CanvasEditor } from '@/builder_v2/canvas/CanvasEditor';
import { EditorProvider, useEditorStore, generateNodeId } from '@/builder_v2/state/editorStore';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import { getDefaultTemplateForStepType, PAGE_TEMPLATES, type PageTemplate } from '@/builder_v2/templates/pageTemplates';
import type { Page, CanvasNode } from '@/builder_v2/types';

// Types
type FunnelRow = {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  builder_document: EditorDocument | null;
  updated_at: string;
};

type DeviceType = 'phone' | 'tablet' | 'desktop';

// Step type config
const PAGE_TYPES = [
  { type: 'welcome', label: 'Welcome', icon: '👋', description: 'Introduction screen' },
  { type: 'video', label: 'Video', icon: '🎬', description: 'Video content' },
  { type: 'multi_choice', label: 'Question', icon: '❓', description: 'Multiple choice' },
  { type: 'text_question', label: 'Text Input', icon: '✏️', description: 'Open answer' },
  { type: 'email_capture', label: 'Email', icon: '📧', description: 'Collect email' },
  { type: 'phone_capture', label: 'Phone', icon: '📱', description: 'Collect phone' },
  { type: 'opt_in', label: 'Form', icon: '📋', description: 'Contact form' },
  { type: 'embed', label: 'Calendar', icon: '📅', description: 'Book a call' },
  { type: 'thank_you', label: 'Thank You', icon: '🎉', description: 'Confirmation' },
];

// Element types for adding to pages
const ELEMENT_TYPES = [
  { type: 'heading', label: 'Heading', icon: Type, category: 'text' },
  { type: 'paragraph', label: 'Text', icon: AlignLeft, category: 'text' },
  { type: 'cta_button', label: 'Button', icon: Square, category: 'action' },
  { type: 'text_input', label: 'Text Input', icon: Type, category: 'form' },
  { type: 'email_input', label: 'Email', icon: Mail, category: 'form' },
  { type: 'phone_input', label: 'Phone', icon: Phone, category: 'form' },
  { type: 'option_grid', label: 'Options', icon: CheckCircle, category: 'form' },
  { type: 'video_embed', label: 'Video', icon: Video, category: 'media' },
  { type: 'calendar_embed', label: 'Calendar', icon: Calendar, category: 'media' },
  { type: 'image', label: 'Image', icon: Image, category: 'media' },
  { type: 'spacer', label: 'Spacer', icon: Minus, category: 'layout' },
  { type: 'divider', label: 'Divider', icon: Minus, category: 'layout' },
];

// Loading state component
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Device Frame Component
function DeviceFrame({ 
  device, 
  children,
  slug,
}: { 
  device: DeviceType; 
  children: React.ReactNode;
  slug?: string;
}) {
  if (device === 'phone') {
    return (
      <div className="device-frame--phone">
        <div className="device-notch">
          <div className="device-notch-inner" />
        </div>
        <div className="device-screen">
          <div className="device-screen-content">{children}</div>
        </div>
        <div className="device-home-bar">
          <div className="device-home-indicator" />
        </div>
      </div>
    );
  }
  
  if (device === 'tablet') {
    return (
      <div className="device-frame--tablet">
        <div className="device-screen">
          <div className="device-screen-content">{children}</div>
        </div>
        <div className="device-home-bar">
          <div className="device-home-indicator" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="device-frame--desktop">
      <div className="device-browser-bar">
        <div className="device-browser-dots">
          <div className="device-browser-dot device-browser-dot--red" />
          <div className="device-browser-dot device-browser-dot--yellow" />
          <div className="device-browser-dot device-browser-dot--green" />
        </div>
        <div className="device-browser-url">
          {slug ? `yoursite.com/f/${slug}` : 'yoursite.com'}
        </div>
      </div>
      <div className="device-screen">
        <div className="device-screen-content">{children}</div>
      </div>
    </div>
  );
}

// Settings dialog
function SettingsDialog({ 
  funnel, 
  open,
  onOpenChange,
  onSave 
}: { 
  funnel: FunnelRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<FunnelRow>) => void;
}) {
  const [name, setName] = useState(funnel.name);
  const [slug, setSlug] = useState(funnel.slug);

  const handleSave = () => {
    onSave({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Funnel Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Funnel Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL Slug</Label>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input 
                value={slug} 
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                className="border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add Page Modal
function AddPageModal({
  open,
  onOpenChange,
  onAddPage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPage: (template: PageTemplate) => void;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  const templatesForType = selectedType 
    ? PAGE_TEMPLATES.filter(t => {
        if (selectedType === 'welcome' || selectedType === 'video') return t.category === 'welcome';
        if (selectedType === 'multi_choice' || selectedType === 'text_question') return t.category === 'question';
        if (selectedType === 'email_capture' || selectedType === 'phone_capture' || selectedType === 'opt_in') return t.category === 'capture';
        if (selectedType === 'embed') return t.category === 'booking';
        if (selectedType === 'thank_you') return t.category === 'thank_you';
        return false;
      })
    : [];

  const handleClose = () => {
    onOpenChange(false);
    setSelectedType(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedType && (
              <button 
                onClick={() => setSelectedType(null)}
                className="mr-1 rounded p-1 hover:bg-muted"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {selectedType ? 'Choose Template' : 'Add New Page'}
          </DialogTitle>
        </DialogHeader>
        
        {!selectedType ? (
          <div className="grid grid-cols-3 gap-2 py-4">
            {PAGE_TYPES.map((page) => (
              <button
                key={page.type}
                onClick={() => setSelectedType(page.type)}
                className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="text-2xl">{page.icon}</span>
                <span className="text-sm font-medium">{page.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 py-4">
            {templatesForType.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onAddPage(template);
                  handleClose();
                }}
                className="flex w-full items-center gap-4 rounded-xl border bg-background p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium">{template.name}</h4>
                  <p className="truncate text-sm text-muted-foreground">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Pages List Sidebar
function PagesSidebar({
  pages,
  activePageId,
  onSelectPage,
  onDeletePage,
  onAddPage,
}: {
  pages: Page[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onAddPage: () => void;
}) {
  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Pages</span>
        </div>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{pages.length}</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {pages.map((page, i) => {
            const isActive = page.id === activePageId;
            return (
              <div
                key={page.id}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                  isActive 
                    ? "bg-primary/10 ring-1 ring-primary/20" 
                    : "hover:bg-muted/50"
                )}
                onClick={() => onSelectPage(page.id)}
              >
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </span>
                <span className={cn(
                  "flex-1 truncate text-sm font-medium",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {page.name}
                </span>
                {pages.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                        <Copy size={14} className="mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <button
          onClick={onAddPage}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
        >
          <Plus size={16} />
          Add Page
        </button>
      </div>
    </div>
  );
}

// Elements Panel
function ElementsPanel({
  onAddElement,
}: {
  onAddElement: (type: string) => void;
}) {
  const categories = [
    { id: 'text', label: 'Text' },
    { id: 'action', label: 'Action' },
    { id: 'form', label: 'Form' },
    { id: 'media', label: 'Media' },
    { id: 'layout', label: 'Layout' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <span className="text-sm font-semibold">Elements</span>
        <p className="text-xs text-muted-foreground">Click to add to page</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3">
          {categories.map((cat) => {
            const elements = ELEMENT_TYPES.filter(e => e.category === cat.id);
            if (elements.length === 0) return null;
            
            return (
              <div key={cat.id} className="mb-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {cat.label}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {elements.map((el) => (
                    <button
                      key={el.type}
                      onClick={() => onAddElement(el.type)}
                      className="flex flex-col items-center gap-1.5 rounded-lg border bg-background p-3 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
                    >
                      <el.icon size={18} className="text-primary" />
                      <span className="text-xs font-medium">{el.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Inspector Panel for editing selected elements
function InspectorPanel() {
  const { pages, activePageId, selectedNodeId, updateNodeProps, updatePageProps } = useEditorStore();
  const page = pages.find((p) => p.id === activePageId);
  
  if (!page) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Select a page to edit</p>
      </div>
    );
  }

  // Find selected node recursively
  const findNode = (node: CanvasNode, id: string): CanvasNode | null => {
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };
  
  const selectedNode = selectedNodeId ? findNode(page.canvasRoot, selectedNodeId) : null;
  const nodeProps = selectedNode?.props || {};

  const handleChange = (key: string, value: unknown) => {
    if (selectedNode) {
      updateNodeProps(selectedNode.id, { [key]: value });
    }
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      frame: 'Page',
      section: 'Section',
      heading: 'Heading',
      paragraph: 'Text',
      cta_button: 'Button',
      text_input: 'Text Input',
      email_input: 'Email Input',
      phone_input: 'Phone Input',
      option_grid: 'Options',
      video_embed: 'Video',
      calendar_embed: 'Calendar',
      spacer: 'Spacer',
      divider: 'Divider',
      icon: 'Icon',
      image: 'Image',
    };
    return names[type] || type.replace(/_/g, ' ');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">
          {selectedNode ? getTypeName(selectedNode.type) : page.name}
        </h3>
        <p className="text-xs text-muted-foreground">
          {selectedNode ? 'Edit element properties' : 'Page settings'}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedNode ? (
            <div className="space-y-5">
              {/* Text Content */}
              {(nodeProps.text !== undefined) && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Content</Label>
                  {selectedNode.type === 'heading' ? (
                    <Input
                      value={(nodeProps.text as string) || ''}
                      onChange={(e) => handleChange('text', e.target.value)}
                      placeholder="Heading text..."
                    />
                  ) : (
                    <textarea
                      value={(nodeProps.text as string) || ''}
                      onChange={(e) => handleChange('text', e.target.value)}
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Enter text..."
                    />
                  )}
                </div>
              )}

              {/* Button Label */}
              {nodeProps.label !== undefined && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Button Text</Label>
                  <Input
                    value={(nodeProps.label as string) || ''}
                    onChange={(e) => handleChange('label', e.target.value)}
                    placeholder="Button label..."
                  />
                </div>
              )}

              {/* Placeholder */}
              {nodeProps.placeholder !== undefined && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Placeholder</Label>
                  <Input
                    value={(nodeProps.placeholder as string) || ''}
                    onChange={(e) => handleChange('placeholder', e.target.value)}
                    placeholder="Placeholder text..."
                  />
                </div>
              )}

              {/* URL for video/calendar */}
              {nodeProps.url !== undefined && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {selectedNode.type === 'video_embed' ? 'Video URL' : 'Embed URL'}
                  </Label>
                  <Input
                    value={(nodeProps.url as string) || ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedNode.type === 'video_embed' 
                      ? 'YouTube, Vimeo, or Loom'
                      : 'Calendly or Cal.com link'}
                  </p>
                </div>
              )}

              {/* Spacer height */}
              {nodeProps.height !== undefined && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Height (px)</Label>
                  <Input
                    type="number"
                    value={(nodeProps.height as number) || 24}
                    onChange={(e) => handleChange('height', parseInt(e.target.value) || 24)}
                    min={8}
                    max={200}
                  />
                </div>
              )}

              {/* Options */}
              {nodeProps.options && Array.isArray(nodeProps.options) && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Options</Label>
                  <div className="space-y-2">
                    {(nodeProps.options as Array<{id: string; label: string; emoji?: string}>).map((opt, i) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.emoji || ''}
                          onChange={(e) => {
                            const newOpts = [...(nodeProps.options as Array<{id: string; label: string; emoji?: string}>)];
                            newOpts[i] = { ...opt, emoji: e.target.value };
                            handleChange('options', newOpts);
                          }}
                          className="w-10 rounded border bg-background p-2 text-center text-sm"
                          placeholder="✨"
                        />
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const newOpts = [...(nodeProps.options as Array<{id: string; label: string; emoji?: string}>)];
                            newOpts[i] = { ...opt, label: e.target.value };
                            handleChange('options', newOpts);
                          }}
                          className="flex-1"
                        />
                        {(nodeProps.options as Array<{id: string; label: string; emoji?: string}>).length > 2 && (
                          <button
                            onClick={() => handleChange('options', (nodeProps.options as Array<{id: string; label: string; emoji?: string}>).filter((_, idx) => idx !== i))}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleChange('options', [...(nodeProps.options as Array<{id: string; label: string; emoji?: string}>), { id: `opt${Date.now()}`, label: 'New Option', emoji: '✨' }])}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-2 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Page Name</Label>
                <Input
                  value={page.name}
                  onChange={(e) => updatePageProps(page.id, { name: e.target.value })}
                />
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Tip:</span> Click elements in the preview to edit them
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Main Editor Content
function EditorContent({ 
  funnel, 
  teamId,
  onSave,
  onPublish,
  onUpdateSettings,
  isSaving,
  isPublishing,
}: { 
  funnel: FunnelRow;
  teamId: string;
  onSave: () => void;
  onPublish: () => void;
  onUpdateSettings: (updates: Partial<FunnelRow>) => void;
  isSaving: boolean;
  isPublishing: boolean;
}) {
  const navigate = useNavigate();
  const {
    pages,
    activePageId,
    editorState,
    setActivePage,
    selectNode,
    addNode,
    undo,
    redo,
    canUndo,
    canRedo,
    highlightedNodeIds,
    deletePage,
    dispatch,
  } = useEditorStore();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  const [device, setDevice] = useState<DeviceType>('phone');
  const [leftTab, setLeftTab] = useState<'pages' | 'elements'>('pages');
  
  const activePage = pages.find((p) => p.id === activePageId);
  const activePageIndex = pages.findIndex((p) => p.id === activePageId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) { if (canRedo) redo(); }
        else { if (canUndo) undo(); }
      }
      if (mod && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo, onSave]);

  const handleAddPage = (template: PageTemplate) => {
    const newPage: Page = {
      id: `page-${Date.now()}`,
      name: template.name,
      type: template.category === 'welcome' ? 'landing' : 
            template.category === 'booking' ? 'appointment' :
            template.category === 'capture' ? 'optin' :
            template.category === 'thank_you' ? 'thank_you' : 'landing',
      canvasRoot: template.createNodes(),
    };
    dispatch({ type: 'ADD_PAGE', page: newPage });
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Need at least one page', variant: 'destructive' });
      return;
    }
    deletePage(pageId);
  };

  const handleAddElement = (type: string) => {
    if (!activePage) return;
    
    // Find first section or add to root
    const findFirstContainer = (node: CanvasNode): string | null => {
      if (node.type === 'section') return node.id;
      for (const child of node.children) {
        const found = findFirstContainer(child);
        if (found) return found;
      }
      return null;
    };
    
    const parentId = findFirstContainer(activePage.canvasRoot) || activePage.canvasRoot.id;
    addNode(parentId, type);
  };

  const previewUrl = `${window.location.origin}/f/${funnel.slug}`;

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/team/${teamId}/funnels`)}
            className="flex items-center gap-2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-semibold">{funnel.name}</h1>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                funnel.status === 'published' ? "bg-green-500" : "bg-amber-500"
              )} />
              <span className="text-xs text-muted-foreground">
                {funnel.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        {/* Center - Mode & Device */}
        <div className="flex items-center gap-4">
          {/* Device Switcher */}
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            {[
              { type: 'phone' as DeviceType, icon: Smartphone, label: 'Phone' },
              { type: 'tablet' as DeviceType, icon: Tablet, label: 'Tablet' },
              { type: 'desktop' as DeviceType, icon: Monitor, label: 'Desktop' },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setDevice(type)}
                className={cn(
                  "rounded-md p-2 transition-all",
                  device === type 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={label}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            <button
              onClick={() => setMode('edit')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                mode === 'edit' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                mode === 'preview' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={() => window.open(previewUrl, '_blank')}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="View Live"
          >
            <ExternalLink size={18} />
          </button>
          <div className="mx-2 h-6 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
            <Save size={14} className="mr-1.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" onClick={onPublish} disabled={isPublishing}>
            <Globe size={14} className="mr-1.5" />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {mode === 'edit' && (
          <aside className="w-60 shrink-0">
            <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as 'pages' | 'elements')} className="flex h-full flex-col">
              <TabsList className="mx-2 mt-2 grid w-auto grid-cols-2">
                <TabsTrigger value="pages" className="text-xs">
                  <Layers size={14} className="mr-1.5" />
                  Pages
                </TabsTrigger>
                <TabsTrigger value="elements" className="text-xs">
                  <Plus size={14} className="mr-1.5" />
                  Elements
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pages" className="m-0 flex-1 overflow-hidden">
                <PagesSidebar
                  pages={pages}
                  activePageId={activePageId}
                  onSelectPage={setActivePage}
                  onDeletePage={handleDeletePage}
                  onAddPage={() => setShowAddPage(true)}
                />
              </TabsContent>
              <TabsContent value="elements" className="m-0 flex-1 overflow-hidden border-r bg-background">
                <ElementsPanel onAddElement={handleAddElement} />
              </TabsContent>
            </Tabs>
          </aside>
        )}

        {/* Canvas */}
        <main className="relative flex-1 overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="absolute left-4 right-4 top-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur-sm">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  canUndo ? "text-foreground hover:bg-muted" : "text-muted-foreground/40"
                )}
                title="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  canRedo ? "text-foreground hover:bg-muted" : "text-muted-foreground/40"
                )}
                title="Redo"
              >
                <Redo2 size={16} />
              </button>
            </div>
            
            {pages.length > 1 && (
              <div className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur-sm">
                <button
                  onClick={() => activePageIndex > 0 && setActivePage(pages[activePageIndex - 1].id)}
                  disabled={activePageIndex === 0}
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    activePageIndex > 0 ? "hover:bg-muted" : "text-muted-foreground/40"
                  )}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[50px] text-center text-xs font-medium">
                  {activePageIndex + 1} / {pages.length}
                </span>
                <button
                  onClick={() => activePageIndex < pages.length - 1 && setActivePage(pages[activePageIndex + 1].id)}
                  disabled={activePageIndex === pages.length - 1}
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    activePageIndex < pages.length - 1 ? "hover:bg-muted" : "text-muted-foreground/40"
                  )}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex h-full items-center justify-center overflow-auto p-8">
            <DeviceFrame device={device} slug={funnel.slug}>
              {activePage ? (
                <CanvasEditor
                  page={activePage}
                  editorState={editorState}
                  mode={mode === 'preview' ? 'preview' : 'canvas'}
                  onSelectNode={selectNode}
                  highlightedNodeIds={highlightedNodeIds}
                  funnelPosition={activePageIndex}
                  totalPages={pages.length}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select a page to edit
                </div>
              )}
            </DeviceFrame>
          </div>
        </main>

        {/* Right Sidebar - Inspector */}
        {mode === 'edit' && (
          <aside className="w-72 shrink-0 border-l bg-background">
            <InspectorPanel />
          </aside>
        )}
      </div>

      {/* Modals */}
      <SettingsDialog 
        funnel={funnel} 
        open={showSettings} 
        onOpenChange={setShowSettings}
        onSave={onUpdateSettings} 
      />
      <AddPageModal
        open={showAddPage}
        onOpenChange={setShowAddPage}
        onAddPage={handleAddPage}
      />
    </div>
  );
}

// Wrapper with mutations
function FunnelEditorWithData({ funnel, teamId }: { funnel: FunnelRow; teamId: string }) {
  const queryClient = useQueryClient();
  const { pages: editorPages, activePageId } = useEditorStore();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const doc = extractDocument(editorPages, activePageId);
      const { error } = await supabase
        .from('funnels')
        .update({ builder_document: doc as unknown as Json, updated_at: new Date().toISOString() })
        .eq('id', funnel.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: () => toast({ title: '✓ Saved' }),
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const doc = extractDocument(editorPages, activePageId);
      const snapshot = {
        version: 1,
        publishedAt: Date.now(),
        pages: doc.pages,
        activePageId: doc.activePageId,
      };
      const { error } = await supabase
        .from('funnels')
        .update({ 
          builder_document: doc as unknown as Json,
          published_document_snapshot: snapshot as unknown as Json,
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', funnel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnel.id] });
      toast({ title: '🚀 Published!', description: `Live at /f/${funnel.slug}` });
    },
    onError: () => toast({ title: 'Publish failed', variant: 'destructive' }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<FunnelRow, 'name' | 'slug'>>) => {
      const { error } = await supabase.from('funnels').update(updates).eq('id', funnel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnel.id] });
      toast({ title: 'Settings updated' });
    },
    onError: (error: Error) => {
      toast({ 
        title: error.message.includes('duplicate') ? 'URL already taken' : 'Update failed', 
        variant: 'destructive' 
      });
    },
  });

  return (
    <EditorContent
      funnel={funnel}
      teamId={teamId}
      onSave={() => saveMutation.mutate()}
      onPublish={() => publishMutation.mutate()}
      onUpdateSettings={(u) => updateSettingsMutation.mutate(u)}
      isSaving={saveMutation.isPending}
      isPublishing={publishMutation.isPending}
    />
  );
}

// Main export
export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const { loading: isRoleLoading } = useTeamRole(teamId);
  const navigate = useNavigate();

  const funnelQuery = useQuery({
    queryKey: ['funnel-editor', funnelId],
    enabled: !!funnelId && !isRoleLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('id, team_id, name, slug, status, settings, builder_document, updated_at')
        .eq('id', funnelId!)
        .single();
      if (error) throw error;
      return data as unknown as FunnelRow;
    },
  });

  // Initialize document if needed
  useEffect(() => {
    const doc = funnelQuery.data?.builder_document;
    const needsInit = !doc || !doc.pages?.[0]?.canvasRoot;
    
    if (funnelQuery.data && needsInit) {
      const template = getDefaultTemplateForStepType('welcome');
      const initialDoc: EditorDocument = {
        version: 1,
        pages: [{
          id: 'page-1',
          name: 'Welcome',
          type: 'landing',
          canvasRoot: template.createNodes(),
        }],
        activePageId: 'page-1',
      };

      supabase
        .from('funnels')
        .update({ builder_document: initialDoc as unknown as Json })
        .eq('id', funnelId!)
        .then(({ error }) => {
          if (!error) funnelQuery.refetch();
        });
    }
  }, [funnelQuery.data, funnelId]);

  if (!teamId || !funnelId) return <LoadingState message="Invalid route" />;
  if (isRoleLoading || funnelQuery.isLoading) return <LoadingState message="Loading..." />;
  if (funnelQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Failed to load funnel</p>
        <Button onClick={() => navigate(`/team/${teamId}/funnels`)}>Back</Button>
      </div>
    );
  }

  const funnel = funnelQuery.data;
  if (!funnel?.builder_document) return <LoadingState message="Initializing..." />;

  return (
    <EditorProvider key={`editor-${funnelId}`} initialDocument={funnel.builder_document}>
      <FunnelEditorWithData funnel={funnel} teamId={teamId} />
    </EditorProvider>
  );
}
