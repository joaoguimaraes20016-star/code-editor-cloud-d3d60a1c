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
  Play,
  MessageSquare,
  List,
  Mail,
  Phone,
  UserCheck,
  Video,
  Code,
  CheckCircle,
  Trash2,
  Copy,
  ArrowLeft,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { STEP_DEFINITIONS } from '@/lib/funnel/stepDefinitions';

// Builder V2 imports
import '@/builder_v2/EditorLayout.css';
import { PhoneFrame } from '@/builder_v2/canvas/PhoneFrame';
import { CanvasEditor } from '@/builder_v2/canvas/CanvasEditor';
import { EnhancedInspector } from '@/builder_v2/inspector/EnhancedInspector';
import { StructureTree } from '@/builder_v2/structure/StructureTree';
import { StepPalette } from '@/builder_v2/structure/StepPalette';
import { ElementPalette } from '@/builder_v2/structure/ElementPalette';
import { EditorProvider, useEditorStore } from '@/builder_v2/state/editorStore';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import type { Page } from '@/builder_v2/types';

// Step icons mapping
const STEP_ICONS: Record<string, typeof Play> = {
  welcome: Play,
  text_question: MessageSquare,
  multi_choice: List,
  email_capture: Mail,
  phone_capture: Phone,
  opt_in: UserCheck,
  video: Video,
  embed: Code,
  thank_you: CheckCircle,
};

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

type EditorMode = 'edit' | 'preview';

// Loading state component
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--builder-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--builder-accent)] border-t-transparent" />
        <p className="text-sm text-[var(--builder-text-secondary)]">{message}</p>
      </div>
    </div>
  );
}

// Settings dialog for funnel configuration
function FunnelSettingsDialog({ 
  funnel, 
  onSave 
}: { 
  funnel: FunnelRow; 
  onSave: (updates: Partial<FunnelRow>) => void;
}) {
  const [name, setName] = useState(funnel.name);
  const [slug, setSlug] = useState(funnel.slug);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSave({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings size={16} />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input 
                value={slug} 
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Live URL: {window.location.origin}/f/{slug}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main editor content (inside EditorProvider)
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
    addPage,
    deletePage,
  } = useEditorStore();

  const [leftTab, setLeftTab] = useState<'pages' | 'layers'>('pages');
  const [showAddStep, setShowAddStep] = useState(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  
  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const activePageIndex = pages.findIndex((p) => p.id === activePageId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      
      // Undo/Redo
      if (isModifierPressed && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        return;
      }
      
      // Save
      if (isModifierPressed && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo, onSave]);

  const handleAddStep = (stepType: string) => {
    addPage(stepType);
    setShowAddStep(false);
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Funnel must have at least one step', variant: 'destructive' });
      return;
    }
    deletePage(pageId);
  };

  const getStepIcon = (pageType: string | undefined) => {
    // Map page type to step type for icon lookup
    const stepType = pageType === 'landing' ? 'welcome' : 
                     pageType === 'optin' ? 'opt_in' :
                     pageType === 'appointment' ? 'embed' :
                     pageType || 'welcome';
    const Icon = STEP_ICONS[stepType] || Play;
    return Icon;
  };

  const previewUrl = `${window.location.origin}/f/${funnel.slug}`;

  return (
    <div className="builder-shell h-screen flex flex-col">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-[var(--builder-panel-border)] bg-[var(--builder-panel-bg)]">
        {/* Left: Back + Funnel Name */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(`/team/${teamId}/funnels`)}
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-sm font-semibold">{funnel.name}</h1>
            <span className="text-xs text-[var(--builder-text-muted)]">
              {funnel.status === 'published' ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Published
                </span>
              ) : 'Draft'}
            </span>
          </div>
        </div>

        {/* Center: Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-[var(--builder-hover-bg)] rounded-lg">
          <button
            type="button"
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              mode === 'edit' 
                ? "bg-white shadow-sm text-[var(--builder-text-primary)]" 
                : "text-[var(--builder-text-secondary)] hover:text-[var(--builder-text-primary)]"
            )}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              mode === 'preview' 
                ? "bg-white shadow-sm text-[var(--builder-text-primary)]" 
                : "text-[var(--builder-text-secondary)] hover:text-[var(--builder-text-primary)]"
            )}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <FunnelSettingsDialog funnel={funnel} onSave={onUpdateSettings} />
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2"
            onClick={() => window.open(previewUrl, '_blank')}
          >
            <ExternalLink size={16} />
            View Live
          </Button>

          <div className="w-px h-6 bg-[var(--builder-panel-border)]" />

          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSave}
            disabled={isSaving || isPublishing}
            className="gap-2"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button 
            size="sm" 
            onClick={onPublish}
            disabled={isSaving || isPublishing}
            className="gap-2 bg-[var(--builder-accent)] hover:bg-[var(--builder-accent)]/90"
          >
            <Globe size={16} />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Pages/Layers */}
        {mode === 'edit' && (
          <aside className="w-64 flex flex-col bg-[var(--builder-panel-bg)] border-r border-[var(--builder-panel-border)]">
            <div className="border-b border-[var(--builder-panel-border)]">
              <div className="flex">
                <button
                  type="button"
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    leftTab === 'pages' 
                      ? "text-[var(--builder-accent)] border-[var(--builder-accent)]" 
                      : "text-[var(--builder-text-secondary)] border-transparent hover:text-[var(--builder-text-primary)]"
                  )}
                  onClick={() => setLeftTab('pages')}
                >
                  Pages
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    leftTab === 'layers' 
                      ? "text-[var(--builder-accent)] border-[var(--builder-accent)]" 
                      : "text-[var(--builder-text-secondary)] border-transparent hover:text-[var(--builder-text-primary)]"
                  )}
                  onClick={() => setLeftTab('layers')}
                >
                  Layers
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {leftTab === 'pages' && (
                <div className="p-2 space-y-1">
                  {pages.map((page, index) => {
                    const isActive = page.id === activePageId;
                    const StepIcon = getStepIcon(page.type);
                    return (
                      <div
                        key={page.id}
                        className={cn(
                          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
                          isActive 
                            ? "bg-[var(--builder-accent-light)]" 
                            : "hover:bg-[var(--builder-hover-bg)]"
                        )}
                        onClick={() => setActivePage(page.id)}
                      >
                        <span className={cn(
                          "w-5 h-5 flex items-center justify-center text-[10px] font-semibold rounded",
                          isActive 
                            ? "bg-[var(--builder-accent)] text-white" 
                            : "bg-[var(--builder-hover-bg)] text-[var(--builder-text-muted)]"
                        )}>
                          {index + 1}
                        </span>
                        <StepIcon className={cn(
                          "w-4 h-4",
                          isActive ? "text-[var(--builder-accent)]" : "text-[var(--builder-text-secondary)]"
                        )} />
                        <span className="flex-1 text-xs font-medium truncate">{page.name}</span>
                        
                        {pages.length > 1 && (
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(page.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {leftTab === 'layers' && activePage && (
                <StructureTree />
              )}
            </div>

            {/* Add Step */}
            {leftTab === 'pages' && (
              <div className="p-2 border-t border-[var(--builder-panel-border)]">
                {showAddStep ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-[10px] font-semibold text-[var(--builder-text-muted)] uppercase">Add Step</span>
                      <button 
                        className="text-xs text-[var(--builder-text-secondary)] hover:text-[var(--builder-text-primary)]"
                        onClick={() => setShowAddStep(false)}
                      >
                        Cancel
                      </button>
                    </div>
                    <StepPalette onAddStep={handleAddStep} compact />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-[var(--builder-accent)] bg-[var(--builder-accent-light)] rounded-lg border border-dashed border-[var(--builder-accent)] hover:bg-[var(--builder-accent)] hover:text-white hover:border-solid transition-colors"
                    onClick={() => setShowAddStep(true)}
                  >
                    <Plus size={14} />
                    Add Step
                  </button>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Center - Canvas */}
        <main className="flex-1 flex flex-col bg-[var(--builder-canvas-bg)]">
          {/* Canvas Toolbar */}
          <div className="flex items-center justify-between h-10 px-4 bg-[var(--builder-panel-bg)] border-b border-[var(--builder-panel-border)]">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!canUndo}
                onClick={undo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!canRedo}
                onClick={redo}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={14} />
              </Button>
            </div>
            
            <span className="text-xs font-medium text-[var(--builder-text-primary)]">
              {activePage?.name || 'Select a page'}
            </span>
            
            <div className="flex items-center gap-1">
              {/* Step navigation */}
              {pages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={activePageIndex === 0}
                    onClick={() => {
                      if (activePageIndex > 0) setActivePage(pages[activePageIndex - 1].id);
                    }}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-[var(--builder-text-muted)] min-w-[40px] text-center">
                    {activePageIndex + 1} / {pages.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={activePageIndex === pages.length - 1}
                    onClick={() => {
                      if (activePageIndex < pages.length - 1) setActivePage(pages[activePageIndex + 1].id);
                    }}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Phone Canvas */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
            <PhoneFrame>
              {activePage ? (
                <CanvasEditor
                  page={activePage}
                  editorState={editorState}
                  mode={mode === 'preview' ? 'preview' : 'canvas'}
                  onSelectNode={(nodeId) => selectNode(nodeId)}
                  highlightedNodeIds={highlightedNodeIds}
                  funnelPosition={activePageIndex}
                  totalPages={pages.length}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-[var(--builder-text-muted)]">
                  Select a page to start editing
                </div>
              )}
            </PhoneFrame>
          </div>
        </main>

        {/* Right Panel - Inspector */}
        {mode === 'edit' && (
          <aside className="w-72 bg-[var(--builder-panel-bg)] border-l border-[var(--builder-panel-border)] overflow-y-auto">
            <EnhancedInspector />
          </aside>
        )}
      </div>
    </div>
  );
}

// Wrapper that provides EditorProvider with funnel data
function FunnelEditorWithData({ funnel, teamId }: { funnel: FunnelRow; teamId: string }) {
  const queryClient = useQueryClient();
  const { pages: editorPages, activePageId } = useEditorStore();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const doc = extractDocument(editorPages, activePageId);
      const { error } = await supabase
        .from('funnels')
        .update({ 
          builder_document: doc as unknown as Json, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', funnel.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: () => {
      setLastSavedAt(new Date());
      toast({ title: 'Saved', description: 'Changes saved successfully' });
    },
    onError: (error) => {
      console.error('Save failed:', error);
      toast({ title: 'Save failed', description: 'Unable to save changes', variant: 'destructive' });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const doc = extractDocument(editorPages, activePageId);
      
      // Create published snapshot
      const publishedSnapshot = {
        version: 1,
        publishedAt: new Date().toISOString(),
        pages: doc.pages,
        activePageId: doc.activePageId,
      };

      const { error } = await supabase
        .from('funnels')
        .update({ 
          builder_document: doc as unknown as Json,
          published_document_snapshot: publishedSnapshot as unknown as Json,
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', funnel.id);
      
      if (error) throw error;
      return publishedSnapshot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnel.id] });
      toast({ 
        title: 'Published!', 
        description: (
          <span>
            Your funnel is live at{' '}
            <a 
              href={`/f/${funnel.slug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline text-[var(--builder-accent)]"
            >
              /f/{funnel.slug}
            </a>
          </span>
        ),
      });
    },
    onError: (error) => {
      console.error('Publish failed:', error);
      toast({ title: 'Publish failed', description: 'Unable to publish funnel', variant: 'destructive' });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<FunnelRow, 'name' | 'slug'>>) => {
      const { error } = await supabase
        .from('funnels')
        .update(updates)
        .eq('id', funnel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-editor', funnel.id] });
      toast({ title: 'Settings updated' });
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key')) {
        toast({ title: 'URL slug already exists', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to update settings', variant: 'destructive' });
      }
    },
  });

  return (
    <EditorContent
      funnel={funnel}
      teamId={teamId}
      onSave={() => saveMutation.mutate()}
      onPublish={() => publishMutation.mutate()}
      onUpdateSettings={(updates) => updateSettingsMutation.mutate(updates)}
      isSaving={saveMutation.isPending}
      isPublishing={publishMutation.isPending}
    />
  );
}

// Main component
export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const { loading: isRoleLoading } = useTeamRole(teamId);
  const navigate = useNavigate();

  // Fetch funnel data
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

  // Initialize or migrate builder document if needed
  useEffect(() => {
    const doc = funnelQuery.data?.builder_document;
    // Check if document is missing or has old format (missing canvasRoot on first page)
    const needsInit = !doc || !doc.pages?.[0]?.canvasRoot;
    
    if (funnelQuery.data && needsInit) {
      const initialDoc: EditorDocument = {
        version: 1,
        pages: [{
          id: 'page-1',
          name: 'Welcome',
          type: 'landing',
          canvasRoot: {
            id: 'welcome-step-1',
            type: 'welcome_step',
            props: {
              headline: 'Welcome! Let\'s get started.',
              subtext: 'We\'re excited to have you here.',
              buttonText: 'Continue',
            },
            children: [],
          },
        }],
        activePageId: 'page-1',
      };

      supabase
        .from('funnels')
        .update({ builder_document: initialDoc as unknown as Json })
        .eq('id', funnelId!)
        .then(({ error }) => {
          if (!error) {
            funnelQuery.refetch();
          }
        });
    }
  }, [funnelQuery.data, funnelId]);

  if (!teamId || !funnelId) {
    return <LoadingState message="Invalid route" />;
  }

  if (isRoleLoading || funnelQuery.isLoading) {
    return <LoadingState message="Loading funnel..." />;
  }

  if (funnelQuery.isError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[var(--builder-bg)]">
        <p className="text-[var(--builder-text-secondary)]">Failed to load funnel</p>
        <Button onClick={() => navigate(`/team/${teamId}/funnels`)}>Back to Funnels</Button>
      </div>
    );
  }

  const funnel = funnelQuery.data;
  if (!funnel) {
    return <LoadingState message="Funnel not found" />;
  }

  // Wait for document to be initialized
  if (!funnel.builder_document) {
    return <LoadingState message="Initializing builder..." />;
  }

  return (
    <EditorProvider key={`editor-${funnelId}`} initialDocument={funnel.builder_document}>
      <FunnelEditorWithData funnel={funnel} teamId={teamId} />
    </EditorProvider>
  );
}
