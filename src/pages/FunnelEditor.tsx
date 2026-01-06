import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Eye, Save, Globe, Play, Maximize2, Minimize2, ChevronLeft, ChevronRight, Undo2, Redo2, Link2, AlertTriangle } from 'lucide-react';
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
import { KeyboardShortcutsPanel } from '@/components/funnel-builder/KeyboardShortcutsPanel';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFunnelHistory } from '@/hooks/useFunnelHistory';
import { useTeamRole } from '@/hooks/useTeamRole';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getDefaultIntent, validateFunnelStructure, countCaptureSteps } from '@/lib/funnel/stepDefinitions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import NotFound from './NotFound';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sanitizeUUID = (v?: string | null) => typeof v === 'string' ? v.replace(/^"+|"+$/g, '') : v;
const validateUuid = (value: string | null | undefined, label: string): string => {
  const cleaned = sanitizeUUID(value);
  if (!cleaned) throw new Error(`Missing ${label}`);
  if (!UUID_RE.test(cleaned)) throw new Error(`Invalid ${label}`);
  return cleaned;
};

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
  // Input/Textarea styling (text_question)
  inputBg?: string;
  inputTextColor?: string;
  inputBorder?: string;
  inputBorderWidth?: number;
  inputRadius?: number;
  inputPlaceholderColor?: string;
  inputFocusBorder?: string;
  inputShowIcon?: boolean;
}

export interface FunnelStep {
  id: string;
  funnel_id: string;
  order_index: number;
  step_type: 'welcome' | 'text_question' | 'multi_choice' | 'email_capture' | 'phone_capture' | 'video' | 'thank_you' | 'opt_in' | 'embed';
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
    // Text/Email/Phone input submit button
    submit_button_text?: string;
    // Opt-in form specific
    name_placeholder?: string;
    email_placeholder?: string;
    phone_placeholder?: string;
    name_icon?: string;
    email_icon?: string;
    phone_icon?: string;
    privacy_text?: string;
    privacy_link?: string;
    // Consent / compliance
    requires_consent?: boolean;
    show_consent_checkbox?: boolean;
    consent_mode?: 'explicit' | 'implicit';
    // Embed specific
    embed_url?: string;
    embed_height?: number;
    embed_scale?: number;
    // Persisted design and layout
    design?: StepDesign;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    // Step intent for workflow triggering
    intent?: 'capture' | 'collect' | 'schedule' | 'complete';
  };
}

export interface FunnelSettings {
  logo_url?: string;
  primary_color: string;
  background_color: string;
  button_text: string;
  ghl_webhook_url?: string;
  privacy_policy_url?: string;
  // SEO settings
  favicon_url?: string;
  seo_title?: string;
  seo_description?: string;
  seo_image?: string;
  // Pixel Tracking
  meta_pixel_id?: string;
  google_analytics_id?: string;
  google_ads_id?: string;
  tiktok_pixel_id?: string;
  // Display settings
  show_progress_bar?: boolean;
}

export interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  settings: FunnelSettings;
  zapier_webhook_url?: string | null;
  webhook_urls?: string[] | null;
  domain_id?: string | null;
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
  dynamicElements: Record<string, Record<string, any>>;
  stepBlocks: Record<string, ContentBlock[]>;
  pageSettings: Record<string, any>;
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading funnel editor...</span>
    </div>
  );
}

function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdmin, loading: roleLoading } = useTeamRole(teamId);

  // Redirect non-admins back to funnel list
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate(`/team/${teamId}/funnels`, { replace: true });
    }
  }, [roleLoading, isAdmin, teamId, navigate]);

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
    dynamicElements: {},
    stepBlocks: {},
    pageSettings: {},
  });

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [dirtyState, setDirtyState] = useState<{ funnel: boolean; steps: Record<string, boolean> }>({
    funnel: false,
    steps: {},
  });
  const hasUnsavedChanges = dirtyState.funnel || Object.keys(dirtyState.steps).length > 0;
  const dirtyVersionRef = useRef(0);
  const pendingSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsStepId, setPageSettingsStepId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [devicePreview, setDevicePreview] = useState<DeviceType>('mobile');
  const [isInitialized, setIsInitialized] = useState(false); // Track if initial load happened
  const [showPublishPrompt, setShowPublishPrompt] = useState(false); // Domain prompt on publish
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const initializationRanRef = useRef(false);
  
  // Destructure for convenience
  const { name, steps, stepDesigns, stepSettings, elementOrders, dynamicElements, stepBlocks, pageSettings } = funnelState;

  const markDirty = useCallback((options?: { funnel?: boolean; stepIds?: string[] }) => {
    dirtyVersionRef.current += 1;
    setDirtyState((prev) => {
      const nextSteps = options?.stepIds?.length
        ? options.stepIds.reduce((acc, stepId) => {
          acc[stepId] = true;
          return acc;
        }, { ...prev.steps } as Record<string, boolean>)
        : prev.steps;

      return {
        funnel: options?.funnel ? true : prev.funnel,
        steps: nextSteps,
      };
    });
  }, []);

  const clearDirty = useCallback((version: number) => {
    if (dirtyVersionRef.current !== version) return;
    setDirtyState({ funnel: false, steps: {} });
  }, []);

  // Helper functions to update state through the history-tracked funnel state
  const setName = useCallback((newName: string) => {
    setFunnelState(prev => ({ ...prev, name: newName }));
    markDirty({ funnel: true });
  }, [markDirty, setFunnelState]);

  const setSteps = useCallback((newSteps: FunnelStep[] | ((prev: FunnelStep[]) => FunnelStep[])) => {
    setFunnelState(prev => {
      const resolvedSteps = typeof newSteps === 'function' ? newSteps(prev.steps) : newSteps;
      return {
        ...prev,
        steps: resolvedSteps,
      };
    });
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

  const setDynamicElementsState = useCallback((newElements: Record<string, Record<string, any>> | ((prev: Record<string, Record<string, any>>) => Record<string, Record<string, any>>)) => {
    setFunnelState(prev => ({
      ...prev,
      dynamicElements: typeof newElements === 'function' ? newElements(prev.dynamicElements) : newElements
    }));
  }, [setFunnelState]);

  const setStepBlocksState = useCallback((newBlocks: Record<string, ContentBlock[]> | ((prev: Record<string, ContentBlock[]>) => Record<string, ContentBlock[]>)) => {
    setFunnelState(prev => ({
      ...prev,
      stepBlocks: typeof newBlocks === 'function' ? newBlocks(prev.stepBlocks) : newBlocks
    }));
  }, [setFunnelState]);

  const setPageSettingsState = useCallback((newSettings: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
    setFunnelState(prev => ({
      ...prev,
      pageSettings: typeof newSettings === 'function' ? newSettings(prev.pageSettings) : newSettings
    }));
  }, [setFunnelState]);

  const persistFunnel = useCallback(async (overrides?: {
    steps?: FunnelStep[];
    stepDesigns?: Record<string, StepDesign>;
    elementOrders?: Record<string, string[]>;
    dynamicElements?: Record<string, Record<string, any>>;
    name?: string;
  }) => {
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return savePromiseRef.current ?? Promise.resolve();
    }

    const saveVersion = dirtyVersionRef.current;
    setIsSaving(true);
    isSavingRef.current = true;
    const savePromise = (async () => {
      try {
        const cleanFunnelId = validateUuid(funnelId, 'funnel id');
        const cleanTeamId = validateUuid(teamId, 'team id');

        const stepsToPersist = overrides?.steps ?? steps;
        const stepDesignsToPersist = overrides?.stepDesigns ?? stepDesigns;
        const elementOrdersToPersist = overrides?.elementOrders ?? elementOrders;
        const dynamicElementsToPersist = overrides?.dynamicElements ?? dynamicElements;
        const funnelNameToPersist = overrides?.name ?? name;

        const stepIds = stepsToPersist.map(s => validateUuid(s.id, 'step id'));

        const { error: funnelError } = await supabase
          .from('funnels')
          .update({ name: funnelNameToPersist })
          .eq('id', cleanFunnelId)
          .eq('team_id', cleanTeamId);

        if (funnelError) throw funnelError;

        if (stepIds.length > 0) {
          const { data: existingSteps, error: existingError } = await supabase
            .from('funnel_steps')
            .select('id')
            .eq('funnel_id', cleanFunnelId);
          if (existingError) throw existingError;

          const idsToDelete = (existingSteps ?? [])
            .map((step) => step.id)
            .filter((id) => !stepIds.includes(id));

          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('funnel_steps')
              .delete()
              .in('id', idsToDelete);
            if (deleteError) throw deleteError;
          }
        } else {
          const { error: deleteError } = await supabase
            .from('funnel_steps')
            .delete()
            .eq('funnel_id', cleanFunnelId);
          if (deleteError) throw deleteError;
        }

        const stepsToInsert = stepsToPersist.map((step, index) => {
          const stepId = validateUuid(step.id, 'step id');
          const baseContent = { ...step.content } as FunnelStep['content'];
          const termsUrl =
            baseContent.privacy_link ||
            (baseContent as any).terms_url ||
            (baseContent as any).terms_link ||
            '';

          if (step.step_type === 'opt_in' && termsUrl && baseContent.requires_consent !== true) {
            baseContent.requires_consent = true;
          }

          if (baseContent.requires_consent === true && baseContent.show_consent_checkbox !== true) {
            baseContent.show_consent_checkbox = true;
          }

          const contentWithDesign = {
            ...baseContent,
            design: stepDesignsToPersist[step.id] || step.content.design || null,
            element_order: elementOrdersToPersist[step.id] || step.content.element_order || null,
            dynamic_elements: dynamicElementsToPersist[step.id] || step.content.dynamic_elements || null,
          };

          return {
            id: stepId,
            funnel_id: cleanFunnelId,
            order_index: index,
            step_type: step.step_type,
            content: JSON.parse(JSON.stringify(contentWithDesign)),
          };
        });

        const { error: upsertError } = await supabase
          .from('funnel_steps')
          .upsert(stepsToInsert, { onConflict: 'id' });

        if (upsertError) throw upsertError;

        setLastSaved(new Date());
        clearDirty(saveVersion);
      } catch (error) {
        const err = error as Error;
        toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
      } finally {
        setIsSaving(false);
        isSavingRef.current = false;
        savePromiseRef.current = null;
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          if (dirtyVersionRef.current !== saveVersion) {
            await persistFunnel();
          }
        }
      }
    })();

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [clearDirty, dynamicElements, elementOrders, funnelId, name, stepDesigns, steps, teamId]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void persistFunnel();
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [hasUnsavedChanges, persistFunnel]);

  const markStepsDirty = useCallback((stepIds: string[]) => {
    if (stepIds.length === 0) return;
    markDirty({ stepIds });
  }, [markDirty]);

  const updateStepContent = useCallback((stepId: string, patch: Partial<FunnelStep['content']>) => {
    setSteps((prev) => prev.map((step) => (
      step.id === stepId
        ? { ...step, content: { ...step.content, ...patch } }
        : step
    )));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setSteps]);

  const updateStepDesign = useCallback((stepId: string, design: StepDesign) => {
    setStepDesigns((prev) => ({ ...prev, [stepId]: design }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setStepDesigns]);

  const updateStepSettings = useCallback((stepId: string, settings: StepSettings) => {
    setStepSettingsState((prev) => ({ ...prev, [stepId]: settings }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setStepSettingsState]);

  const updateStepBlocks = useCallback((stepId: string, blocks: ContentBlock[]) => {
    setStepBlocksState((prev) => ({ ...prev, [stepId]: blocks }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setStepBlocksState]);

  const updateElementOrder = useCallback((stepId: string, order: string[]) => {
    setElementOrders((prev) => ({ ...prev, [stepId]: order }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setElementOrders]);

  const updateDynamicElement = useCallback((stepId: string, elementId: string, patch: Record<string, any>) => {
    setDynamicElementsState((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [elementId]: { ...(prev[stepId]?.[elementId] || {}), ...patch },
      },
    }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setDynamicElementsState]);

  const replaceDynamicElement = useCallback((stepId: string, elementId: string, value: Record<string, any>) => {
    setDynamicElementsState((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [elementId]: value,
      },
    }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setDynamicElementsState]);

  const updatePageSettings = useCallback((stepId: string, settings: Record<string, any>) => {
    setPageSettingsState((prev) => ({ ...prev, [stepId]: settings }));
    markStepsDirty([stepId]);
  }, [markStepsDirty, setPageSettingsState]);

  const tryInitialize = useCallback((funnelData: Funnel, dbSteps: FunnelStep[]) => {
    if (initializationRanRef.current) return;

    try {

      const loadedDesigns: Record<string, StepDesign> = {};
      const loadedOrders: Record<string, string[]> = {};
      const loadedDynamicElements: Record<string, Record<string, any>> = {};

      const migratedSteps = dbSteps.map(step => {
        const safeContent = step.content ?? {};

        if (safeContent.design) {
          loadedDesigns[step.id] = safeContent.design;
        }
        if (safeContent.element_order) {
          loadedOrders[step.id] = safeContent.element_order;
        }
        if (safeContent.dynamic_elements) {
          loadedDynamicElements[step.id] = safeContent.dynamic_elements;
        }

        if (!safeContent.intent) {
          const defaultIntent = getDefaultIntent(step.step_type);
          return {
            ...step,
            content: {
              ...safeContent,
              intent: defaultIntent,
            },
          };
        }
        return {
          ...step,
          content: safeContent,
        };
      });

      const hasDbSteps = migratedSteps.length > 0;
      const stepsToLoad = hasDbSteps
        ? migratedSteps
        : [{
            id: crypto.randomUUID(),
            funnel_id: funnelData.id,
            order_index: 0,
            step_type: 'welcome',
            content: {},
          }];

      resetHistory({
        name: funnelData.name,
        steps: stepsToLoad,
        stepDesigns: loadedDesigns,
        stepSettings: {},
        elementOrders: loadedOrders,
        dynamicElements: loadedDynamicElements,
        stepBlocks: {},
        pageSettings: {},
      });

      if (stepsToLoad.length > 0 && !selectedStepId) {
        setSelectedStepId(stepsToLoad[0].id);
      }

      setIsInitialized(true);
      initializationRanRef.current = true;

      const neededMigration = dbSteps.some(step => !(step.content ?? {}).intent);
      if (neededMigration) {
        console.log('[FunnelEditor] Auto-migrated step intents for',
          dbSteps.filter(s => !(s.content ?? {}).intent).length, 'steps');
        markDirty({ stepIds: stepsToLoad.map(step => step.id) });
      }

      const warnings = validateFunnelStructure(stepsToLoad);
      if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('[FunnelEditor] Structure warnings:', warnings);
      }
    } catch (error) {
      const err = error as Error;
      console.error('[FunnelEditor] Initialization failed:', err);
      setInitializationError(err.message || 'Failed to initialize editor.');
    }

  }, [markDirty, resetHistory, selectedStepId, setIsInitialized]);

  const {
    data: funnel,
    isLoading: isFunnelLoading,
    isError: isFunnelError,
    error: funnelError,
  } = useQuery({
    queryKey: ['funnels', teamId, funnelId],
    queryFn: async () => {
      if (!teamId) {
        throw new Error('Missing team id');
      }

      const cleanFunnelId = validateUuid(funnelId, 'funnel id');
      const cleanTeamId = validateUuid(teamId, 'team id');
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('id', cleanFunnelId);

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Funnel not found');
      }
      const row = data[0];
      return { ...row, settings: row.settings as unknown as FunnelSettings } as Funnel;
    },
    enabled: !!teamId && !!funnelId,
    // CRITICAL: Disable all refetching to prevent state reset
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    onSuccess: () => {
      setInitializationError(null);
    },
  });

  // Fetch domains for publish prompt
  const { data: domains = [] } = useQuery({
    queryKey: ['funnel-domains', teamId],
    queryFn: async () => {
      const cleanTeamId = validateUuid(teamId, 'team id');
      const { data, error } = await supabase
        .from('funnel_domains')
        .select('*')
        .eq('team_id', cleanTeamId)
        .eq('status', 'verified');
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  // Get linked domain for this funnel
  const linkedDomain = funnel?.domain_id 
    ? domains.find(d => d.id === funnel.domain_id)?.domain 
    : null;

  const {
    data: stepsData,
    isLoading: isStepsLoading,
    isError: isStepsError,
    error: stepsError,
  } = useQuery({
    queryKey: ['funnel-steps', funnelId],
    queryFn: async () => {
      const cleanFunnelId = validateUuid(funnelId, 'funnel id');
      const { data, error } = await supabase
        .from('funnel_steps')
        .select('*')
        .eq('funnel_id', cleanFunnelId)
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
    onSuccess: () => {
      setInitializationError(null);
    },
  });

  useEffect(() => {
    if (initializationRanRef.current) return;
    if (!funnel || !stepsData) return;
    if (initializationError) return;

    tryInitialize(funnel, stepsData);
  }, [funnel, stepsData, initializationError, tryInitialize]);

  const handlePublish = useCallback(async () => {
    if (isPublishing) return;

    setIsPublishing(true);

    try {
      await persistFunnel();

      const cleanFunnelId = validateUuid(funnelId, 'funnel id');
      const cleanTeamId = validateUuid(teamId, 'team id');

      const { error } = await supabase
        .from('funnels')
        .update({ status: 'published' })
        .eq('id', cleanFunnelId)
        .eq('team_id', cleanTeamId);

      if (error) {
        throw error;
      }
    } catch (error) {
      const err = error as Error;
      toast({ title: 'Failed to publish', description: err.message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }, [funnelId, isPublishing, persistFunnel, teamId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        markStepsDirty(reordered.map((step) => step.id));
        return reordered;
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
    const newSteps = [...steps];
    if (thankYouIndex !== -1) {
      newSteps.splice(thankYouIndex, 0, newStep);
    } else {
      newSteps.push(newStep);
    }
    setSteps(newSteps);

    setSelectedStepId(newStep.id);
    markStepsDirty(newSteps.map((step) => step.id));
  };

  const handleDeleteStep = (stepId: string) => {
    const remainingSteps = steps.filter((s) => s.id !== stepId);
    setFunnelState((prev) => {
      const { [stepId]: _removedDesign, ...nextDesigns } = prev.stepDesigns;
      const { [stepId]: _removedSettings, ...nextSettings } = prev.stepSettings;
      const { [stepId]: _removedOrder, ...nextOrders } = prev.elementOrders;
      const { [stepId]: _removedDynamic, ...nextDynamic } = prev.dynamicElements;
      const { [stepId]: _removedBlocks, ...nextBlocks } = prev.stepBlocks;
      const { [stepId]: _removedPageSettings, ...nextPageSettings } = prev.pageSettings;

      return {
        ...prev,
        steps: remainingSteps,
        stepDesigns: nextDesigns,
        stepSettings: nextSettings,
        elementOrders: nextOrders,
        dynamicElements: nextDynamic,
        stepBlocks: nextBlocks,
        pageSettings: nextPageSettings,
      };
    });
    if (selectedStepId === stepId) {
      setSelectedStepId(remainingSteps[0]?.id || null);
    }
    markStepsDirty(remainingSteps.map((step) => step.id));
  };

  const handleUpdateDesign = (stepId: string, design: StepDesign) => {
    updateStepDesign(stepId, design);
  };

  const handleUpdateSettings = (stepId: string, settings: StepSettings) => {
    updateStepSettings(stepId, settings);
  };

  const handleUpdateBlocks = (stepId: string, blocks: ContentBlock[]) => {
    updateStepBlocks(stepId, blocks);
  };

  const handleUpdateElementOrder = (stepId: string, order: string[]) => {
    updateElementOrder(stepId, order);
  };

  const handlePreview = () => {
    setShowLivePreview(true);
  };

  const handleOpenInNewTab = () => {
    // Use custom domain URL if linked, otherwise use slug URL
    if (linkedDomain) {
      window.open(`https://${linkedDomain}`, '_blank');
    } else {
      window.open(`/f/${funnel?.slug}`, '_blank');
    }
  };

  const handleDuplicateStep = (stepId: string) => {
    const stepToDuplicate = steps.find(s => s.id === stepId);
    if (!stepToDuplicate) return;
    
    const newStepId = crypto.randomUUID();
    const newStep: FunnelStep = {
      ...stepToDuplicate,
      id: newStepId,
      content: { ...stepToDuplicate.content, headline: `${stepToDuplicate.content.headline || 'Untitled'} (Copy)` },
    };

    const stepIndex = steps.findIndex(s => s.id === stepId);
    const newSteps = [...steps];
    newSteps.splice(stepIndex + 1, 0, newStep);

    setFunnelState((prev) => ({
      ...prev,
      steps: newSteps,
      stepDesigns: {
        ...prev.stepDesigns,
        [newStepId]: prev.stepDesigns[stepId] ? { ...prev.stepDesigns[stepId] } : {},
      },
      stepSettings: {
        ...prev.stepSettings,
        [newStepId]: prev.stepSettings[stepId] ? { ...prev.stepSettings[stepId] } : {},
      },
      elementOrders: {
        ...prev.elementOrders,
        [newStepId]: prev.elementOrders[stepId] ? [...prev.elementOrders[stepId]] : [],
      },
      dynamicElements: {
        ...prev.dynamicElements,
        [newStepId]: prev.dynamicElements[stepId] ? { ...prev.dynamicElements[stepId] } : {},
      },
      stepBlocks: {
        ...prev.stepBlocks,
        [newStepId]: prev.stepBlocks[stepId] ? [...prev.stepBlocks[stepId]] : [],
      },
      pageSettings: {
        ...prev.pageSettings,
        [newStepId]: prev.pageSettings[stepId] ? { ...prev.pageSettings[stepId] } : {},
      },
    }));
    setSelectedStepId(newStepId);
    markStepsDirty(newSteps.map(step => step.id));
  };

  const handleRenameStep = (stepId: string, newName: string) => {
    updateStepContent(stepId, { headline: newName });
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
    
    const reordered = arrayMove(steps, index, newIndex);
    setSteps(reordered);
    markStepsDirty(reordered.map((step) => step.id));
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

  // Keyboard shortcuts for element navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (!selectedStep) return;

      const currentOrder = elementOrders[selectedStep.id] || [];

      // Arrow keys - navigate between elements
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        if (!selectedElement && currentOrder.length > 0) {
          // Select first element if nothing selected
          setSelectedElement(currentOrder[0]);
          return;
        }
        
        const currentIndex = currentOrder.indexOf(selectedElement || '');
        if (currentIndex === -1) return;
        
        const newIndex = e.key === 'ArrowUp' 
          ? Math.max(0, currentIndex - 1)
          : Math.min(currentOrder.length - 1, currentIndex + 1);
        
        setSelectedElement(currentOrder[newIndex]);
      }

      // Delete key - remove selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        // Only delete dynamic elements (not standard ones like headline, button)
        if (selectedElement.includes('_') && /^\w+_\d+/.test(selectedElement)) {
          e.preventDefault();
          const newOrder = currentOrder.filter(id => id !== selectedElement);
          handleUpdateElementOrder(selectedStep.id, newOrder);
          setSelectedElement(null);
        }
      }

      // Ctrl+D or Cmd+D - duplicate element
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElement) {
        e.preventDefault();
        const index = currentOrder.indexOf(selectedElement);
        if (index !== -1) {
          const newElementId = `${selectedElement}_copy_${crypto.randomUUID()}`;
          const newOrder = [...currentOrder];
          newOrder.splice(index + 1, 0, newElementId);
          
          // Copy dynamic content if exists
          const currentDynamic = dynamicElements[selectedStep.id]?.[selectedElement];
          if (currentDynamic) {
            replaceDynamicElement(selectedStep.id, newElementId, { ...currentDynamic });
          }
          
          handleUpdateElementOrder(selectedStep.id, newOrder);
          setSelectedElement(newElementId);
        }
      }

      // Escape - deselect element
      if (e.key === 'Escape') {
        setSelectedElement(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, selectedStep, elementOrders, dynamicElements, handleUpdateElementOrder, replaceDynamicElement]);

  if (isFunnelError) {
    return (
      <ErrorState
        title="Unable to load funnel"
        description={(funnelError as Error)?.message || "Please try again."}
      />
    );
  }

  if (isStepsError) {
    return (
      <ErrorState
        title="Unable to load funnel steps"
        description={(stepsError as Error)?.message || "Please try again."}
      />
    );
  }

  if (initializationError) {
    return (
      <ErrorState
        title="Unable to initialize the editor"
        description={initializationError}
      />
    );
  }

  if (!isInitialized || isFunnelLoading || isStepsLoading) {
    return <LoadingState />;
  }

  if (!funnel) {
    return <NotFound />;
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
              }}
              className="w-32 sm:w-64 font-semibold text-sm sm:text-base"
            />

            <Badge 
              variant={funnel.status === 'published' ? 'default' : 'secondary'}
              className="hidden sm:inline-flex"
            >
              {funnel.status}
            </Badge>

            {/* Show linked domain */}
            {linkedDomain && (
              <Badge 
                variant="outline" 
                className="hidden lg:inline-flex text-xs border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
              >
                <Link2 className="h-3 w-3 mr-1" />
                {linkedDomain}
              </Badge>
            )}
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

            <KeyboardShortcutsPanel />

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
              onClick={() => {
                void persistFunnel();
              }}
              disabled={isSaving || isPublishing}
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                // Check if funnel has no domain and there are verified domains available
                if (!funnel.domain_id && domains.length > 0) {
                  setShowPublishPrompt(true);
                } else {
                  void handlePublish();
                }
              }}
              disabled={isSaving || isPublishing}
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
          {selectedStep ? (
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
                  funnel={funnel}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  design={stepDesigns[selectedStep.id]}
                  elementOrder={elementOrders[selectedStep.id]}
                  onReorderElements={(order) => handleUpdateElementOrder(selectedStep.id, order)}
                  onUpdateContent={(field, value) => {
                    updateStepContent(selectedStep.id, { [field]: value });
                  }}
                  dynamicContent={dynamicElements[selectedStep.id] || {}}
                  onUpdateDynamicContent={(elementId, value) => {
                    updateDynamicElement(selectedStep.id, elementId, value);
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
          ) : (
            <div className="text-muted-foreground text-center mt-12">
              No steps yet. Add a step to get started.
            </div>
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
          "border-l bg-card overflow-hidden flex flex-col flex-shrink-0 transition-all duration-300 relative",
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
              onUpdateContent={(patch) => updateStepContent(selectedStep.id, patch)}
              onUpdateDesign={(design) => handleUpdateDesign(selectedStep.id, design)}
              onUpdateSettings={(settings) => handleUpdateSettings(selectedStep.id, settings)}
              onUpdateBlocks={(blocks) => handleUpdateBlocks(selectedStep.id, blocks)}
              design={stepDesigns[selectedStep.id] || {}}
              settings={stepSettings[selectedStep.id] || {}}
              blocks={stepBlocks[selectedStep.id] || []}
              elementOrder={elementOrders[selectedStep.id] || []}
              dynamicContent={dynamicElements[selectedStep.id] || {}}
              onUpdateDynamicContent={(elementId, value) => {
                updateDynamicElement(selectedStep.id, elementId, value);
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

      {funnel && (
        <FunnelSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          funnel={funnel}
          onSave={() => {
            // Mirror latest settings from dialog into local funnelState-aware view
            setFunnelState((prev) => ({
              ...prev,
              // FunnelState itself doesnt store settings, but publish validation reads
              // from the funnel query object, which the dialog just persisted. No extra
              // state is required here beyond triggering a re-render if needed.
            }));
          }}
        />
      )}

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
            updatePageSettings(pageSettingsStepId, settings);
          }}
        />
      )}

      {/* Publish Domain Prompt Dialog */}
      <Dialog open={showPublishPrompt} onOpenChange={setShowPublishPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Link2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <DialogTitle>Connect a Custom Domain?</DialogTitle>
                <DialogDescription>
                  You have verified domains available. Would you like to connect one to this funnel?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Publishing on a custom domain gives your funnel a professional, branded URL.
            </p>
            <div className="flex flex-col gap-2">
              {domains.slice(0, 3).map((domain: any) => (
                <div key={domain.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Globe className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">{domain.domain}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowPublishPrompt(false);
                void handlePublish();
              }}
              disabled={isSaving || isPublishing}
            >
              Skip for now
            </Button>
            <Button 
              onClick={() => {
                setShowPublishPrompt(false);
                navigate(`/team/${teamId}/funnels?tab=domains`);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Connect Domain
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
    case 'opt_in':
      return {
        headline: "What's the best way to reach you?",
        name_placeholder: 'Your name',
        email_placeholder: 'Your email address',
        phone_placeholder: 'Your phone number',
        name_icon: '👋',
        email_icon: '✉️',
        phone_icon: '🇺🇸',
        privacy_text: 'I have read and accept the',
        submit_button_text: 'Submit and proceed',
        is_required: true,
      };
    default:
      return {};
  }
}
