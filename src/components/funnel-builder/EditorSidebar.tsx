// @ts-nocheck - Legacy funnel builder types need refactoring
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { StepContentEditor } from './StepContentEditor';
import { DesignEditor } from './DesignEditor';
import { SettingsEditor } from './SettingsEditor';
import { ContentBlockEditor, ContentBlock } from './ContentBlockEditor';
import { ImagePicker } from './ImagePicker';
import type { Funnel, FunnelStep } from '@/lib/funnel/editorTypes';
import { ChevronDown, LayoutGrid, Settings as SettingsIcon, Wand2, Palette } from 'lucide-react';
import { getStepDefinition, getStepTypeLabel } from '@/lib/funnel/stepDefinitions';
import getStepIntent from '@/lib/funnels/stepIntent';
import type { StepIntent } from '@/lib/funnel/types';
import type { EditorSelection } from './editorSelection';
import { getSelectionChildId, getSelectionStepId } from './editorSelection';

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
  const selectionStepId = getSelectionStepId(selection);
  const selectedElementId = selection.type === 'element' && selectionStepId === step?.id
    ? getSelectionChildId(selection)
    : null;
  const selectedBlockId = selection.type === 'block' && selectionStepId === step?.id
    ? getSelectionChildId(selection)
    : null;
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
  const showContent = selection.type !== 'funnel' && selection.type !== 'block' && !!step;
  const showDesign = selection.type !== 'funnel' && selection.type !== 'block' && !!step;
  const availableSections = useMemo(() => {
    const sections: string[] = [];
    if (selection.type === 'funnel') {
      sections.push('content');
      return sections;
    }
    if (showStructure) sections.push('structure');
    if (showContent) sections.push('content');
    if (showDesign) sections.push('style');
    if (showBehavior) sections.push('behavior');
    return sections;
  }, [selection.type, showBehavior, showContent, showDesign, showStructure]);
  const [openSections, setOpenSections] = useState<string[]>([]);
  useEffect(() => {
    setOpenSections((prev) => {
      const next = prev.filter((section) => availableSections.includes(section));
      return next.length > 0 ? next : availableSections;
    });
  }, [availableSections]);
  const hasSections = availableSections.length > 0;
  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) || null,
    [blocks, selectedBlockId]
  );
  const blockLabel = selectedBlock ? `${selectedBlock.type.charAt(0).toUpperCase()}${selectedBlock.type.slice(1)}` : 'Block';
  const elementLabel = useMemo(() => {
    if (!selectedElementId) return 'Element';
    if (selectedElementId === 'headline') return 'Headline';
    if (selectedElementId === 'subtext') return 'Subtext';
    if (selectedElementId === 'button') return 'Button';
    if (selectedElementId === 'input') return 'Input Field';
    if (selectedElementId === 'options') return 'Options';
    if (selectedElementId === 'video') return 'Video';
    if (selectedElementId === 'opt_in_form') return 'Contact Form';
    if (selectedElementId.startsWith('text_')) return 'Text Block';
    if (selectedElementId.startsWith('headline_')) return 'Headline';
    if (selectedElementId.startsWith('video_')) return 'Video';
    if (selectedElementId.startsWith('image_')) return 'Image';
    if (selectedElementId.startsWith('button_')) return 'Button';
    if (selectedElementId.startsWith('divider_')) return 'Divider';
    if (selectedElementId.startsWith('embed_')) return 'Embed';
    return 'Element';
  }, [selectedElementId]);
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

        <div className="flex-1 overflow-y-auto px-2 pt-4">
          {hasSections ? (
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="space-y-3"
            >
            {selection.type === 'funnel' && (
              <AccordionItem value="content" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline hover:bg-muted/40 active:bg-muted/60 rounded-md">
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Content
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
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
                </AccordionContent>
              </AccordionItem>
            )}

            {showStructure && step && (
              <AccordionItem value="structure" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline hover:bg-muted/40 active:bg-muted/60 rounded-md">
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Structure
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <ContentBlockEditor
                    blocks={blocks}
                    onBlocksChange={onUpdateBlocks || (() => {})}
                    selection={selection}
                    stepId={step?.id}
                    onSelectBlock={onSelectBlock}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {showContent && step && (
              <AccordionItem value="content" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline hover:bg-muted/40 active:bg-muted/60 rounded-md">
                  <span className="flex items-center gap-2">
                    <Wand2 className="h-3.5 w-3.5" />
                    Content
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <StepContentEditor
                    step={step}
                    onUpdate={onUpdateContent}
                    selection={selection}
                    elementOrder={elementOrder}
                    dynamicContent={dynamicContent}
                    onUpdateDynamicContent={onUpdateDynamicContent}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {showDesign && step && (
              <AccordionItem value="style" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline hover:bg-muted/40 active:bg-muted/60 rounded-md">
                  <span className="flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5" />
                    Style
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <DesignEditor
                    step={step}
                    design={design}
                    onUpdateDesign={onUpdateDesign}
                    onOpenImagePicker={() => setShowImagePicker(true)}
                    highlightedSection={selectedElementId}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {showBehavior && step && (
              <AccordionItem value="behavior" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline hover:bg-muted/40 active:bg-muted/60 rounded-md">
                  <span className="flex items-center gap-2">
                    <SettingsIcon className="h-3.5 w-3.5" />
                    Behavior
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <SettingsEditor
                    step={step}
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
            </Accordion>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Select a step or element to start editing.
            </div>
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
