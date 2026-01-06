import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StepContentEditor } from './StepContentEditor';
import { DesignEditor } from './DesignEditor';
import { SettingsEditor } from './SettingsEditor';
import { ContentBlockEditor, ContentBlock } from './ContentBlockEditor';
import { ImagePicker } from './ImagePicker';
import { Funnel, FunnelStep } from '@/pages/FunnelEditor';
import { LayoutGrid, Settings as SettingsIcon, Wand2, Palette } from 'lucide-react';
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
  const stepIntent: StepIntent | null = useMemo(() => {
    if (!step) return null;
    return (step.content.intent as StepIntent) || getStepIntent(step);
  }, [step]);
  const stepDefinition = step ? getStepDefinition(step.step_type) : null;
  const intentSections = useMemo(() => {
    if (!stepIntent) {
      return { structure: false, behavior: false };
    }
    if (stepIntent === 'capture' || stepIntent === 'schedule') {
      return { structure: false, behavior: true };
    }
    return { structure: true, behavior: false };
  }, [stepIntent]);
  const showStructure = selection.type !== 'funnel' && selection.type !== 'element' && intentSections.structure;
  const showBehavior = selection.type === 'step' && intentSections.behavior;
  const showContent = selection.type !== 'funnel' && !!step;
  const showDesign = selection.type !== 'funnel' && !!step;
  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) || null,
    [blocks, selectedBlockId]
  );
  const blockLabel = selectedBlock ? `${selectedBlock.type.charAt(0).toUpperCase()}${selectedBlock.type.slice(1)}` : 'Block';
  const elementLabel = useMemo(() => {
    if (!selectedElement) return 'Element';
    if (selectedElement === 'headline') return 'Headline';
    if (selectedElement === 'subtext') return 'Subtext';
    if (selectedElement === 'button') return 'Button';
    if (selectedElement === 'input') return 'Input Field';
    if (selectedElement === 'options') return 'Options';
    if (selectedElement === 'video') return 'Video';
    if (selectedElement === 'opt_in_form') return 'Contact Form';
    if (selectedElement.startsWith('text_')) return 'Text Block';
    if (selectedElement.startsWith('headline_')) return 'Headline';
    if (selectedElement.startsWith('video_')) return 'Video';
    if (selectedElement.startsWith('image_')) return 'Image';
    if (selectedElement.startsWith('button_')) return 'Button';
    if (selectedElement.startsWith('divider_')) return 'Divider';
    if (selectedElement.startsWith('embed_')) return 'Embed';
    return 'Element';
  }, [selectedElement]);
  const inspectorHeader = useMemo(() => {
    if (selection.type === 'funnel') return 'Editing Funnel';
    if (selection.type === 'step') return 'Editing Step';
    if (selection.type === 'block') return `Editing ${blockLabel}`;
    return `Editing ${elementLabel}`;
  }, [blockLabel, elementLabel, selection.type]);
  const stepName = step?.content.headline || (step ? getStepTypeLabel(step.step_type) : '');

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-2 pb-3 border-b">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Inspector</p>
          <h2 className="text-sm font-semibold text-foreground">
            {inspectorHeader}
          </h2>
          {stepName ? (
            <p className="text-xs text-muted-foreground mt-1">
              {stepName}
            </p>
          ) : null}
          {stepIntent && stepDefinition && selection.type !== 'funnel' && (
            <p className="text-xs text-muted-foreground mt-1">
              Intent: <span className="capitalize text-foreground">{stepIntent}</span> · {stepDefinition.description}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-2 pt-4">
          {selection.type === 'funnel' && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                Funnel
              </div>
              <div className="space-y-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                <p>Choose a step to edit its structure, content, or style.</p>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={onOpenFunnelSettings} disabled={!onOpenFunnelSettings}>
                    Open Funnel Settings
                  </Button>
                  <div className="text-[11px] text-muted-foreground">
                    {funnel ? `${funnel.name} · ${funnel.status}` : 'No funnel loaded'}
                  </div>
                </div>
              </div>
            </section>
          )}

          {showStructure && step && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                Structure
              </div>
              <ContentBlockEditor
                blocks={blocks}
                onBlocksChange={onUpdateBlocks || (() => {})}
                selectedBlockId={selectedBlockId}
                onSelectBlock={onSelectBlock}
              />
            </section>
          )}

          {showContent && step && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5" />
                Content
              </div>
              <StepContentEditor
                step={step}
                onUpdate={onUpdateContent}
                selectedElement={selectedElement}
                elementOrder={elementOrder}
                dynamicContent={dynamicContent}
                onUpdateDynamicContent={onUpdateDynamicContent}
              />
            </section>
          )}

          {showDesign && step && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Style
              </div>
              <DesignEditor
                step={step}
                design={design}
                onUpdateDesign={onUpdateDesign}
                onOpenImagePicker={() => setShowImagePicker(true)}
                highlightedSection={selectedElement}
              />
            </section>
          )}

          {showBehavior && step && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SettingsIcon className="h-3.5 w-3.5" />
                Behavior
              </div>
              <SettingsEditor
                step={step}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />
            </section>
          )}
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
