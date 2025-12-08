import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepContentEditor } from './StepContentEditor';
import { DesignEditor } from './DesignEditor';
import { SettingsEditor } from './SettingsEditor';
import { ContentBlockEditor, ContentBlock } from './ContentBlockEditor';
import { ImagePicker } from './ImagePicker';
import { FunnelStep } from '@/pages/FunnelEditor';
import { Type, Palette, Settings, LayoutGrid } from 'lucide-react';

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
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState('content');
  const [showImagePicker, setShowImagePicker] = useState(false);

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4 mb-4 flex-shrink-0">
          <TabsTrigger value="content" className="gap-1.5 text-xs">
            <Type className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="blocks" className="gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Blocks</span>
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-1.5 text-xs">
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Design</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
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

          <TabsContent value="design" className="mt-0 h-full">
            <DesignEditor
              step={step}
              design={design}
              onUpdateDesign={onUpdateDesign}
              onOpenImagePicker={() => setShowImagePicker(true)}
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
