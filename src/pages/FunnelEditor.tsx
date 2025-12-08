import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Eye, Save, Globe, PanelLeft, PanelRight, Play, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PagesList } from '@/components/funnel-builder/PagesList';
import { EditorSidebar } from '@/components/funnel-builder/EditorSidebar';
import { FunnelSettingsDialog } from '@/components/funnel-builder/FunnelSettingsDialog';
import { PhoneMockup } from '@/components/funnel-builder/PhoneMockup';
import { StepPreview } from '@/components/funnel-builder/StepPreview';
import { PreviewNavigation } from '@/components/funnel-builder/PreviewNavigation';
import { AddStepDialog } from '@/components/funnel-builder/AddStepDialog';
import { ContentBlock } from '@/components/funnel-builder/ContentBlockEditor';
import { LivePreviewMode } from '@/components/funnel-builder/LivePreviewMode';
import { PageSettingsDialog } from '@/components/funnel-builder/PageSettingsDialog';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface FunnelStep {
  id: string;
  funnel_id: string;
  order_index: number;
  step_type: 'welcome' | 'text_question' | 'multi_choice' | 'email_capture' | 'phone_capture' | 'video' | 'thank_you';
  content: {
    headline?: string;
    subtext?: string;
    button_text?: string;
    placeholder?: string;
    video_url?: string;
    options?: string[];
    is_required?: boolean;
    redirect_url?: string;
  };
}

export interface FunnelSettings {
  logo_url?: string;
  primary_color: string;
  background_color: string;
  button_text: string;
  ghl_webhook_url?: string;
}

export interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  settings: FunnelSettings;
}

interface StepDesign {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  borderRadius?: number;
  padding?: number;
  imageUrl?: string;
  imageSize?: 'S' | 'M' | 'L' | 'XL';
  imagePosition?: 'top' | 'bottom' | 'background';
}

interface StepSettings {
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  skipEnabled?: boolean;
  progressBar?: boolean;
  animation?: 'fade' | 'slide' | 'none';
}

export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsStepId, setPageSettingsStepId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  // Per-step design, settings, blocks, and element order state
  const [stepDesigns, setStepDesigns] = useState<Record<string, StepDesign>>({});
  const [stepSettings, setStepSettings] = useState<Record<string, StepSettings>>({});
  const [stepBlocks, setStepBlocks] = useState<Record<string, ContentBlock[]>>({});
  const [pageSettings, setPageSettings] = useState<Record<string, any>>({});
  const [elementOrders, setElementOrders] = useState<Record<string, string[]>>({});

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['funnel', funnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('id', funnelId)
        .single();

      if (error) throw error;
      return { ...data, settings: data.settings as unknown as FunnelSettings } as Funnel;
    },
    enabled: !!funnelId,
  });

  const { data: initialSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ['funnel-steps', funnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_steps')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as FunnelStep[];
    },
    enabled: !!funnelId,
  });

  useEffect(() => {
    if (funnel) {
      setName(funnel.name);
    }
  }, [funnel]);

  useEffect(() => {
    if (initialSteps) {
      setSteps(initialSteps);
      if (initialSteps.length > 0 && !selectedStepId) {
        setSelectedStepId(initialSteps[0].id);
      }
    }
  }, [initialSteps]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error: funnelError } = await supabase
        .from('funnels')
        .update({ name })
        .eq('id', funnelId);

      if (funnelError) throw funnelError;

      const { error: deleteError } = await supabase
        .from('funnel_steps')
        .delete()
        .eq('funnel_id', funnelId);

      if (deleteError) throw deleteError;

      const stepsToInsert = steps.map((step, index) => ({
        id: step.id,
        funnel_id: funnelId,
        order_index: index,
        step_type: step.step_type,
        content: step.content,
      }));

      const { error: insertError } = await supabase
        .from('funnel_steps')
        .insert(stepsToInsert);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] });
      queryClient.invalidateQueries({ queryKey: ['funnel-steps', funnelId] });
      setHasUnsavedChanges(false);
      toast({ title: 'Funnel saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save funnel', description: error.message, variant: 'destructive' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();

      const { error } = await supabase
        .from('funnels')
        .update({ status: 'published' })
        .eq('id', funnelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] });
      toast({ title: 'Funnel published' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to publish funnel', description: error.message, variant: 'destructive' });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        setHasUnsavedChanges(true);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddStep = (stepType: FunnelStep['step_type']) => {
    const newStep: FunnelStep = {
      id: crypto.randomUUID(),
      funnel_id: funnelId!,
      order_index: steps.length,
      step_type: stepType,
      content: getDefaultContent(stepType),
    };

    const thankYouIndex = steps.findIndex((s) => s.step_type === 'thank_you');
    if (thankYouIndex !== -1) {
      const newSteps = [...steps];
      newSteps.splice(thankYouIndex, 0, newStep);
      setSteps(newSteps);
    } else {
      setSteps([...steps, newStep]);
    }

    setSelectedStepId(newStep.id);
    setHasUnsavedChanges(true);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    if (selectedStepId === stepId) {
      setSelectedStepId(steps[0]?.id || null);
    }
    setHasUnsavedChanges(true);
  };

  const handleUpdateStep = (stepId: string, content: FunnelStep['content']) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, content } : s)));
    setHasUnsavedChanges(true);
  };

  const handleUpdateDesign = (stepId: string, design: StepDesign) => {
    setStepDesigns((prev) => ({ ...prev, [stepId]: design }));
    setHasUnsavedChanges(true);
  };

  const handleUpdateSettings = (stepId: string, settings: StepSettings) => {
    setStepSettings((prev) => ({ ...prev, [stepId]: settings }));
    setHasUnsavedChanges(true);
  };

  const handleUpdateBlocks = (stepId: string, blocks: ContentBlock[]) => {
    setStepBlocks((prev) => ({ ...prev, [stepId]: blocks }));
    setHasUnsavedChanges(true);
  };

  const handleUpdateElementOrder = (stepId: string, order: string[]) => {
    setElementOrders((prev) => ({ ...prev, [stepId]: order }));
    setHasUnsavedChanges(true);
  };

  const handlePreview = () => {
    setShowLivePreview(true);
  };

  const handleOpenInNewTab = () => {
    window.open(`/f/${funnel?.slug}`, '_blank');
  };

  const handleDuplicateStep = (stepId: string) => {
    const stepToDuplicate = steps.find(s => s.id === stepId);
    if (!stepToDuplicate) return;
    
    const newStep: FunnelStep = {
      ...stepToDuplicate,
      id: crypto.randomUUID(),
      content: { ...stepToDuplicate.content, headline: `${stepToDuplicate.content.headline || 'Untitled'} (Copy)` },
    };
    
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const newSteps = [...steps];
    newSteps.splice(stepIndex + 1, 0, newStep);
    setSteps(newSteps);
    setSelectedStepId(newStep.id);
    setHasUnsavedChanges(true);
  };

  const handleRenameStep = (stepId: string, newName: string) => {
    setSteps(steps.map(s => 
      s.id === stepId 
        ? { ...s, content: { ...s.content, headline: newName } }
        : s
    ));
    setHasUnsavedChanges(true);
  };

  const handleOpenPageSettings = (stepId: string) => {
    setPageSettingsStepId(stepId);
    setShowPageSettings(true);
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === stepId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    setSteps(arrayMove(steps, index, newIndex));
    setHasUnsavedChanges(true);
  };

  // Navigation between steps
  const currentStepIndex = steps.findIndex((s) => s.id === selectedStepId);
  const handleNavigatePrevious = () => {
    if (currentStepIndex > 0) {
      setSelectedStepId(steps[currentStepIndex - 1].id);
      setSelectedElement(null);
    }
  };
  const handleNavigateNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setSelectedStepId(steps[currentStepIndex + 1].id);
      setSelectedElement(null);
    }
  };

  const selectedStep = steps.find((s) => s.id === selectedStepId);

  if (funnelLoading || stepsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Funnel not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-card px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/team/${teamId}/funnels`)}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="w-32 sm:w-64 font-semibold text-sm sm:text-base"
            />

            <Badge 
              variant={funnel.status === 'published' ? 'default' : 'secondary'}
              className="hidden sm:inline-flex"
            >
              {funnel.status}
            </Badge>

            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-500 border-orange-500 hidden sm:inline-flex">
                Unsaved
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Focus mode toggle */}
            <Button
              variant={focusMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFocusMode(!focusMode)}
              title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="hidden sm:flex">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              className="hidden sm:flex"
            >
              <Play className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Preview</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="hidden sm:flex"
            >
              <Eye className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Open</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>

            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <Globe className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{funnel.status === 'published' ? 'Update' : 'Publish'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Editor Area - Responsive 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Toggle Button */}
        {!focusMode && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 z-30 h-8 w-6 rounded-l-none bg-card border border-l-0 hover:bg-accent",
              showLeftPanel ? "hidden" : "flex"
            )}
            onClick={() => setShowLeftPanel(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Left Sidebar - Pages List */}
        <div className={cn(
          "border-r bg-card overflow-y-auto flex-shrink-0 transition-all duration-300 relative",
          focusMode ? "w-0 p-0 overflow-hidden border-0" :
          showLeftPanel ? "w-44 lg:w-52 p-2 sm:p-3" : "w-0 p-0 overflow-hidden border-0"
        )}>
          {/* Collapse button */}
          {showLeftPanel && !focusMode && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-1 h-6 w-6 z-10"
              onClick={() => setShowLeftPanel(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <PagesList
              steps={steps}
              selectedStepId={selectedStepId}
              onSelectStep={(id) => {
                setSelectedStepId(id);
                setSelectedElement(null);
              }}
              onDeleteStep={handleDeleteStep}
              onAddStep={() => setShowAddStep(true)}
              onDuplicateStep={handleDuplicateStep}
              onRenameStep={handleRenameStep}
              onOpenPageSettings={handleOpenPageSettings}
              onMoveStep={handleMoveStep}
            />
          </DndContext>
        </div>

        {/* Center - Phone Mockup Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/50 overflow-x-hidden overflow-y-auto p-2">
          {selectedStep && (
            <>
              <PhoneMockup 
                backgroundColor={stepDesigns[selectedStep.id]?.backgroundColor || funnel.settings.background_color}
                className={cn(
                  "transition-transform duration-300",
                  focusMode 
                    ? "scale-100 sm:scale-110 lg:scale-125 xl:scale-[1.35]" 
                    : "scale-[0.85] sm:scale-95 lg:scale-110 xl:scale-[1.2]"
                )}
              >
                <StepPreview
                  step={selectedStep}
                  settings={funnel.settings}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  design={stepDesigns[selectedStep.id]}
                  elementOrder={elementOrders[selectedStep.id]}
                  onReorderElements={(order) => handleUpdateElementOrder(selectedStep.id, order)}
                  onUpdateContent={(field, value) => {
                    handleUpdateStep(selectedStep.id, { ...selectedStep.content, [field]: value });
                  }}
                />
              </PhoneMockup>

              {/* Navigation Arrows */}
              <PreviewNavigation
                currentIndex={currentStepIndex}
                totalSteps={steps.length}
                onPrevious={handleNavigatePrevious}
                onNext={handleNavigateNext}
                className="mt-4"
              />
            </>
          )}
        </div>

        {/* Right Sidebar Toggle Button */}
        {!focusMode && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 z-30 h-8 w-6 rounded-r-none bg-card border border-r-0 hover:bg-accent",
              showRightPanel ? "hidden" : "flex"
            )}
            onClick={() => setShowRightPanel(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Right Sidebar - Editor Panel */}
        <div className={cn(
          "border-l bg-card overflow-y-auto flex-shrink-0 transition-all duration-300 relative",
          focusMode ? "w-0 p-0 overflow-hidden border-0" :
          showRightPanel ? "w-60 lg:w-72 p-2 sm:p-3" : "w-0 p-0 overflow-hidden border-0"
        )}>
          {/* Collapse button */}
          {showRightPanel && !focusMode && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-1 h-6 w-6 z-10"
              onClick={() => setShowRightPanel(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {selectedStep ? (
            <EditorSidebar
              step={selectedStep}
              selectedElement={selectedElement}
              onUpdateContent={(content) => handleUpdateStep(selectedStep.id, content)}
              onUpdateDesign={(design) => handleUpdateDesign(selectedStep.id, design)}
              onUpdateSettings={(settings) => handleUpdateSettings(selectedStep.id, settings)}
              onUpdateBlocks={(blocks) => handleUpdateBlocks(selectedStep.id, blocks)}
              design={stepDesigns[selectedStep.id] || {}}
              settings={stepSettings[selectedStep.id] || {}}
              blocks={stepBlocks[selectedStep.id] || []}
            />
          ) : (
            <div className="text-muted-foreground text-center py-8">
              Select a page to edit
            </div>
          )}
        </div>

        {/* Mobile overlay */}
        {isMobile && (showLeftPanel || showRightPanel) && (
          <div 
            className="absolute inset-0 bg-black/50 z-10"
            onClick={() => {
              setShowLeftPanel(false);
              setShowRightPanel(false);
            }}
          />
        )}
      </div>

      <FunnelSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        funnel={funnel}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] });
        }}
      />

      <AddStepDialog
        open={showAddStep}
        onOpenChange={setShowAddStep}
        onAddStep={handleAddStep}
      />

      <LivePreviewMode
        open={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        funnel={funnel}
        steps={steps}
      />

      {pageSettingsStepId && (
        <PageSettingsDialog
          open={showPageSettings}
          onOpenChange={setShowPageSettings}
          step={steps.find(s => s.id === pageSettingsStepId)!}
          allSteps={steps}
          settings={pageSettings[pageSettingsStepId] || {}}
          onSave={(settings) => {
            setPageSettings(prev => ({ ...prev, [pageSettingsStepId]: settings }));
            setHasUnsavedChanges(true);
          }}
        />
      )}
    </div>
  );
}

function getDefaultContent(stepType: FunnelStep['step_type']): FunnelStep['content'] {
  switch (stepType) {
    case 'welcome':
      return {
        headline: 'Welcome',
        subtext: 'Start your journey with us',
        button_text: 'Get Started',
      };
    case 'text_question':
      return {
        headline: 'What is your name?',
        placeholder: 'Type your answer...',
        is_required: true,
      };
    case 'multi_choice':
      return {
        headline: 'Choose an option',
        options: ['Option 1', 'Option 2', 'Option 3'],
        is_required: true,
      };
    case 'email_capture':
      return {
        headline: 'What is your email?',
        subtext: 'We will send you important updates',
        placeholder: 'email@example.com',
        is_required: true,
      };
    case 'phone_capture':
      return {
        headline: 'What is your phone number?',
        subtext: 'We will reach out to schedule a call',
        placeholder: '(555) 123-4567',
        is_required: true,
      };
    case 'video':
      return {
        headline: 'Watch this video',
        video_url: '',
        button_text: 'Continue',
      };
    case 'thank_you':
      return {
        headline: 'Thank You!',
        subtext: 'We will be in touch soon.',
      };
    default:
      return {};
  }
}
