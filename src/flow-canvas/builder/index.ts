// InfoStack Builder Module
// A modular, importable Funnel & Website Builder

// Main Editor Component
export { EditorShell } from './components/EditorShell';

// Individual Components (for custom integrations)
export { LeftPanel } from './components/LeftPanel';
export { RightPanel } from './components/RightPanel';
export { TopToolbar } from './components/TopToolbar';
export { CanvasRenderer } from './components/CanvasRenderer';
export { AIBuilderCopilot } from './components/AIBuilderCopilot';
export { BlockPalette } from './components/BlockPalette';
export { AddSectionPopover } from './components/AddSectionPopover';
export { BlockActionBar } from './components/BlockActionBar';
export { InlineTextEditor } from './components/InlineTextEditor';
export { RichTextToolbar } from './components/RichTextToolbar';

// Hooks
export { useHistory } from './hooks/useHistory';

// Utilities
export * from './utils/helpers';

// Types (re-exported from types folder)
export type {
  Page,
  Step,
  Frame,
  Stack,
  Block,
  Element,
  SelectionState,
  BuilderProps,
  StepIntent,
  StepType,
  SubmitMode,
  ElementType,
  BlockType,
  AIsuggestion,
  AICopilotProps,
  TextStyles,
  BlockAction,
} from '../types/infostack';

// Re-export sample page creator
export { createSamplePage } from './utils/helpers';

// Device mode type
export type { DeviceMode } from './components/TopToolbar';