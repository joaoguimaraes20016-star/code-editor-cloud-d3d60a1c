import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Eye, Save, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StepTypePalette } from '@/components/funnel-builder/StepTypePalette';
import { SortableStepList } from '@/components/funnel-builder/SortableStepList';
import { StepContentEditor } from '@/components/funnel-builder/StepContentEditor';
import { FunnelSettingsDialog } from '@/components/funnel-builder/FunnelSettingsDialog';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

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

export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      // Update funnel name
      const { error: funnelError } = await supabase
        .from('funnels')
        .update({ name })
        .eq('id', funnelId);

      if (funnelError) throw funnelError;

      // Delete existing steps and re-insert
      const { error: deleteError } = await supabase
        .from('funnel_steps')
        .delete()
        .eq('funnel_id', funnelId);

      if (deleteError) throw deleteError;

      // Insert updated steps with correct order
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
      // Save first
      await saveMutation.mutateAsync();

      // Then publish
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

    // Insert before thank_you step if it exists
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
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/team/${teamId}/funnels`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="w-64 font-semibold"
            />

            <Badge variant={funnel.status === 'published' ? 'default' : 'secondary'}>
              {funnel.status}
            </Badge>

            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>

            {funnel.status === 'published' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/f/${funnel.slug}`, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>

            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <Globe className="h-4 w-4 mr-2" />
              {funnel.status === 'published' ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Step Palette */}
        <div className="w-64 border-r bg-card p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wide">
            Add Step
          </h3>
          <StepTypePalette onAddStep={handleAddStep} />
        </div>

        {/* Center - Step List */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-xl mx-auto">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableStepList
                steps={steps}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                onDeleteStep={handleDeleteStep}
              />
            </DndContext>
          </div>
        </div>

        {/* Right Sidebar - Step Editor */}
        <div className="w-80 border-l bg-card p-4 overflow-y-auto">
          {selectedStep ? (
            <StepContentEditor
              step={selectedStep}
              onUpdate={(content) => handleUpdateStep(selectedStep.id, content)}
            />
          ) : (
            <div className="text-muted-foreground text-center py-8">
              Select a step to edit its content
            </div>
          )}
        </div>
      </div>

      <FunnelSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        funnel={funnel}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] });
        }}
      />
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
