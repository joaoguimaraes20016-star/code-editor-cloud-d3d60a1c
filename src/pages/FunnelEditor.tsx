import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EditorProvider, EditorShell, useEditorStore } from '@/builder_v2';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import { createPublishedSnapshot, type PublishedDocumentSnapshot } from '@/builder_v2/state/documentTypes';
import {
  createLegacyEditorDocument,
  createLegacySnapshotPayload,
  deriveLegacyPayloadFromDocument,
  type LegacyFunnelStep,
  type LegacyFunnelSummary,
  type LegacySnapshotPayload,
} from '@/builder_v2/legacy/legacyAdapter';
import { Button } from '@/components/ui/button';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_STORAGE_KEY = 'builder_v2_editor_document';

type BuilderFunnelRow = {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  domain_id?: string | null;
  builder_document: EditorDocument | null;
  published_document_snapshot: PublishedDocumentSnapshot | null;
  updated_at: string;
};

type FunnelQueryResult = {
  funnel: BuilderFunnelRow;
  builderDocument: EditorDocument | null;
  legacyPayload: LegacySnapshotPayload | null;
  publishedSnapshot: PublishedDocumentSnapshot | null;
    if (!funnelQuery.data.builderDocument) {
      return (
        <BuilderEmptyState teamId={teamId} funnelId={funnelId} hasLegacySteps={funnelQuery.data.hasLegacySteps} />
      );
    }

    if (!editorKey) {
      return <FullscreenMessage message="Preparing Builder V2…" />;
    }

    return (
      <div className="flex h-screen flex-col bg-background">
        <EditorProvider key={editorKey}>
          <BuilderCommandBar
            funnelId={funnelId}
            teamId={teamId}
            funnelName={funnelQuery.data.funnel.name}
            legacyPayload={legacyPayload}
            onLegacyPayloadUpdate={setLegacyPayload}
            publishedSnapshot={publishedSnapshot}
            onPublished={setPublishedSnapshot}
            lastSavedAt={lastSavedAt}
            onSaved={(timestamp) => setLastSavedAt(timestamp)}
          />
          <div className="flex-1 overflow-hidden">
            <EditorShell />
          </div>
        </EditorProvider>
      </div>
    );
  }

  type BuilderCommandBarProps = {
    funnelId: string;
    teamId: string;
    funnelName: string;
    legacyPayload: LegacySnapshotPayload | null;
    onLegacyPayloadUpdate: (payload: LegacySnapshotPayload | null) => void;
    publishedSnapshot: PublishedDocumentSnapshot | null;
    onPublished: (snapshot: PublishedDocumentSnapshot) => void;
    lastSavedAt: Date | null;
    onSaved: (timestamp: Date) => void;
  };

  function BuilderCommandBar({
    funnelId,
    teamId,
    funnelName,
    legacyPayload,
    onLegacyPayloadUpdate,
    publishedSnapshot,
    onPublished,
    lastSavedAt,
    onSaved,
  }: BuilderCommandBarProps) {
    const { pages, activePageId } = useEditorStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const runtimeStatus = useMemo(() => {
      if (!publishedSnapshot) {
        return 'Draft';
      }
      return `Published • ${new Date(publishedSnapshot.publishedAt).toLocaleString()}`;
    }, [publishedSnapshot]);
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

    setSelection({ type: 'step', id: newStep.id });
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
    if (selectionStepId === stepId) {
      if (remainingSteps[0]?.id) {
        setSelection({ type: 'step', id: remainingSteps[0].id });
      } else {
        setSelection({ type: 'funnel', id: funnel?.id ?? 'funnel' });
      }
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
    setSelection({ type: 'step', id: newStepId });
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
  // Selection state is declared once near the top of the component to avoid duplicate symbols.
  const currentStepIndex = steps.findIndex((s) => s.id === selectionStepId);
  const handleNavigatePrevious = () => {
    if (currentStepIndex > 0) {
      setSelection({ type: 'step', id: steps[currentStepIndex - 1].id });
    }
  };
  const handleNavigateNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setSelection({ type: 'step', id: steps[currentStepIndex + 1].id });
    }
  };

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectionStepId) || null,
    [steps, selectionStepId]
  );

  useEffect(() => {
    if (steps.length === 0) {
      setSelection({ type: 'funnel', id: funnel?.id ?? 'funnel' });
      return;
    }

    if (selectionStepId && steps.some((step) => step.id === selectionStepId)) return;

    setSelection({ type: 'step', id: steps[0].id });
  }, [funnel?.id, selectionStepId, steps]);

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
        
        if (!selectionElementId && currentOrder.length > 0) {
          // Select first element if nothing selected
          setSelection({ type: 'element', id: buildSelectionId(selectedStep.id, currentOrder[0]) });
          return;
        }
        
        const currentIndex = currentOrder.indexOf(selectionElementId || '');
        if (currentIndex === -1) return;
        
        const newIndex = e.key === 'ArrowUp' 
          ? Math.max(0, currentIndex - 1)
          : Math.min(currentOrder.length - 1, currentIndex + 1);
        
        setSelection({ type: 'element', id: buildSelectionId(selectedStep.id, currentOrder[newIndex]) });
      }

      // Delete key - remove selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionElementId) {
        // Only delete dynamic elements (not standard ones like headline, button)
        if (selectionElementId.includes('_') && /^\w+_\d+/.test(selectionElementId)) {
          e.preventDefault();
          const newOrder = currentOrder.filter(id => id !== selectionElementId);
          handleUpdateElementOrder(selectedStep.id, newOrder);
          setSelection({ type: 'step', id: selectedStep.id });
        }
      }

      // Ctrl+D or Cmd+D - duplicate element
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectionElementId) {
        e.preventDefault();
        const index = currentOrder.indexOf(selectionElementId);
        if (index !== -1) {
          const newElementId = `${selectionElementId}_copy_${crypto.randomUUID()}`;
          const newOrder = [...currentOrder];
          newOrder.splice(index + 1, 0, newElementId);
          
          // Copy dynamic content if exists
          const currentDynamic = dynamicElements[selectedStep.id]?.[selectionElementId];
          if (currentDynamic) {
            replaceDynamicElement(selectedStep.id, newElementId, { ...currentDynamic });
          }
          
          handleUpdateElementOrder(selectedStep.id, newOrder);
          setSelection({ type: 'element', id: buildSelectionId(selectedStep.id, newElementId) });
        }
      }

      // Escape - deselect element
      if (e.key === 'Escape') {
        setSelection({ type: 'step', id: selectedStep.id });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionElementId, selectedStep, elementOrders, dynamicElements, handleUpdateElementOrder, replaceDynamicElement]);

  if (isFunnelError) {
=======
  if (!funnelQuery.data.builderDocument) {
>>>>>>> a5ffa62 (Stabilize funnel builder layout and editor rendering)
    return (
      <BuilderEmptyState teamId={teamId} funnelId={funnelId} hasLegacySteps={funnelQuery.data.hasLegacySteps} />
    );
  }

  if (!editorKey) {
    return <FullscreenMessage message="Preparing Builder V2…" />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <EditorProvider key={editorKey}>
        <BuilderCommandBar
          funnelId={funnelId}
          teamId={teamId}
          funnelName={funnelQuery.data.funnel.name}
          legacyPayload={legacyPayload}
          onLegacyPayloadUpdate={setLegacyPayload}
          publishedSnapshot={publishedSnapshot}
          onPublished={setPublishedSnapshot}
          lastSavedAt={lastSavedAt}
          onSaved={(timestamp) => setLastSavedAt(timestamp)}
        />
        <div className="flex-1 overflow-hidden">
          <EditorShell />
        </div>
      </EditorProvider>
    </div>
  );
}

type BuilderCommandBarProps = {
  funnelId: string;
  teamId: string;
  funnelName: string;
  legacyPayload: LegacySnapshotPayload | null;
  onLegacyPayloadUpdate: (payload: LegacySnapshotPayload | null) => void;
  publishedSnapshot: PublishedDocumentSnapshot | null;
  onPublished: (snapshot: PublishedDocumentSnapshot) => void;
  lastSavedAt: Date | null;
  onSaved: (timestamp: Date) => void;
};

function BuilderCommandBar({
  funnelId,
  teamId,
  funnelName,
  legacyPayload,
  onLegacyPayloadUpdate,
  publishedSnapshot,
  onPublished,
  lastSavedAt,
  onSaved,
}: BuilderCommandBarProps) {
  const { pages, activePageId } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const runtimeStatus = useMemo(() => {
    if (!publishedSnapshot) {
      return 'Draft';
    }
    return `Published • ${new Date(publishedSnapshot.publishedAt).toLocaleString()}`;
  }, [publishedSnapshot]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const doc = extractDocument(pages, activePageId);
      const { error } = await supabase
        .from('funnels')
        .update({ builder_document: doc, updated_at: new Date().toISOString() })
        .eq('id', funnelId);

      if (error) {
        throw error;
      }
      const timestamp = new Date();
      onSaved(timestamp);
      toast({ title: 'Draft saved' });
    } catch (error) {
      console.error('[Builder] Save failed', error);
      toast({ title: 'Save failed', description: 'Unable to persist builder document', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const doc = extractDocument(pages, activePageId);
      const docLegacy = deriveLegacyPayloadFromDocument(doc) ?? legacyPayload;

      if (!docLegacy) {
        throw new Error('Add a legacy funnel block before publishing.');
      }

      const snapshot = createPublishedSnapshot(doc.pages, doc.activePageId, { legacy: docLegacy });

      const { error } = await supabase
        .from('funnels')
        .update({
          builder_document: doc,
          published_document_snapshot: snapshot,
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', funnelId);

      if (error) {
        throw error;
      }

      const timestamp = new Date();
      onSaved(timestamp);
      toast({ title: 'Published', description: 'Runtime snapshot updated successfully.' });
      onLegacyPayloadUpdate(docLegacy);
      onPublished(snapshot);
    } catch (error) {
      console.error('[Builder] Publish failed', error);
      toast({ title: 'Publish failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-semibold">{funnelName}</span>
        <span className="text-xs text-muted-foreground">{runtimeStatus}</span>
        {lastSavedAt && (
          <span className="text-xs text-muted-foreground">Draft saved {lastSavedAt.toLocaleTimeString()}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/team/${teamId}/funnels/${funnelId}/legacy`}>Legacy view</Link>
        </Button>
        <Button onClick={handleSave} size="sm" disabled={isSaving || isPublishing}>
          {isSaving ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button onClick={handlePublish} size="sm" disabled={isPublishing || isSaving}>
          {isPublishing ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </header>
  );
}
