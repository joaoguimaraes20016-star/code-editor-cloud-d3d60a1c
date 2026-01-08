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
  Plus,
  ExternalLink,
  Trash2,
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  Layers,
  MoreHorizontal,
  Copy,
  Sparkles,
  PanelLeft,
  PanelRight,
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
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

// Builder V2 imports
import '@/builder_v2/EditorLayout.css';
import { CanvasEditor } from '@/builder_v2/canvas/CanvasEditor';
import { EditorProvider, useEditorStore } from '@/builder_v2/state/editorStore';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import { PAGE_TEMPLATES, type PageTemplate } from '@/builder_v2/templates/pageTemplates';
import { SectionPicker } from '@/builder_v2/components/SectionPicker';
import { PropertyEditor } from '@/builder_v2/inspector/PropertyEditor';
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

// Loading state
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">{message}</p>
      </div>
    </div>
  );
}

// Device Frame
function DeviceFrame({ device, children, slug }: { device: DeviceType; children: React.ReactNode; slug?: string }) {
  if (device === 'phone') {
    return (
      <div className="device-frame--phone">
        <div className="device-notch"><div className="device-notch-inner" /></div>
        <div className="device-screen"><div className="device-screen-content">{children}</div></div>
        <div className="device-home-bar"><div className="device-home-indicator" /></div>
      </div>
    );
  }
  if (device === 'tablet') {
    return (
      <div className="device-frame--tablet">
        <div className="device-screen"><div className="device-screen-content">{children}</div></div>
        <div className="device-home-bar"><div className="device-home-indicator" /></div>
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
        <div className="device-browser-url">{slug ? `yoursite.com/f/${slug}` : 'yoursite.com'}</div>
      </div>
      <div className="device-screen"><div className="device-screen-content">{children}</div></div>
    </div>
  );
}

// Settings dialog
function SettingsDialog({ funnel, open, onOpenChange, onSave }: { funnel: FunnelRow; open: boolean; onOpenChange: (open: boolean) => void; onSave: (updates: Partial<FunnelRow>) => void }) {
  const [name, setName] = useState(funnel.name);
  const [slug, setSlug] = useState(funnel.slug);
  const handleSave = () => { onSave({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') }); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Funnel Settings</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label>Funnel Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>URL Slug</Label>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// Add Page Modal
function AddPageModal({ open, onOpenChange, onAddPage }: { open: boolean; onOpenChange: (open: boolean) => void; onAddPage: (template: PageTemplate) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add New Page</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {PAGE_TEMPLATES.map((template) => (
            <button key={template.id} onClick={() => { onAddPage(template); onOpenChange(false); }}
              className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white"><Sparkles size={18} /></div>
              <span className="text-sm font-medium">{template.name}</span>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Pages Header
function PagesHeader({ pages, activePageId, onSelectPage, onAddPage, onDeletePage }: { pages: Page[]; activePageId: string; onSelectPage: (id: string) => void; onAddPage: () => void; onDeletePage: (id: string) => void }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Layers size={14} className="text-slate-500" /><span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Pages</span></div>
        <button onClick={onAddPage} className="flex items-center justify-center w-6 h-6 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"><Plus size={14} /></button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {pages.map((page, i) => (
          <div key={page.id} className="relative group shrink-0">
            <button onClick={() => onSelectPage(page.id)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", page.id === activePageId ? "bg-primary text-primary-foreground shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
              <span className="w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-black/10">{i + 1}</span>
              <span className="max-w-[80px] truncate">{page.name}</span>
            </button>
            {pages.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-200 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={10} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem><Copy size={12} className="mr-2" /> Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDeletePage(page.id)} className="text-destructive focus:text-destructive"><Trash2 size={12} className="mr-2" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// Main Editor Content
function EditorContent({ funnel, teamId, onSave, onPublish, onUpdateSettings, isSaving, isPublishing }: { funnel: FunnelRow; teamId: string; onSave: () => void; onPublish: () => void; onUpdateSettings: (updates: Partial<FunnelRow>) => void; isSaving: boolean; isPublishing: boolean }) {
  const navigate = useNavigate();
  const { pages, activePageId, editorState, selectedNodeId, setActivePage, selectNode, updateNodeProps, updatePageProps, deleteNode, moveNodeUp, moveNodeDown, moveNodeToParent, undo, redo, canUndo, canRedo, highlightedNodeIds, deletePage, dispatch } = useEditorStore();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  const [device, setDevice] = useState<DeviceType>('phone');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  
  const activePage = pages.find((p) => p.id === activePageId);
  const findNode = useCallback((node: CanvasNode, id: string): CanvasNode | null => { if (node.id === id) return node; for (const child of node.children || []) { const f = findNode(child, id); if (f) return f; } return null; }, []);
  const selectedNode = useMemo(() => (!selectedNodeId || !activePage) ? null : findNode(activePage.canvasRoot, selectedNodeId), [selectedNodeId, activePage, findNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z') { e.preventDefault(); if (e.shiftKey) { if (canRedo) redo(); } else { if (canUndo) undo(); } }
      if (mod && e.key === 's') { e.preventDefault(); onSave(); }
      if (e.key === 'Escape') selectNode(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); deleteNode(selectedNodeId); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo, onSave, selectNode, selectedNodeId, deleteNode]);

  const handleAddPage = (template: PageTemplate) => { dispatch({ type: 'ADD_PAGE', page: { id: `page-${Date.now()}`, name: template.name, type: template.category === 'welcome' ? 'landing' : template.category === 'booking' ? 'appointment' : template.category === 'capture' ? 'optin' : template.category === 'thank_you' ? 'thank_you' : 'landing', canvasRoot: template.createNodes() } }); };
  const handleDeletePage = (pageId: string) => { if (pages.length <= 1) { toast({ title: 'Cannot delete', description: 'Need at least one page', variant: 'destructive' }); return; } deletePage(pageId); };
  
  // Container-aware section insertion
  const handleAddSection = (sectionNode: CanvasNode) => {
    if (!activePage) return;
    // Use ADD_NODE action which properly handles insertion into the canvas root
    dispatch({ type: 'ADD_NODE', parentId: activePage.canvasRoot.id, node: sectionNode });
  };
  
  const handleMoveNode = (nodeId: string, direction: 'up' | 'down') => { direction === 'up' ? moveNodeUp(nodeId) : moveNodeDown(nodeId); };
  
  // DnD-based node reordering
  const handleDndMoveNode = useCallback((nodeId: string, targetParentId: string, targetIndex: number) => {
    moveNodeToParent(nodeId, targetParentId, targetIndex);
  }, [moveNodeToParent]);
  
  const handleCanvasClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) selectNode(null); };
  const previewUrl = `${window.location.origin}/f/${funnel.slug}`;


  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/team/${teamId}/funnels`)} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">{funnel.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {([{ type: 'phone', icon: Smartphone }, { type: 'tablet', icon: Tablet }, { type: 'desktop', icon: Monitor }] as const).map(({ type, icon: Icon }) => (
              <button key={type} onClick={() => setDevice(type)} className={cn("rounded-md p-1.5 transition-all", device === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}><Icon size={16} /></button>
            ))}
          </div>
          <div className="h-5 w-px bg-slate-200 mx-1" />
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button onClick={() => setMode('edit')} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all", mode === 'edit' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Edit</button>
            <button onClick={() => setMode('preview')} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all", mode === 'preview' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}><Eye size={12} />Preview</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button onClick={undo} disabled={!canUndo} className={cn("rounded-md p-1.5", canUndo ? "text-slate-600 hover:bg-white" : "text-slate-300")} title="Undo"><Undo2 size={14} /></button>
            <button onClick={redo} disabled={!canRedo} className={cn("rounded-md p-1.5", canRedo ? "text-slate-600 hover:bg-white" : "text-slate-300")} title="Redo"><Redo2 size={14} /></button>
          </div>
          <button onClick={() => setShowSettings(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Settings size={16} /></button>
          <button onClick={() => window.open(previewUrl, '_blank')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ExternalLink size={16} /></button>
          <div className="h-5 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving} className="h-8 text-xs"><Save size={12} className="mr-1.5" />{isSaving ? 'Saving...' : 'Save'}</Button>
          <Button size="sm" onClick={onPublish} disabled={isPublishing} className="h-8 text-xs"><Globe size={12} className="mr-1.5" />{isPublishing ? 'Publishing...' : 'Publish'}</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {mode === 'edit' && leftPanelOpen && (
          <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <PagesHeader pages={pages} activePageId={activePageId} onSelectPage={setActivePage} onAddPage={() => setShowAddPage(true)} onDeletePage={handleDeletePage} />
            <div className="flex-1 overflow-hidden"><SectionPicker onAddSection={handleAddSection} /></div>
          </aside>
        )}
        <main className="relative flex-1 overflow-hidden flex items-center justify-center p-8" onClick={handleCanvasClick}>
          {mode === 'edit' && (
            <>
              <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className={cn("absolute left-4 top-4 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50", !leftPanelOpen && "bg-primary/10 text-primary border-primary/20")}><PanelLeft size={16} /></button>
              <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className={cn("absolute right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50", !rightPanelOpen && "bg-primary/10 text-primary border-primary/20")}><PanelRight size={16} /></button>
            </>
          )}
          <DeviceFrame device={device} slug={funnel.slug}>
            {activePage ? (
              <CanvasEditor 
                page={activePage} 
                editorState={editorState} 
                mode={mode === 'edit' ? 'canvas' : 'preview'} 
                onSelectNode={selectNode} 
                onMoveNode={handleDndMoveNode}
                highlightedNodeIds={highlightedNodeIds} 
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">No page selected</p>
              </div>
            )}
          </DeviceFrame>
        </main>
        {mode === 'edit' && rightPanelOpen && (
          <aside className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-hidden">
            <PropertyEditor selectedNode={selectedNode} selectedPage={activePage ?? null} onUpdateNode={updateNodeProps} onUpdatePage={(id, updates) => updatePageProps(id, updates)} onDeleteNode={deleteNode} onMoveNode={handleMoveNode} />
          </aside>
        )}
      </div>
      <SettingsDialog funnel={funnel} open={showSettings} onOpenChange={setShowSettings} onSave={onUpdateSettings} />
      <AddPageModal open={showAddPage} onOpenChange={setShowAddPage} onAddPage={handleAddPage} />
    </div>
  );
}

// Main wrapper
export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const queryClient = useQueryClient();

  const { data: funnel, isLoading, error } = useQuery({
    queryKey: ['funnel-editor', funnelId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funnels').select('id, team_id, name, slug, status, settings, builder_document, updated_at').eq('id', funnelId).single();
      if (error) throw error;
      return data as unknown as FunnelRow;
    },
    enabled: !!funnelId,
  });

  const saveMutation = useMutation({
    mutationFn: async (document: EditorDocument) => { const { error } = await supabase.from('funnels').update({ builder_document: document as unknown as Json, updated_at: new Date().toISOString() }).eq('id', funnelId); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); toast({ title: 'Saved' }); },
    onError: () => { toast({ title: 'Error saving', variant: 'destructive' }); },
  });

  const publishMutation = useMutation({
    mutationFn: async (document: EditorDocument) => { const { error } = await supabase.from('funnels').update({ published_document_snapshot: { ...document, publishedAt: Date.now() } as unknown as Json, status: 'published', updated_at: new Date().toISOString() }).eq('id', funnelId); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); toast({ title: 'Published!' }); },
    onError: () => { toast({ title: 'Error publishing', variant: 'destructive' }); },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { name?: string; slug?: string }) => { const { error } = await supabase.from('funnels').update(updates).eq('id', funnelId); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); toast({ title: 'Settings saved' }); },
  });

  if (isLoading) return <LoadingState message="Loading funnel..." />;
  if (error || !funnel) return <div className="flex h-screen items-center justify-center"><div className="text-center"><h2 className="text-lg font-semibold">Funnel not found</h2></div></div>;

  return (
    <EditorProvider initialDocument={funnel.builder_document || undefined}>
      <EditorContentWrapper funnel={funnel} teamId={teamId!} onSave={(doc) => saveMutation.mutate(doc)} onPublish={(doc) => publishMutation.mutate(doc)} onUpdateSettings={(u) => updateSettingsMutation.mutate(u)} isSaving={saveMutation.isPending} isPublishing={publishMutation.isPending} />
    </EditorProvider>
  );
}

function EditorContentWrapper({ funnel, teamId, onSave, onPublish, onUpdateSettings, isSaving, isPublishing }: { funnel: FunnelRow; teamId: string; onSave: (doc: EditorDocument) => void; onPublish: (doc: EditorDocument) => void; onUpdateSettings: (u: { name?: string; slug?: string }) => void; isSaving: boolean; isPublishing: boolean }) {
  const { pages } = useEditorStore();
  const handleSave = useCallback(() => { onSave(extractDocument({ pages } as any, funnelId)); }, [pages, onSave]);
  const handlePublish = useCallback(() => { onPublish(extractDocument({ pages } as any, funnelId)); }, [pages, onPublish]);
  const funnelId = funnel.id;
  return <EditorContent funnel={funnel} teamId={teamId} onSave={handleSave} onPublish={handlePublish} onUpdateSettings={onUpdateSettings} isSaving={isSaving} isPublishing={isPublishing} />;
}
