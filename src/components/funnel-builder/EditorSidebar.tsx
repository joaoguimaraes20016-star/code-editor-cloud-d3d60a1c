import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StepContentEditor } from './StepContentEditor';
import { DesignEditor } from './DesignEditor';
import { SettingsEditor } from './SettingsEditor';
import { ContentBlockEditor, ContentBlock } from './ContentBlockEditor';
import { ImagePicker } from './ImagePicker';
import { Funnel, FunnelStep } from '@/pages/FunnelEditor';
import { LayoutGrid, Settings as SettingsIcon, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStepDefinition, getStepTypeLabel } from '@/lib/funnel/stepDefinitions';
import getStepIntent from '@/lib/funnels/stepIntent';
import type { StepIntent } from '@/lib/funnel/types';
import type { EditorSelection } from './editorSelection';

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
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  animationDuration?: number;
  animationEasing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

interface EditorSidebarProps {
  selection: EditorSelection;
  funnel?: Funnel | null;
  step?: FunnelStep | null;
  selectedElement: string | null;
  selectedBlockId?: string | null;
  onUpdateContent: (patch: Partial<FunnelStep['content']>) => void;
  onUpdateDesign: (design: StepDesign) => void;
  onUpdateSettings: (settings: StepSettings) => void;
  onUpdateBlocks?: (blocks: ContentBlock[]) => void;
  onSelectBlock?: (blockId: string) => void;
  onOpenFunnelSettings?: () => void;
  design: StepDesign;
  settings: StepSettings;
  blocks?: ContentBlock[];
  elementOrder?: string[];
  dynamicContent?: Record<string, any>;
  onUpdateDynamicContent?: (elementId: string, value: any) => void;
}

export function EditorSidebar({
  selection,
  funnel,
  step,
  selectedElement,
  selectedBlockId,
  onUpdateContent,
  onUpdateDesign,
  onUpdateSettings,
  onUpdateBlocks,
  onSelectBlock,
  onOpenFunnelSettings,
  design,
  settings,
  blocks = [],
  elementOrder = [],
  dynamicContent = {},
  onUpdateDynamicContent,
}: EditorSidebarProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const isStepContext = selection.type === 'step' || selection.type === 'element' || selection.type === 'block';
  const stepIntent: StepIntent | null = useMemo(() => {
    if (!step) return null;
    return (step.content.intent as StepIntent) || getStepIntent(step);
  }, [step]);
  const stepDefinition = step ? getStepDefinition(step.step_type) : null;
  const showStructure = selection.type !== 'element';
  const showBehavior = selection.type === 'step';
  const showContent = isStepContext;
  const showDesign = isStepContext;
  const selectionLabel = useMemo(() => {
    if (selection.type === 'funnel') return 'Funnel';
    if (selection.type === 'step') return 'Step';
    if (selection.type === 'block') return 'Block';
    return 'Element';
  }, [selection.type]);

  const inspectorHeader = step
    ? `${selectionLabel}: ${step.content.headline || getStepTypeLabel(step.step_type)}`
    : selectionLabel;

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-2 pb-3 border-b">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Inspector
          </p>
          <h2 className="text-sm font-semibold text-foreground">
            {inspectorHeader}
          </h2>
          {stepIntent && stepDefinition && (
            <p className="text-xs text-muted-foreground mt-1">
              Intent: <span className="capitalize text-foreground">{stepIntent}</span> · {stepDefinition.description}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-2 pt-4">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              Structure
            </div>
            {selection.type === 'funnel' && (
              <div className="space-y-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                <p>Choose a step to edit its structure, or open funnel settings for global configuration.</p>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={onOpenFunnelSettings} disabled={!onOpenFunnelSettings}>
                    Open Funnel Settings
                  </Button>
                  <div className="text-[11px] text-muted-foreground">
                    {funnel ? `${funnel.name} · ${funnel.status}` : 'No funnel loaded'}
                  </div>
                </div>
              </div>
            )}
            {showStructure && step && (
              <ContentBlockEditor
                blocks={blocks}
                onBlocksChange={onUpdateBlocks || (() => {})}
                selectedBlockId={selectedBlockId}
                onSelectBlock={onSelectBlock}
              />
            )}
          </section>

          <section className={cn("space-y-3", !showContent && "opacity-60")}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" />
              Content
            </div>
            {showContent && step ? (
              <StepContentEditor
                step={step}
                onUpdate={onUpdateContent}
                selectedElement={selectedElement}
                elementOrder={elementOrder}
                dynamicContent={dynamicContent}
                onUpdateDynamicContent={onUpdateDynamicContent}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Select a step or element to edit content.
              </div>
            )}
          </section>

          <section className={cn("space-y-3", !showDesign && "opacity-60")}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              Design
            </div>
            {showDesign && step ? (
              <DesignEditor
                step={step}
                design={design}
                onUpdateDesign={onUpdateDesign}
                onOpenImagePicker={() => setShowImagePicker(true)}
                highlightedSection={selectedElement}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Select a step or element to edit design.
              </div>
            )}
          </section>

          <section className={cn("space-y-3", !showBehavior && "opacity-60")}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SettingsIcon className="h-3.5 w-3.5" />
              Behavior
            </div>
            {showBehavior && step ? (
              <SettingsEditor
                step={step}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Behavior controls are available when a step is selected.
              </div>
            )}
          </section>
        </div>
      </div>

      <ImagePicker
        open={showImagePicker}
        onOpenChange={setShowImagePicker}
        onSelect={(url) => {
          onUpdateDesign({ ...design, imageUrl: url });
        }}
        aspectRatio={design.imageSize}
      />
    </>
  );
}
