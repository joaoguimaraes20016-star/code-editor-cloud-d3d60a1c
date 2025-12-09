import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Eye, Save, Globe, Play, Maximize2, Minimize2, ChevronLeft, ChevronRight, Undo2, Redo2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PagesList } from '@/components/funnel-builder/PagesList';
import { EditorSidebar } from '@/components/funnel-builder/EditorSidebar';
import { FunnelSettingsDialog } from '@/components/funnel-builder/FunnelSettingsDialog';
import { DevicePreview } from '@/components/funnel-builder/DevicePreview';
import { StepPreview } from '@/components/funnel-builder/StepPreview';
import { PreviewNavigation } from '@/components/funnel-builder/PreviewNavigation';
import { AddStepDialog } from '@/components/funnel-builder/AddStepDialog';
import { ContentBlock } from '@/components/funnel-builder/ContentBlockEditor';
import { LivePreviewMode } from '@/components/funnel-builder/LivePreviewMode';
import { PageSettingsDialog } from '@/components/funnel-builder/PageSettingsDialog';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFunnelHistory } from '@/hooks/useFunnelHistory';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface StepDesign {
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
  // Background gradient
  useGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  // Image overlay
  imageOverlay?: boolean;
  imageOverlayColor?: string;
  imageOverlayOpacity?: number;
  // Button gradient
  useButtonGradient?: boolean;
  buttonGradientFrom?: string;
  buttonGradientTo?: string;
  buttonGradientDirection?: string;
  // Button animation
  buttonAnimation?: 'none' | 'fade' | 'slide-up' | 'bounce' | 'scale';
  buttonAnimationDuration?: number;
  // Button hover effect
  buttonHoverEffect?: 'none' | 'glow' | 'lift' | 'pulse' | 'shine';
  // Option card styling (multi-choice)
  optionCardBg?: string;
  optionCardBorder?: string;
  optionCardBorderWidth?: number;
  optionCardSelectedBg?: string;
  optionCardSelectedBorder?: string;
  optionCardHoverEffect?: 'none' | 'scale' | 'glow' | 'lift';
  optionCardRadius?: number;
}

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
    options?: Array<string | { text: string; emoji?: string }>;
    is_required?: boolean;
    redirect_url?: string;
    // Multi-choice specific
    next_button_text?: string;
    show_next_button?: boolean;
    // Persisted design and layout
    design?: StepDesign;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
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

// Using StepDesign from the exported interface above

interface StepSettings {
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  skipEnabled?: boolean;
  progressBar?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  animationDuration?: number;
  animationEasing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

// Unified state for undo/redo history
interface FunnelState {
  name: string;
  steps: FunnelStep[];
  stepDesigns: Record<string, StepDesign>;
  stepSettings: Record<string, StepSettings>;
  elementOrders: Record<string, string[]>;
}

export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Use the history hook for undo/redo
  const {
    state: funnelState,
    set: setFunnelState,
    undo,
    redo,
    reset: resetHistory,
    canUndo,
    canRedo,
  } = useFunnelHistory<FunnelState>({
    name: '',
    steps: [],
    stepDesigns: {},
    stepSettings: {},
    elementOrders: {},
  });

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsStepId, setPageSettingsStepId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [devicePreview, setDevicePreview] = useState<DeviceType>('mobile');
  const [stepBlocks, setStepBlocks] = useState<Record<string, ContentBlock[]>>({});
  const [pageSettings, setPageSettingsState] = useState<Record<string, any>>({});
  const [dynamicElements, setDynamicElements] = useState<Record<string, Record<string, any>>>({});
  const [isInitialized, setIsInitialized] = useState(false); // Track if initial load happened
  
  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Destructure for convenience
  const { name, steps, stepDesigns, stepSettings, elementOrders } = funnelState;
  
  // Refs to track latest state values for save mutation (avoids stale closures)
  const dynamicElementsRef = useRef(dynamicElements);
  const stepDesignsRef = useRef(stepDesigns);
  const elementOrdersRef = useRef(elementOrders);
  const stepsRef = useRef(steps);
  
  // Keep refs in sync
  useEffect(() => { dynamicElementsRef.current = dynamicElements; }, [dynamicElements]);
  useEffect(() => { stepDesignsRef.current = stepDesigns; }, [stepDesigns]);
  useEffect(() => { elementOrdersRef.current = elementOrders; }, [elementOrders]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  // Helper functions to update state through the history-tracked funnel state
  const setName = useCallback((newName: string) => {
    setFunnelState(prev => ({ ...prev, name: newName }));
  }, [setFunnelState]);

  const setSteps = useCallback((newSteps: FunnelStep[] | ((prev: FunnelStep[]) => FunnelStep[])) => {
    setFunnelState(prev => ({
      ...prev,
      steps: typeof newSteps === 'function' ? newSteps(prev.steps) : newSteps
    }));
  }, [setFunnelState]);

  const setStepDesigns = useCallback((newDesigns: Record<string, StepDesign> | ((prev: Record<string, StepDesign>) => Record<string, StepDesign>)) => {
    setFunnelState(prev => ({
      ...prev,
      stepDesigns: typeof newDesigns === 'function' ? newDesigns(prev.stepDesigns) : newDesigns
    }));
  }, [setFunnelState]);

  const setStepSettingsState = useCallback((newSettings: Record<string, StepSettings> | ((prev: Record<string, StepSettings>) => Record<string, StepSettings>)) => {
    setFunnelState(prev => ({
      ...prev,
      stepSettings: typeof newSettings === 'function' ? newSettings(prev.stepSettings) : newSettings
    }));
  }, [setFunnelState]);

  const setElementOrders = useCallback((newOrders: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
    setFunnelState(prev => ({
      ...prev,
      elementOrders: typeof newOrders === 'function' ? newOrders(prev.elementOrders) : newOrders
    }));
  }, [setFunnelState]);

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
    // CRITICAL: Disable all refetching to prevent state reset
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
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
    // CRITICAL: Disable all refetching to prevent state reset
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  // Initialize the history state ONLY on first load - not on refetch
  useEffect(() => {
    if (funnel && initialSteps && !isInitialized) {
      // Load persisted designs, element orders, and dynamic elements from step content
      const loadedDesigns: Record<string, StepDesign> = {};
      const loadedOrders: Record<string, string[]> = {};
      const loadedDynamicElements: Record<string, Record<string, any>> = {};
      
      initialSteps.forEach(step => {
        if (step.content.design) {
          loadedDesigns[step.id] = step.content.design;
        }
        if (step.content.element_order) {
          loadedOrders[step.id] = step.content.element_order;
        }
        if (step.content.dynamic_elements) {
          loadedDynamicElements[step.id] = step.content.dynamic_elements;
        }
      });
      
      // Set dynamic elements state
      setDynamicElements(loadedDynamicElements);
      
      // Reset the history with the loaded state
      resetHistory({
        name: funnel.name,
        steps: initialSteps,
        stepDesigns: loadedDesigns,
        stepSettings: {},
        elementOrders: loadedOrders,
      });
      
      if (initialSteps.length > 0 && !selectedStepId) {
        setSelectedStepId(initialSteps[0].id);
      }
      
      setIsInitialized(true);
    }
  }, [funnel, initialSteps, resetHistory, isInitialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Use refs to get latest values (avoids stale closure)
      const currentSteps = stepsRef.current;
      const currentStepDesigns = stepDesignsRef.current;
      const currentElementOrders = elementOrdersRef.current;
      const currentDynamicElements = dynamicElementsRef.current;
      
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

      const stepsToInsert = currentSteps.map((step, index) => {
        // Merge current designs, element orders, and dynamic elements into content for persistence
        const contentWithDesign = {
          ...step.content,
          design: currentStepDesigns[step.id] || step.content.design || null,
          element_order: currentElementOrders[step.id] || step.content.element_order || null,
          dynamic_elements: currentDynamicElements[step.id] || step.content.dynamic_elements || null,
        };
        
        return {
          id: step.id,
          funnel_id: funnelId,
          order_index: index,
          step_type: step.step_type,
          content: JSON.parse(JSON.stringify(contentWithDesign)),
        };
      });

      const { error: insertError } = await supabase
        .from('funnel_steps')
        .insert(stepsToInsert);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      // Silent background save - no state updates that cause re-renders
      setLastSaved(new Date());
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  // Immediate save on any change - completely silent
  // Track dynamicElements changes to trigger saves
  useEffect(() => {
    if (isInitialized && Object.keys(dynamicElements).length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [dynamicElements, isInitialized]);

  useEffect(() => {
    if (hasUnsavedChanges && !saveMutation.isPending && steps.length > 0 && isInitialized) {
      // Clear any existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      // Save immediately with tiny debounce just to batch rapid changes
      autoSaveTimerRef.current = setTimeout(() => {
        setHasUnsavedChanges(false); // Reset before save to prevent loops
        saveMutation.mutate();
      }, 500);
    }
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, isInitialized, dynamicElements, stepDesigns, elementOrders]);

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
      // Don't invalidate queries - it resets local state!
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
    setStepSettingsState((prev) => ({ ...prev, [stepId]: settings }));
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

            {/* Silent auto-save - no visible indicators */}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Undo/Redo Buttons */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={undo}
                    disabled={!canUndo}
                    className="h-8 w-8 p-0"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={redo}
                    disabled={!canRedo}
                    className="h-8 w-8 p-0"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

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

        {/* Center - Device Preview - full scrollable area */}
        <div className="flex-1 flex flex-col items-center bg-zinc-900/50 overflow-x-auto overflow-y-auto py-6 px-4">
          {selectedStep && (
            <>
              <DevicePreview 
                backgroundColor={stepDesigns[selectedStep.id]?.backgroundColor || funnel.settings.background_color}
                device={devicePreview}
                onDeviceChange={setDevicePreview}
                className={cn(
                  "transition-transform duration-300",
                  focusMode 
                    ? "scale-100" 
                    : devicePreview === 'desktop' ? "scale-[0.7] lg:scale-[0.85]" :
                      devicePreview === 'tablet' ? "scale-[0.8] lg:scale-90" :
                      "scale-[0.9] lg:scale-100"
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
                  dynamicContent={dynamicElements[selectedStep.id] || {}}
                  onUpdateDynamicContent={(elementId, value) => {
                    setDynamicElements(prev => ({
                      ...prev,
                      [selectedStep.id]: {
                        ...(prev[selectedStep.id] || {}),
                        [elementId]: { ...(prev[selectedStep.id]?.[elementId] || {}), ...value }
                      }
                    }));
                    setHasUnsavedChanges(true);
                  }}
                />
              </DevicePreview>

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
              elementOrder={elementOrders[selectedStep.id] || []}
              dynamicContent={dynamicElements[selectedStep.id] || {}}
              onUpdateDynamicContent={(elementId, value) => {
                setDynamicElements(prev => ({
                  ...prev,
                  [selectedStep.id]: {
                    ...(prev[selectedStep.id] || {}),
                    [elementId]: { ...(prev[selectedStep.id]?.[elementId] || {}), ...value }
                  }
                }));
                setHasUnsavedChanges(true);
              }}
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
          // Don't invalidate queries - it resets local state!
          // Settings are saved directly by the dialog
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
        dynamicElements={dynamicElements}
        stepDesigns={stepDesigns}
        elementOrders={elementOrders}
      />

      {pageSettingsStepId && (
        <PageSettingsDialog
          open={showPageSettings}
          onOpenChange={setShowPageSettings}
          step={steps.find(s => s.id === pageSettingsStepId)!}
          allSteps={steps}
          settings={pageSettings[pageSettingsStepId] || {}}
          onSave={(settings) => {
            setPageSettingsState(prev => ({ ...prev, [pageSettingsStepId]: settings }));
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
