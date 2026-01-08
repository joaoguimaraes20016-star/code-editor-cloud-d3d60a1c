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
  Monitor,
  Zap,
  Sparkles,
  MousePointer,
  Hand,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

// Builder V2 imports
import '@/builder_v2/EditorLayout.css';
import { PhoneFrame } from '@/builder_v2/canvas/PhoneFrame';
import { CanvasEditor } from '@/builder_v2/canvas/CanvasEditor';
import { StructureTree } from '@/builder_v2/structure/StructureTree';
import { EditorProvider, useEditorStore } from '@/builder_v2/state/editorStore';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import { getDefaultTemplateForStepType, PAGE_TEMPLATES, type PageTemplate } from '@/builder_v2/templates/pageTemplates';
import type { Page } from '@/builder_v2/types';

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

// Step type config with nice labels and icons
const STEP_TYPES = [
  { type: 'welcome', label: 'Welcome', icon: '👋', description: 'Introduce your funnel' },
  { type: 'video', label: 'Video', icon: '🎬', description: 'Share a video message' },
  { type: 'multi_choice', label: 'Question', icon: '❓', description: 'Multiple choice question' },
  { type: 'text_question', label: 'Open Question', icon: '✏️', description: 'Open-ended response' },
  { type: 'email_capture', label: 'Email', icon: '📧', description: 'Collect email address' },
  { type: 'phone_capture', label: 'Phone', icon: '📱', description: 'Collect phone number' },
  { type: 'opt_in', label: 'Contact Form', icon: '📋', description: 'Full contact form' },
  { type: 'embed', label: 'Calendar', icon: '📅', description: 'Booking embed' },
  { type: 'thank_you', label: 'Thank You', icon: '🎉', description: 'Confirmation page' },
];

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
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
            <Label className="text-sm font-medium">Funnel Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">URL Slug</Label>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-500">{window.location.origin}/f/</span>
              <Input 
                value={slug} 
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                className="border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
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

// Add Step Modal with templates
function AddStepModal({
  open,
  onOpenChange,
  onAddStep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStep: (template: PageTemplate) => void;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedType ? 'Choose a Template' : 'Add New Step'}
          </DialogTitle>
        </DialogHeader>
        
        {!selectedType ? (
          <div className="grid grid-cols-3 gap-3 py-4">
            {STEP_TYPES.map((step) => (
              <button
                key={step.type}
                onClick={() => setSelectedType(step.type)}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm"
              >
                <span className="text-2xl">{step.icon}</span>
                <span className="text-sm font-medium text-slate-700">{step.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <button 
              onClick={() => setSelectedType(null)}
              className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft size={14} /> Back to step types
            </button>
            {templatesForType.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onAddStep(template);
                  onOpenChange(false);
                  setSelectedType(null);
                }}
                className="flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <Sparkles size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800">{template.name}</h4>
                  <p className="text-sm text-slate-500">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Polished Inspector Panel
function InspectorPanel() {
  const { pages, activePageId, selectedNodeId, updateNodeProps, updatePageProps } = useEditorStore();
  const page = pages.find((p) => p.id === activePageId);
  
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="text-slate-400">
          <Sparkles className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="text-sm">Select a page to edit</p>
        </div>
      </div>
    );
  }

  // Find selected node
  const findNode = (node: any, id: string): any => {
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };
  
  const selectedNode = selectedNodeId ? findNode(page.canvasRoot, selectedNodeId) : null;
  const nodeProps = selectedNode?.props || {};

  const handleChange = (key: string, value: any) => {
    if (selectedNode) {
      updateNodeProps(selectedNode.id, { [key]: value });
    }
  };

  // Get readable type name
  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      welcome_step: 'Welcome Screen',
      text_question_step: 'Text Question',
      multi_choice_step: 'Multiple Choice',
      email_capture_step: 'Email Capture',
      phone_capture_step: 'Phone Capture',
      opt_in_step: 'Opt-in Form',
      video_step: 'Video',
      embed_step: 'Calendar Booking',
      thank_you_step: 'Thank You',
      frame: 'Page Frame',
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
    };
    return names[type] || type;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="font-semibold text-slate-800">
          {selectedNode ? getTypeName(selectedNode.type) : page.name}
        </h3>
        <p className="text-xs text-slate-500">
          {selectedNode ? 'Edit element' : 'Page settings'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <div className="space-y-5">
            {/* Text Content */}
            {(nodeProps.headline !== undefined || nodeProps.text !== undefined) && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Text Content
                </label>
                {nodeProps.headline !== undefined && (
                  <div>
                    <label className="mb-1.5 block text-sm text-slate-600">Headline</label>
                    <Input
                      value={nodeProps.headline || ''}
                      onChange={(e) => handleChange('headline', e.target.value)}
                      className="bg-slate-50"
                    />
                  </div>
                )}
                {nodeProps.text !== undefined && (
                  <div>
                    <label className="mb-1.5 block text-sm text-slate-600">Text</label>
                    <Input
                      value={nodeProps.text || ''}
                      onChange={(e) => handleChange('text', e.target.value)}
                      className="bg-slate-50"
                    />
                  </div>
                )}
                {nodeProps.subtext !== undefined && (
                  <div>
                    <label className="mb-1.5 block text-sm text-slate-600">Description</label>
                    <textarea
                      value={nodeProps.subtext || ''}
                      onChange={(e) => handleChange('subtext', e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Button */}
            {(nodeProps.buttonText !== undefined || nodeProps.label !== undefined) && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button
                </label>
                <div>
                  <label className="mb-1.5 block text-sm text-slate-600">Button Text</label>
                  <Input
                    value={nodeProps.buttonText || nodeProps.label || ''}
                    onChange={(e) => handleChange(nodeProps.buttonText !== undefined ? 'buttonText' : 'label', e.target.value)}
                    className="bg-slate-50"
                  />
                </div>
              </div>
            )}

            {/* Input Placeholder */}
            {nodeProps.placeholder !== undefined && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Input Field
                </label>
                <div>
                  <label className="mb-1.5 block text-sm text-slate-600">Placeholder</label>
                  <Input
                    value={nodeProps.placeholder || ''}
                    onChange={(e) => handleChange('placeholder', e.target.value)}
                    className="bg-slate-50"
                  />
                </div>
              </div>
            )}

            {/* Video/Embed URL */}
            {(nodeProps.videoUrl !== undefined || nodeProps.url !== undefined) && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Media
                </label>
                <div>
                  <label className="mb-1.5 block text-sm text-slate-600">
                    {nodeProps.videoUrl !== undefined ? 'Video URL' : 'Embed URL'}
                  </label>
                  <Input
                    value={nodeProps.videoUrl || nodeProps.url || ''}
                    onChange={(e) => handleChange(nodeProps.videoUrl !== undefined ? 'videoUrl' : 'url', e.target.value)}
                    placeholder="https://..."
                    className="bg-slate-50"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {nodeProps.videoUrl !== undefined 
                      ? 'YouTube, Vimeo, or Loom URL'
                      : 'Calendly, Cal.com, or embed URL'}
                  </p>
                </div>
              </div>
            )}

            {/* Options */}
            {nodeProps.options && Array.isArray(nodeProps.options) && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Answer Options
                </label>
                <div className="space-y-2">
                  {nodeProps.options.map((opt: any, i: number) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.emoji || ''}
                        onChange={(e) => {
                          const newOpts = [...nodeProps.options];
                          newOpts[i] = { ...opt, emoji: e.target.value };
                          handleChange('options', newOpts);
                        }}
                        className="w-10 rounded border border-slate-200 bg-slate-50 p-2 text-center text-sm"
                        placeholder="✨"
                      />
                      <Input
                        value={opt.label}
                        onChange={(e) => {
                          const newOpts = [...nodeProps.options];
                          newOpts[i] = { ...opt, label: e.target.value };
                          handleChange('options', newOpts);
                        }}
                        className="flex-1 bg-slate-50"
                      />
                      {nodeProps.options.length > 2 && (
                        <button
                          onClick={() => handleChange('options', nodeProps.options.filter((_: any, idx: number) => idx !== i))}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleChange('options', [...nodeProps.options, { id: `opt${Date.now()}`, label: 'New Option', emoji: '✨' }])}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-2 text-sm font-medium text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <Plus size={14} /> Add Option
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Page Settings */
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Page Info
              </label>
              <div>
                <label className="mb-1.5 block text-sm text-slate-600">Name</label>
                <Input
                  value={page.name}
                  onChange={(e) => updatePageProps(page.id, { name: e.target.value })}
                  className="bg-slate-50"
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Tip:</span> Click on elements in the preview to edit them directly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main editor content
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
  const [showAddStep, setShowAddStep] = useState(false);
  const [deviceView, setDeviceView] = useState<'phone' | 'desktop'>('phone');
  
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

  const handleAddStep = (template: PageTemplate) => {
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
      toast({ title: 'Cannot delete', description: 'Need at least one step', variant: 'destructive' });
      return;
    }
    deletePage(pageId);
  };

  const previewUrl = `${window.location.origin}/f/${funnel.slug}`;

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/team/${teamId}/funnels`)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">{funnel.name}</h1>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                funnel.status === 'published' ? "bg-green-500" : "bg-amber-500"
              )} />
              <span className="text-xs text-slate-500">
                {funnel.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        {/* Center - Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setMode('edit')}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === 'edit' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <MousePointer size={14} />
            Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === 'preview' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <Settings size={16} />
          </button>
          <button 
            onClick={() => window.open(previewUrl, '_blank')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ExternalLink size={16} />
            View Live
          </button>
          <div className="mx-2 h-6 w-px bg-slate-200" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSave}
            disabled={isSaving}
            className="gap-1.5"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button 
            size="sm" 
            onClick={onPublish}
            disabled={isPublishing}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Globe size={14} />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Pages */}
        {mode === 'edit' && (
          <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                {pages.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {pages.map((page, i) => {
                  const isActive = page.id === activePageId;
                  const stepConfig = STEP_TYPES.find(s => page.type?.includes(s.type)) || STEP_TYPES[0];
                  return (
                    <div
                      key={page.id}
                      onClick={() => setActivePage(page.id)}
                      className={cn(
                        "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                        isActive 
                          ? "bg-indigo-50 ring-1 ring-indigo-200" 
                          : "hover:bg-slate-50"
                      )}
                    >
                      <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold",
                        isActive 
                          ? "bg-indigo-600 text-white" 
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "truncate text-sm font-medium",
                          isActive ? "text-indigo-700" : "text-slate-700"
                        )}>
                          {page.name}
                        </p>
                      </div>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                          className="rounded p-1 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 p-2">
              <button
                onClick={() => setShowAddStep(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
              >
                <Plus size={16} />
                Add Step
              </button>
            </div>
          </aside>
        )}

        {/* Canvas */}
        <main className="relative flex-1 overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  canUndo ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
                )}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  canRedo ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
                )}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={16} />
              </button>
            </div>
            
            <span className="text-sm font-medium text-slate-700">
              {activePage?.name || 'Select a step'}
            </span>

            <div className="flex items-center gap-2">
              {pages.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => activePageIndex > 0 && setActivePage(pages[activePageIndex - 1].id)}
                    disabled={activePageIndex === 0}
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      activePageIndex > 0 ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
                    )}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-[40px] text-center text-xs text-slate-500">
                    {activePageIndex + 1} / {pages.length}
                  </span>
                  <button
                    onClick={() => activePageIndex < pages.length - 1 && setActivePage(pages[activePageIndex + 1].id)}
                    disabled={activePageIndex === pages.length - 1}
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      activePageIndex < pages.length - 1 ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
                    )}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex h-full items-center justify-center pt-12 pb-4">
            <PhoneFrame>
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
                <div className="flex h-full items-center justify-center text-slate-400">
                  Select a step to start editing
                </div>
              )}
            </PhoneFrame>
          </div>
        </main>

        {/* Right Sidebar - Inspector */}
        {mode === 'edit' && (
          <aside className="w-72 border-l border-slate-200 bg-white">
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
      <AddStepModal
        open={showAddStep}
        onOpenChange={setShowAddStep}
        onAddStep={handleAddStep}
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-600">Failed to load funnel</p>
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
