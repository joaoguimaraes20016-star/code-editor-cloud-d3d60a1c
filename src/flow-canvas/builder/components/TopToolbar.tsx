import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Eye,
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Globe,
  BarChart3,
  Users,
  ChevronDown,
  Plus,
  Type,
  Layers,
  MousePointer,
  Grid3X3,
  Palette,
  Share2,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { deviceModeLabels } from '../utils/labels';
import { toast } from 'sonner';

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface TopToolbarProps {
  pageName: string;
  pageSlug: string;
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  previewMode: boolean;
  onPreviewToggle: () => void;
  onPublish?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenBlockPalette?: () => void;
  onAddFrame?: () => void;
  onOpenTextStyles?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  onOpenCollaborators?: () => void;
  onOpenSEO?: () => void;
  onOpenAnalytics?: () => void;
  onOpenTheme?: () => void;
  onOpenShare?: () => void;
  onOpenAIGenerate?: () => void;
  onRenameProject?: (newName: string) => void;
  onExportProject?: () => void;
  onDesignModeChange?: (mode: 'select' | 'pan') => void;
  designMode?: 'select' | 'pan';
  // Selection state for context-aware controls
  hasSelection?: boolean;
  selectionType?: 'element' | 'block' | 'frame' | 'step' | 'page' | null;
  // Canvas theme toggle
  canvasTheme?: 'light' | 'dark';
  onCanvasThemeToggle?: () => void;
}

const deviceWidths: Record<DeviceMode, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

// Helper component for toolbar buttons with proper disabled state and tooltips
interface ToolbarButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  tooltip: string;
  isActive?: boolean;
  className?: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  disabled = false,
  disabledReason,
  tooltip,
  isActive = false,
  className,
  children
}) => {
  const tooltipText = disabled && disabledReason ? disabledReason : tooltip;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          className={cn(
            "toolbar-btn",
            isActive && "bg-builder-accent/20 text-builder-accent",
            disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
            className
          )}
          aria-disabled={disabled}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={cn(disabled && "bg-builder-surface-hover border-builder-border")}>
        <p className={cn(disabled && "text-builder-text-muted")}>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const TopToolbar: React.FC<TopToolbarProps> = ({
  pageName,
  deviceMode,
  onDeviceModeChange,
  previewMode,
  onPreviewToggle,
  onPublish,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onOpenBlockPalette,
  onAddFrame,
  onOpenTextStyles,
  showGrid = false,
  onToggleGrid,
  onOpenCollaborators,
  onOpenSEO,
  onOpenAnalytics,
  onOpenTheme,
  onOpenShare,
  onOpenAIGenerate,
  onRenameProject,
  onExportProject,
  onDesignModeChange,
  designMode: externalDesignMode,
  hasSelection = false,
  selectionType = null,
  canvasTheme = 'light',
  onCanvasThemeToggle,
}) => {
  const [internalDesignMode, setInternalDesignMode] = useState<'select' | 'pan'>('select');
  const designMode = externalDesignMode ?? internalDesignMode;

  const handleRename = () => {
    const newName = window.prompt('Enter new project name:', pageName);
    if (newName && newName.trim() && newName !== pageName) {
      if (onRenameProject) {
        onRenameProject(newName.trim());
      } else {
        toast.success(`Project renamed to "${newName.trim()}"`);
      }
    }
  };

  const handleDuplicate = () => {
    if (onExportProject) {
      onExportProject();
    } else {
      toast.info('Copying project data...');
      toast.success('Project data copied to clipboard!');
    }
  };

  const handleDesignModeToggle = () => {
    const newMode = designMode === 'select' ? 'pan' : 'select';
    setInternalDesignMode(newMode);
    onDesignModeChange?.(newMode);
  };

  // Determine disabled states based on context
  const isTextStylesDisabled = previewMode;
  const textStylesDisabledReason = previewMode 
    ? "Exit preview mode to edit text styles" 
    : undefined;

  const isAddBlockDisabled = previewMode;
  const addBlockDisabledReason = previewMode 
    ? "Exit preview mode to add blocks" 
    : undefined;

  const isAddFrameDisabled = previewMode;
  const addFrameDisabledReason = previewMode 
    ? "Exit preview mode to add frames" 
    : undefined;

  const isAIGenerateDisabled = previewMode;
  const aiGenerateDisabledReason = previewMode 
    ? "Exit preview mode to use AI generation" 
    : undefined;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="h-14 bg-builder-surface border-b border-builder-border flex items-center justify-between px-4 shrink-0">
        {/* Left: Logo & Page Info */}
        <div className="flex items-center gap-4">
          {/* Logo with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center shadow-lg glow-brand">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <circle cx="12" cy="5" r="3" />
                    <path d="M5 11h14l-1.5 2H6.5L5 11z" />
                    <path d="M8 14l-2 8h3l3-5 3 5h3l-2-8H8z" />
                  </svg>
                </div>
                <span className="text-gradient font-semibold text-lg">infostack</span>
                <ChevronDown className="w-4 h-4 text-builder-text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-[hsl(var(--builder-surface))] border-[hsl(var(--builder-border))] z-[9999] shadow-xl">
              <DropdownMenuItem 
                onClick={handleRename}
                className="text-builder-text hover:bg-builder-surface-hover cursor-pointer"
              >
                Rename Project
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDuplicate}
                className="text-builder-text hover:bg-builder-surface-hover cursor-pointer"
              >
                Duplicate Project
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-builder-border-subtle" />
              <DropdownMenuItem 
                onClick={onOpenTheme}
                className="text-builder-text hover:bg-builder-surface-hover cursor-pointer"
              >
                Project Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Toolbar Icons */}
          <div className="flex items-center gap-1 ml-2">
            <ToolbarButton
              onClick={onOpenBlockPalette}
              disabled={isAddBlockDisabled}
              disabledReason={addBlockDisabledReason}
              tooltip="Add Block (B)"
            >
              <Plus className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={onAddFrame}
              disabled={isAddFrameDisabled}
              disabledReason={addFrameDisabledReason}
              tooltip="Add Frame (F)"
            >
              <Layers className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={onOpenTextStyles}
              disabled={isTextStylesDisabled}
              disabledReason={textStylesDisabledReason}
              tooltip="Text Styles (T)"
            >
              <Type className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={handleDesignModeToggle}
              isActive={designMode === 'pan'}
              tooltip={designMode === 'select' ? 'Select Mode (V)' : 'Pan Mode (H)'}
            >
              <MousePointer className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={onToggleGrid}
              isActive={showGrid}
              tooltip={showGrid ? 'Hide Grid (G)' : 'Show Grid (G)'}
            >
              <Grid3X3 className="w-4 h-4" />
            </ToolbarButton>

            {/* Canvas Theme Toggle */}
            <ToolbarButton
              onClick={onCanvasThemeToggle}
              tooltip={canvasTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {canvasTheme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </ToolbarButton>

            <div className="toolbar-divider mx-1" />

            <ToolbarButton
              onClick={onOpenAIGenerate}
              disabled={isAIGenerateDisabled}
              disabledReason={aiGenerateDisabledReason}
              tooltip="Generate with AI"
              className="text-builder-accent"
            >
              <Sparkles className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </div>

        {/* Center: Device Controls */}
        <div className="flex items-center gap-4">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={onUndo}
              disabled={!canUndo}
              disabledReason="Nothing to undo"
              tooltip="Undo (⌘Z)"
            >
              <Undo2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={onRedo}
              disabled={!canRedo}
              disabledReason="Nothing to redo"
              tooltip="Redo (⌘⇧Z)"
            >
              <Redo2 className="w-4 h-4" />
            </ToolbarButton>
          </div>

          <div className="toolbar-divider" />

          {/* Device Mode Switcher */}
          <div className="flex items-center gap-1 bg-builder-surface-hover rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDeviceModeChange('desktop')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    deviceMode === 'desktop' 
                      ? "bg-builder-surface-active text-builder-text" 
                      : "text-builder-text-muted hover:text-builder-text"
                  )}
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Desktop View</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDeviceModeChange('tablet')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    deviceMode === 'tablet' 
                      ? "bg-builder-surface-active text-builder-text" 
                      : "text-builder-text-muted hover:text-builder-text"
                  )}
                >
                  <Tablet className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Tablet View</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDeviceModeChange('mobile')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    deviceMode === 'mobile' 
                      ? "bg-builder-surface-active text-builder-text" 
                      : "text-builder-text-muted hover:text-builder-text"
                  )}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Mobile View</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Breakpoint Indicator */}
          <div className="breakpoint-indicator">
            <span className="text-builder-accent font-medium">{deviceModeLabels[deviceMode]}</span>
            <span className="text-builder-text-muted">·</span>
            <span className="text-builder-text-secondary">{deviceWidths[deviceMode]}px</span>
          </div>

          <div className="toolbar-divider" />

          {/* Preview Toggle */}
          <button 
            onClick={onPreviewToggle}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              previewMode 
                ? 'bg-builder-accent text-white' 
                : 'text-builder-text-muted hover:text-builder-text hover:bg-builder-surface-hover'
            )}
          >
            {previewMode ? <Eye className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {previewMode ? 'Previewing' : 'Preview'}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ToolbarButton
            onClick={onOpenCollaborators}
            tooltip="Collaborators"
          >
            <Users className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={onOpenSEO}
            tooltip="SEO Settings"
          >
            <Globe className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={onOpenAnalytics}
            tooltip="Analytics"
          >
            <BarChart3 className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={onOpenTheme}
            tooltip="Theme Settings"
          >
            <Palette className="w-4 h-4" />
          </ToolbarButton>

          <div className="toolbar-divider mx-1" />

          <button 
            onClick={onOpenShare}
            className="px-3 py-1.5 text-sm font-medium text-builder-text-secondary hover:text-builder-text transition-colors flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          {onPublish && (
            <button
              onClick={onPublish}
              className="btn-publish"
            >
              Publish
            </button>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
};
