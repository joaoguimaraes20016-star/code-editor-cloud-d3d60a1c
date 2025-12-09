import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepContentEditor } from './StepContentEditor';
import { DesignEditor } from './DesignEditor';
import { SettingsEditor } from './SettingsEditor';
import { ContentBlockEditor, ContentBlock } from './ContentBlockEditor';
import { ImagePicker } from './ImagePicker';
import { FunnelStep } from '@/pages/FunnelEditor';
import { Type, Palette, Settings, LayoutGrid, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Map element types to their editing tab and section
const ELEMENT_TO_TAB_MAP: Record<string, { tab: string; section?: string }> = {
  headline: { tab: 'content', section: 'headline' },
  subtext: { tab: 'content', section: 'subtext' },
  button: { tab: 'design', section: 'button-styling' },
  button_text: { tab: 'content', section: 'button' },
  input: { tab: 'design', section: 'input-styling' },
  placeholder: { tab: 'content', section: 'placeholder' },
  options: { tab: 'design', section: 'option-cards' },
  video: { tab: 'content', section: 'video' },
  image_top: { tab: 'design', section: 'image' },
  background: { tab: 'design', section: 'background' },
};

// Get tab indicator for element
const getSelectedElementTab = (element: string | null): string | null => {
  if (!element) return null;
  
  // Check for dynamic elements
  if (element.startsWith('text_') || element.startsWith('headline_')) return 'content';
  if (element.startsWith('video_') || element.startsWith('image_')) return 'content';
  if (element.startsWith('button_') || element.startsWith('divider_')) return 'content';
  
  const mapping = ELEMENT_TO_TAB_MAP[element];
  return mapping?.tab || null;
};

interface EditorSidebarProps {
  step: FunnelStep;
  selectedElement: string | null;
  onUpdateContent: (content: FunnelStep['content']) => void;
  onUpdateDesign: (design: StepDesign) => void;
  onUpdateSettings: (settings: StepSettings) => void;
  onUpdateBlocks?: (blocks: ContentBlock[]) => void;
  design: StepDesign;
  settings: StepSettings;
  blocks?: ContentBlock[];
  elementOrder?: string[];
  dynamicContent?: Record<string, any>;
  onUpdateDynamicContent?: (elementId: string, value: any) => void;
  highlightedSection?: string | null;
}

export function EditorSidebar({
  step,
  selectedElement,
  onUpdateContent,
  onUpdateDesign,
  onUpdateSettings,
  onUpdateBlocks,
  design,
  settings,
  blocks = [],
  elementOrder = [],
  dynamicContent = {},
  onUpdateDynamicContent,
  highlightedSection,
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState('design'); // Design first
  const [showImagePicker, setShowImagePicker] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);

  // Get which tab has the selected element
  const selectedElementTab = getSelectedElementTab(selectedElement);

  // Auto-switch to correct tab and scroll to section when element is selected
  useEffect(() => {
    if (!selectedElement) return;

    // Check if it's a dynamic element
    if (selectedElement.startsWith('text_') || 
        selectedElement.startsWith('headline_') || 
        selectedElement.startsWith('video_') || 
        selectedElement.startsWith('image_') || 
        selectedElement.startsWith('button_') || 
        selectedElement.startsWith('divider_')) {
      setActiveTab('content');
      setTimeout(() => {
        const dynamicSection = document.getElementById('dynamic-elements-section');
        dynamicSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }

    const mapping = ELEMENT_TO_TAB_MAP[selectedElement];
    if (mapping) {
      setActiveTab(mapping.tab);
      if (mapping.section) {
        setTimeout(() => {
          const section = document.getElementById(`editor-section-${mapping.section}`);
          section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [selectedElement]);

  // Also respond to highlightedSection prop
  useEffect(() => {
    if (!highlightedSection) return;
    
    const mapping = ELEMENT_TO_TAB_MAP[highlightedSection];
    if (mapping) {
      setActiveTab(mapping.tab);
      if (mapping.section) {
        setTimeout(() => {
          const section = document.getElementById(`editor-section-${mapping.section}`);
          section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [highlightedSection]);

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Reordered: Design, Content, Blocks, Settings */}
        <TabsList className="grid w-full grid-cols-4 mb-4 flex-shrink-0">
          <TabsTrigger value="design" className="gap-1.5 text-xs relative">
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Design</span>
            {selectedElementTab === 'design' && (
              <Circle className="h-2 w-2 fill-primary text-primary absolute -top-0.5 -right-0.5" />
            )}
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5 text-xs relative">
            <Type className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Content</span>
            {selectedElementTab === 'content' && (
              <Circle className="h-2 w-2 fill-primary text-primary absolute -top-0.5 -right-0.5" />
            )}
          </TabsTrigger>
          <TabsTrigger value="blocks" className="gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Blocks</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          <TabsContent value="design" className="mt-0 h-full" ref={designRef}>
            <DesignEditor
              step={step}
              design={design}
              onUpdateDesign={onUpdateDesign}
              onOpenImagePicker={() => setShowImagePicker(true)}
              highlightedSection={selectedElement}
            />
          </TabsContent>

          <TabsContent value="content" className="mt-0 h-full">
            <StepContentEditor
              step={step}
              onUpdate={onUpdateContent}
              selectedElement={selectedElement}
              elementOrder={elementOrder}
              dynamicContent={dynamicContent}
              onUpdateDynamicContent={onUpdateDynamicContent}
            />
          </TabsContent>

          <TabsContent value="blocks" className="mt-0 h-full">
            <ContentBlockEditor
              blocks={blocks}
              onBlocksChange={onUpdateBlocks || (() => {})}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 h-full">
            <SettingsEditor
              step={step}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          </TabsContent>
        </div>
      </Tabs>

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