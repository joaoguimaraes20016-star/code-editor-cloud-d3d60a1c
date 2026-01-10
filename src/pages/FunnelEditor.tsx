import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { PagesList } from '@/builder_v2/components/PagesList';
import { EditorHeader } from '@/builder_v2/components/EditorHeader';
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
type EditorTab = 'funnel' | 'metrics' | 'contacts';
type SidebarTab = 'pages' | 'add';

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
function SettingsDialog({ funnel, open, onOpenChange, onSave }: { 
  funnel: FunnelRow; 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (updates: Partial<FunnelRow>) => void 
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
        <DialogHeader><DialogTitle>Funnel Settings</DialogTitle></DialogHeader>
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


// Main Editor Content
function EditorContent({ 
  funnel, 
  teamId, 
  onSave, 
  onPublish, 
  onUpdateSettings, 
  isSaving, 
  isPublishing 
}: { 
  funnel: FunnelRow; 
  teamId: string; 
  onSave: () => void; 
  onPublish: () => void; 
  onUpdateSettings: (updates: Partial<FunnelRow>) => void; 
  isSaving: boolean; 
  isPublishing: boolean 
}) {
  const navigate = useNavigate();
  const { 
    pages, 
    activePageId, 
    editorState, 
    selectedNodeId, 
    setActivePage, 
    selectNode, 
    updateNodeProps, 
    updatePageProps, 
    deleteNode, 
    moveNodeUp, 
    moveNodeDown, 
    moveNodeToParent, 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    highlightedNodeIds, 
    deletePage, 
    dispatch 
  } = useEditorStore();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showSettings, setShowSettings] = useState(false);
  const [device, setDevice] = useState<DeviceType>('phone');
  const [activeTab, setActiveTab] = useState<EditorTab>('funnel');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('pages');
  
  const activePage = pages.find((p) => p.id === activePageId);
  
  const findNode = useCallback((node: CanvasNode, id: string): CanvasNode | null => { 
    if (node.id === id) return node; 
    for (const child of node.children || []) { 
      const f = findNode(child, id); 
      if (f) return f; 
    } 
    return null; 
  }, []);
  
  const selectedNode = useMemo(() => 
    (!selectedNodeId || !activePage) ? null : findNode(activePage.canvasRoot, selectedNodeId), 
    [selectedNodeId, activePage, findNode]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z') { 
        e.preventDefault(); 
        if (e.shiftKey) { if (canRedo) redo(); } 
        else { if (canUndo) undo(); } 
      }
      if (mod && e.key === 's') { e.preventDefault(); onSave(); }
      if (e.key === 'Escape') selectNode(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) { 
        e.preventDefault(); 
        deleteNode(selectedNodeId); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo, onSave, selectNode, selectedNodeId, deleteNode]);

  const handleAddPage = () => { 
    dispatch({ 
      type: 'ADD_PAGE', 
      page: { 
        id: `page-${Date.now()}`, 
        name: `Page ${pages.length + 1}`, 
        type: 'landing', 
        canvasRoot: { id: `frame-${Date.now()}`, type: 'frame', props: {}, children: [] }
      } 
    }); 
  };

  const handleRenamePage = (id: string, name: string) => {
    updatePageProps(id, { name });
  };

  const handleOpenSectionPicker = () => {
    setSidebarTab('add');
  };
  
  const handleDeletePage = (pageId: string) => { 
    if (pages.length <= 1) { 
      toast({ title: 'Cannot delete', description: 'Need at least one page', variant: 'destructive' }); 
      return; 
    } 
    deletePage(pageId); 
  };
  
  const handleAddSection = (sectionNode: CanvasNode) => {
    if (!activePage) return;
    dispatch({ type: 'ADD_NODE', parentId: activePage.canvasRoot.id, node: sectionNode });
  };
  
  const handleMoveNode = (nodeId: string, direction: 'up' | 'down') => { 
    direction === 'up' ? moveNodeUp(nodeId) : moveNodeDown(nodeId); 
  };
  
  const handleDndMoveNode = useCallback((nodeId: string, targetParentId: string, targetIndex: number) => {
    moveNodeToParent(nodeId, targetParentId, targetIndex);
  }, [moveNodeToParent]);
  
  const handleCanvasClick = (e: React.MouseEvent) => { 
    if (e.target === e.currentTarget) selectNode(null); 
  };
  
  const previewUrl = `${window.location.origin}/f/${funnel.slug}`;

  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* Header */}
      <EditorHeader
        funnelName={funnel.name}
        device={device}
        mode={mode}
        activeTab={activeTab}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        isPublishing={isPublishing}
        previewUrl={previewUrl}
        onBack={() => navigate(`/team/${teamId}/funnels`)}
        onDeviceChange={setDevice}
        onModeChange={setMode}
        onTabChange={setActiveTab}
        onUndo={undo}
        onRedo={redo}
        onSettings={() => setShowSettings(true)}
        onPreview={() => window.open(previewUrl, '_blank')}
        onSave={onSave}
        onPublish={onPublish}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Perspective style with tabs */}
        {mode === 'edit' && activeTab === 'funnel' && (
          <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            {/* Sidebar tabs */}
            <div className="border-b border-slate-100">
              <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as SidebarTab)} className="w-full">
                <TabsList className="w-full h-auto p-1 bg-transparent rounded-none">
                  <TabsTrigger 
                    value="pages" 
                    className="flex-1 text-xs data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-md"
                  >
                    Pages
                  </TabsTrigger>
                  <TabsTrigger 
                    value="add" 
                    className="flex-1 text-xs data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-md"
                  >
                    Add Section
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Sidebar content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'pages' && (
                <PagesList
                  pages={pages}
                  activePageId={activePageId}
                  onSelectPage={setActivePage}
                  onAddPage={handleAddPage}
                  onDeletePage={handleDeletePage}
                  onRenamePage={handleRenamePage}
                />
              )}
              {sidebarTab === 'add' && (
                <SectionPicker onAddSection={handleAddSection} />
              )}
            </div>
          </aside>
        )}
        
        {/* Canvas area - dark Perspective-style background */}
        <main 
          className="relative flex-1 overflow-hidden flex items-center justify-center p-8 funnel-editor-canvas-bg"
          onClick={handleCanvasClick}
        >
          <DeviceFrame device={device} slug={funnel.slug}>
            {activePage ? (
              <CanvasEditor 
                page={activePage} 
                editorState={editorState} 
                mode={mode === 'edit' ? 'canvas' : 'preview'} 
                onSelectNode={selectNode} 
                onMoveNode={handleDndMoveNode}
                onDeleteNode={deleteNode}
                onOpenSectionPicker={handleOpenSectionPicker}
                highlightedNodeIds={highlightedNodeIds} 
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">No page selected</p>
              </div>
            )}
          </DeviceFrame>
        </main>
        
        {/* Right panel - Property editor */}
        {mode === 'edit' && activeTab === 'funnel' && selectedNode && (
          <aside className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-hidden">
            <PropertyEditor 
              selectedNode={selectedNode} 
              selectedPage={activePage ?? null} 
              onUpdateNode={updateNodeProps} 
              onUpdatePage={(id, updates) => updatePageProps(id, updates)} 
              onDeleteNode={deleteNode} 
              onMoveNode={handleMoveNode} 
            />
          </aside>
        )}
        
        {/* Placeholder for other tabs */}
        {activeTab !== 'funnel' && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <p className="text-lg font-medium text-slate-600">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </p>
              <p className="text-sm text-slate-400 mt-1">Coming soon</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Dialogs */}
      <SettingsDialog 
        funnel={funnel} 
        open={showSettings} 
        onOpenChange={setShowSettings} 
        onSave={onUpdateSettings} 
      />
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
      const { data, error } = await supabase
        .from('funnels')
        .select('id, team_id, name, slug, status, settings, builder_document, updated_at')
        .eq('id', funnelId)
        .single();
      if (error) throw error;
      return data as unknown as FunnelRow;
    },
    enabled: !!funnelId,
  });

  const saveMutation = useMutation({
    mutationFn: async (document: EditorDocument) => { 
      const { error } = await supabase
        .from('funnels')
        .update({ builder_document: document as unknown as Json, updated_at: new Date().toISOString() })
        .eq('id', funnelId); 
      if (error) throw error; 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); 
      toast({ title: 'Saved' }); 
    },
    onError: () => { 
      toast({ title: 'Error saving', variant: 'destructive' }); 
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (document: EditorDocument) => { 
      const { error } = await supabase
        .from('funnels')
        .update({ 
          published_document_snapshot: { ...document, publishedAt: Date.now() } as unknown as Json, 
          status: 'published', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', funnelId); 
      if (error) throw error; 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); 
      toast({ title: 'Published!' }); 
    },
    onError: () => { 
      toast({ title: 'Error publishing', variant: 'destructive' }); 
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { name?: string; slug?: string }) => { 
      const { error } = await supabase.from('funnels').update(updates).eq('id', funnelId); 
      if (error) throw error; 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnelId] }); 
      toast({ title: 'Settings saved' }); 
    },
  });

  if (isLoading) return <LoadingState message="Loading funnel..." />;
  if (error || !funnel) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Funnel not found</h2>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider initialDocument={funnel.builder_document || undefined}>
      <EditorContentWrapper 
        funnel={funnel} 
        teamId={teamId!} 
        onSave={(doc) => saveMutation.mutate(doc)} 
        onPublish={(doc) => publishMutation.mutate(doc)} 
        onUpdateSettings={(u) => updateSettingsMutation.mutate(u)} 
        isSaving={saveMutation.isPending} 
        isPublishing={publishMutation.isPending} 
      />
    </EditorProvider>
  );
}

function EditorContentWrapper({ 
  funnel, 
  teamId, 
  onSave, 
  onPublish, 
  onUpdateSettings, 
  isSaving, 
  isPublishing 
}: { 
  funnel: FunnelRow; 
  teamId: string; 
  onSave: (doc: EditorDocument) => void; 
  onPublish: (doc: EditorDocument) => void; 
  onUpdateSettings: (u: { name?: string; slug?: string }) => void; 
  isSaving: boolean; 
  isPublishing: boolean 
}) {
  // Get store - this is guaranteed to be inside EditorProvider
  const store = useEditorStore();
  const funnelId = funnel.id;
  
  const handleSave = useCallback(() => { 
    onSave(extractDocument({ pages: store.pages } as any, funnelId)); 
  }, [store.pages, onSave, funnelId]);
  
  const handlePublish = useCallback(() => { 
    onPublish(extractDocument({ pages: store.pages } as any, funnelId)); 
  }, [store.pages, onPublish, funnelId]);
  
  return (
    <EditorContent 
      funnel={funnel} 
      teamId={teamId} 
      onSave={handleSave} 
      onPublish={handlePublish} 
      onUpdateSettings={onUpdateSettings} 
      isSaving={isSaving} 
      isPublishing={isPublishing} 
    />
  );
}
