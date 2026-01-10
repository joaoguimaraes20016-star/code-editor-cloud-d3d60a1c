import React, { useState, useRef, useCallback } from 'react';
import { Step, Block, Element, SelectionState, StepIntent, Frame, Stack } from '../../types/infostack';
import { cn } from '@/lib/utils';
import { 
  UserPlus, 
  ClipboardCheck, 
  Calendar, 
  CreditCard, 
  CheckCircle2,
  Plus,
  GripVertical,
  MoreHorizontal,
  FileText,
  Layers,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Home,
  HelpCircle,
  Eye,
  EyeOff,
  Upload,
  FolderOpen,
  Type,
  Square,
  MousePointer,
  Box,
  LayoutTemplate,
  Trash2,
  Search,
  X,
  Film,
  FileIcon,
  Copy
} from 'lucide-react';
import { getIntentColorClass } from '../utils/helpers';
import { 
  stepIntentLabels, 
  formatPageName, 
  getBlockTypeLabel, 
  getElementTypeLabel 
} from '../utils/labels';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

type TabType = 'pages' | 'layers' | 'assets';

// Asset type definition
interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'file';
  url: string;
  size: number;
  uploadedAt: Date;
}

interface LeftPanelProps {
  steps: Step[];
  activeStepId: string | null;
  selection: SelectionState;
  onStepSelect: (stepId: string) => void;
  onAddStep: (intent: StepIntent) => void;
  onAddBlankStep?: () => void;
  onDeleteStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onSelectBlock?: (blockId: string, path: string[]) => void;
  onSelectElement?: (elementId: string, path: string[]) => void;
  onRenameStep?: (stepId: string, newName: string) => void;
  onOpenImagePicker?: () => void;
}

const intentIcons: Record<StepIntent, React.ReactNode> = {
  capture: <UserPlus className="w-3.5 h-3.5" />,
  qualify: <ClipboardCheck className="w-3.5 h-3.5" />,
  schedule: <Calendar className="w-3.5 h-3.5" />,
  convert: <CreditCard className="w-3.5 h-3.5" />,
  complete: <CheckCircle2 className="w-3.5 h-3.5" />,
};

// Sortable Page Item Component
interface SortablePageItemProps {
  step: Step;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onStepSelect: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onRenameStep?: (stepId: string, newName: string) => void;
}

const SortablePageItem: React.FC<SortablePageItemProps> = ({
  step,
  index,
  isActive,
  isSelected,
  onStepSelect,
  onDuplicateStep,
  onDeleteStep,
  onRenameStep,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(step.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(step.name || (index === 0 ? 'Home' : `Step ${index + 1}`));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== step.name) {
      onRenameStep?.(step.id, editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(step.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-150',
        isActive 
          ? 'bg-builder-accent/15 text-builder-text' 
          : 'bg-builder-surface hover:bg-builder-surface-hover text-builder-text-secondary',
        isSelected && 'ring-1 ring-builder-accent',
        isDragging && 'opacity-50 z-50 shadow-lg bg-builder-surface-active'
      )}
      onClick={() => !isEditing && onStepSelect(step.id)}
    >
      {/* Drag Handle */}
      <div 
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3 h-3 text-builder-text-dim" />
      </div>

      {/* Page Icon */}
      <div className={cn(
        'flex items-center justify-center w-5 h-5 rounded text-xs',
        isActive 
          ? 'text-builder-accent' 
          : 'text-builder-text-muted'
      )}>
        {index === 0 ? <Home className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
      </div>

      {/* Page Info - Inline Editable */}
      <div className="flex-1 min-w-0" onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent border-b border-builder-accent outline-none text-builder-text"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn(
            "text-sm truncate block",
            isActive ? "text-builder-accent font-medium" : ""
          )}>
            {step.name || (index === 0 ? 'Home' : `Step ${index + 1}`)}
          </span>
        )}
      </div>

      {/* Expand indicator for nested */}
      {step.frames.length > 1 && (
        <ChevronRight className="w-3.5 h-3.5 text-builder-text-dim" />
      )}

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-builder-surface-active transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-builder-text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-builder-surface border-builder-border">
          <DropdownMenuItem 
            onClick={() => {
              setEditValue(step.name || (index === 0 ? 'Home' : `Step ${index + 1}`));
              setIsEditing(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="text-builder-text hover:bg-builder-surface-hover"
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => onDuplicateStep(step.id)}
            className="text-builder-text hover:bg-builder-surface-hover"
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-builder-border-subtle" />
          <DropdownMenuItem 
            onClick={() => onDeleteStep(step.id)}
            className="text-builder-error hover:bg-builder-error/10"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Drag Overlay Item
const DragOverlayItem: React.FC<{ step: Step; index: number }> = ({ step, index }) => (
  <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-builder-surface-active text-builder-text shadow-xl border border-builder-accent">
    <GripVertical className="w-3 h-3 text-builder-text-dim" />
    <div className="flex items-center justify-center w-5 h-5 rounded text-xs text-builder-accent">
      {index === 0 ? <Home className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
    </div>
    <span className="text-sm font-medium text-builder-accent">
      {step.name || (index === 0 ? 'Home' : `Step ${index + 1}`)}
    </span>
  </div>
);

// Get icon for element type
const getElementIcon = (type: string) => {
  switch (type) {
    case 'text':
    case 'heading':
      return <Type className="w-3.5 h-3.5" />;
    case 'button':
      return <MousePointer className="w-3.5 h-3.5" />;
    case 'image':
      return <ImageIcon className="w-3.5 h-3.5" />;
    case 'video':
      return <Film className="w-3.5 h-3.5" />;
    case 'input':
    case 'select':
    case 'checkbox':
    case 'radio':
      return <Square className="w-3.5 h-3.5" />;
    default:
      return <Box className="w-3.5 h-3.5" />;
  }
};

// Get icon for block type
const getBlockIcon = (type: string) => {
  switch (type) {
    case 'hero':
      return <LayoutTemplate className="w-3.5 h-3.5" />;
    case 'cta':
      return <MousePointer className="w-3.5 h-3.5" />;
    case 'form-field':
      return <Square className="w-3.5 h-3.5" />;
    case 'media':
      return <ImageIcon className="w-3.5 h-3.5" />;
    case 'text-block':
      return <Type className="w-3.5 h-3.5" />;
    default:
      return <Layers className="w-3.5 h-3.5" />;
  }
};

// Enhanced Layer Item
interface LayerItemProps {
  label: string;
  icon: React.ReactNode;
  type: 'frame' | 'block' | 'element';
  typeBadge?: string;
  isSelected?: boolean;
  isVisible?: boolean;
  depth?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onToggleVisibility?: () => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
  label,
  icon,
  type,
  typeBadge,
  isSelected = false,
  isVisible = true,
  depth = 0,
  hasChildren = false,
  isExpanded = false,
  onToggleExpand,
  onClick,
  onToggleVisibility,
}) => {
  const typeColors = {
    frame: 'text-blue-400',
    block: 'text-purple-400',
    element: 'text-green-400',
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all text-sm",
        isSelected 
          ? "bg-builder-accent/15 text-builder-accent" 
          : "hover:bg-builder-surface-hover text-builder-text-secondary",
        !isVisible && "opacity-50"
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={onClick}
    >
      {hasChildren ? (
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
          className="p-0.5 hover:bg-builder-surface-active rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}
      <span className={cn("shrink-0", typeColors[type])}>{icon}</span>
      <span className="flex-1 truncate text-xs">{label}</span>
      {typeBadge && (
        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded bg-builder-surface-active text-builder-text-dim uppercase tracking-wide">
          {typeBadge}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-builder-surface-active rounded transition-opacity shrink-0"
      >
        {isVisible ? (
          <Eye className="w-3 h-3 text-builder-text-dim" />
        ) : (
          <EyeOff className="w-3 h-3 text-builder-text-dim" />
        )}
      </button>
    </div>
  );
};

// Enhanced Layers Tree Component with full hierarchy
const EnhancedLayersTree: React.FC<{
  steps: Step[];
  activeStepId: string | null;
  selection: SelectionState;
  onSelectBlock?: (blockId: string, path: string[]) => void;
  onSelectElement?: (elementId: string, path: string[]) => void;
}> = ({ steps, activeStepId, selection, onSelectBlock, onSelectElement }) => {
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  
  const toggleVisibility = (id: string) => {
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.success('Layer visible');
      } else {
        next.add(id);
        toast.success('Layer hidden');
      }
      return next;
    });
  };
  
  const activeStep = steps.find(s => s.id === activeStepId);
  
  if (!activeStep) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Layers className="w-8 h-8 text-builder-text-dim mx-auto mb-2" />
          <p className="text-sm text-builder-text-muted">Select a page to view layers</p>
        </div>
      </div>
    );
  }

  const toggleFrame = (frameId: string) => {
    setExpandedFrames(prev => {
      const next = new Set(prev);
      if (next.has(frameId)) next.delete(frameId);
      else next.add(frameId);
      return next;
    });
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto builder-scroll p-2">
      {/* Page Header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-2 rounded-lg bg-builder-surface-hover">
        <FileText className="w-4 h-4 text-builder-accent" />
        <span className="text-sm font-medium text-builder-text">
          {formatPageName(activeStep.name)}
        </span>
      </div>
      
      {/* Frame/Stack/Block/Element Hierarchy */}
      {activeStep.frames.map((frame) => {
        const isFrameExpanded = expandedFrames.has(frame.id) || activeStep.frames.length === 1;
        const framePath = ['step', activeStep.id, 'frame', frame.id];
        const isFrameSelected = selection.type === 'frame' && selection.id === frame.id;
        
        return (
          <div key={frame.id}>
            {/* Frame Level - Now labeled as "Section" */}
            {activeStep.frames.length > 1 && (
              <LayerItem
                label={frame.label || 'Section'}
                icon={<LayoutTemplate className="w-3.5 h-3.5" />}
                type="frame"
                typeBadge="Section"
                isSelected={isFrameSelected}
                hasChildren={frame.stacks.some(s => s.blocks.length > 0)}
                isExpanded={isFrameExpanded}
                onToggleExpand={() => toggleFrame(frame.id)}
                onClick={() => onSelectBlock?.(frame.id, framePath)}
              />
            )}
            
            {/* Stacks & Blocks */}
            {(isFrameExpanded || activeStep.frames.length === 1) && frame.stacks.map((stack) => (
              <div key={stack.id}>
                {stack.blocks.map((block) => {
                  const isBlockExpanded = expandedBlocks.has(block.id);
                  const isBlockSelected = selection.type === 'block' && selection.id === block.id;
                  const blockPath = [...framePath, 'stack', stack.id, 'block', block.id];
                  const blockDepth = activeStep.frames.length > 1 ? 1 : 0;
                  
                  return (
                    <div key={block.id}>
                      {/* Block Level */}
                      <LayerItem
                        label={block.label || getBlockTypeLabel(block.type)}
                        icon={getBlockIcon(block.type)}
                        type="block"
                        typeBadge={block.type}
                        isSelected={isBlockSelected}
                        isVisible={!hiddenLayers.has(block.id)}
                        hasChildren={block.elements.length > 0}
                        isExpanded={isBlockExpanded}
                        depth={blockDepth}
                        onToggleExpand={() => toggleBlock(block.id)}
                        onClick={() => onSelectBlock?.(block.id, blockPath)}
                        onToggleVisibility={() => toggleVisibility(block.id)}
                      />
                      
                      {/* Element Level */}
                      {isBlockExpanded && block.elements.map((element) => {
                        const isElementSelected = selection.type === 'element' && selection.id === element.id;
                        const elementPath = [...blockPath, 'element', element.id];
                        const elementLabel = element.content?.slice(0, 25) || getElementTypeLabel(element.type);
                        
                        return (
                          <LayerItem
                            key={element.id}
                            label={elementLabel}
                            icon={getElementIcon(element.type)}
                            type="element"
                            typeBadge={element.type}
                            isSelected={isElementSelected}
                            isVisible={!hiddenLayers.has(element.id)}
                            depth={blockDepth + 1}
                            onClick={() => onSelectElement?.(element.id, elementPath)}
                            onToggleVisibility={() => toggleVisibility(element.id)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
      
      {/* Empty state if no blocks */}
      {activeStep.frames.every(f => f.stacks.every(s => s.blocks.length === 0)) && (
        <div className="mt-4 p-4 text-center">
          <p className="text-xs text-builder-text-dim">No blocks yet. Add sections from the canvas.</p>
        </div>
      )}
    </div>
  );
};

// Asset Library Panel
const AssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    const newAssets: Asset[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }
      
      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      // Determine file type
      let type: 'image' | 'video' | 'file' = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      
      newAssets.push({
        id: `asset-${Date.now()}-${i}`,
        name: file.name,
        type,
        url,
        size: file.size,
        uploadedAt: new Date(),
      });
    }
    
    setAssets(prev => [...newAssets, ...prev]);
    setIsUploading(false);
    
    if (newAssets.length > 0) {
      toast.success(`${newAssets.length} asset${newAssets.length > 1 ? 's' : ''} uploaded`);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    toast.success('Asset deleted');
  }, []);

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  }, []);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-5 h-5" />;
      case 'video': return <Film className="w-5 h-5" />;
      default: return <FileIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Bar */}
      <div className="p-3 border-b border-builder-border-subtle">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-builder-text-dim" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-builder-surface-hover border border-builder-border text-builder-text placeholder-builder-text-dim focus:outline-none focus:border-builder-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-builder-text-dim hover:text-builder-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Upload Area & Assets Grid */}
      <div className="flex-1 overflow-y-auto builder-scroll p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 rounded-xl border-2 border-dashed transition-all",
            isUploading 
              ? "border-builder-accent/50 bg-builder-accent/5 cursor-wait"
              : "border-builder-border hover:border-builder-accent hover:bg-builder-surface-hover"
          )}
        >
          <Upload className={cn("w-4 h-4", isUploading ? "animate-pulse text-builder-accent" : "text-builder-text-muted")} />
          <span className={cn("text-sm font-medium", isUploading ? "text-builder-accent" : "text-builder-text-muted")}>
            {isUploading ? 'Uploading...' : 'Upload Assets'}
          </span>
        </button>

        {/* Assets Grid */}
        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <div 
                key={asset.id}
                className="group relative rounded-lg overflow-hidden bg-builder-surface-hover border border-builder-border hover:border-builder-accent transition-all"
              >
                {/* Preview */}
                <div className="aspect-square relative">
                  {asset.type === 'image' ? (
                    <img 
                      src={asset.url} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-builder-bg">
                      {getAssetIcon(asset.type)}
                    </div>
                  )}
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleCopyUrl(asset.url)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                
                {/* File Info */}
                <div className="p-2">
                  <p className="text-xs text-builder-text truncate" title={asset.name}>
                    {asset.name}
                  </p>
                  <p className="text-[10px] text-builder-text-dim">
                    {formatFileSize(asset.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-builder-surface-hover flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-builder-text-dim" />
            </div>
            <p className="text-sm text-builder-text-muted mb-1">No assets yet</p>
            <p className="text-xs text-builder-text-dim text-center">
              Upload images and files to use in your funnel
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <Search className="w-8 h-8 text-builder-text-dim mb-2" />
            <p className="text-sm text-builder-text-muted">No matches found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const LeftPanel: React.FC<LeftPanelProps> = ({
  steps,
  activeStepId,
  selection,
  onStepSelect,
  onAddStep,
  onAddBlankStep,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps,
  onSelectBlock,
  onSelectElement,
  onRenameStep,
  onOpenImagePicker,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((step) => step.id === active.id);
      const newIndex = steps.findIndex((step) => step.id === over.id);
      onReorderSteps(oldIndex, newIndex);
    }
  };

  const activeStep = activeId ? steps.find(s => s.id === activeId) : null;
  const activeIndex = activeId ? steps.findIndex(s => s.id === activeId) : -1;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-builder-surface border-r border-builder-border">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-builder-border">
          <button
            onClick={() => setActiveTab('pages')}
            className={cn('builder-tab flex-1', activeTab === 'pages' && 'builder-tab-active')}
          >
            Steps
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={cn('builder-tab flex-1', activeTab === 'layers' && 'builder-tab-active')}
          >
            Layers
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={cn('builder-tab flex-1', activeTab === 'assets' && 'builder-tab-active')}
          >
            Assets
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'pages' && (
            <>
              {/* Steps Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-builder-text">Steps</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-builder-text-dim" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-medium mb-1">Hierarchy:</p>
                      <p className="text-xs text-muted-foreground">Page → Step → Section → Block → Element</p>
                      <p className="text-xs text-muted-foreground mt-1">Double-click a step to rename it.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded bg-builder-surface-hover text-builder-text-muted hover:text-builder-text hover:bg-builder-surface-active transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-builder-surface border-builder-border z-50">
                    {/* Blank Page Option */}
                    <DropdownMenuItem
                      onClick={() => onAddBlankStep?.()}
                      className="flex items-center gap-2 text-builder-text hover:bg-builder-surface-hover"
                    >
                      <span className="intent-badge bg-builder-surface-active text-builder-text-muted">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      Blank Page
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-builder-border-subtle" />
                    {(Object.keys(stepIntentLabels) as StepIntent[]).map((intent) => (
                      <DropdownMenuItem
                        key={intent}
                        onClick={() => onAddStep(intent)}
                        className="flex items-center gap-2 text-builder-text hover:bg-builder-surface-hover"
                      >
                        <span className={cn('intent-badge', getIntentColorClass(intent))}>
                          {intentIcons[intent]}
                        </span>
                        {stepIntentLabels[intent]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

            {/* Pages List with DnD */}
            <div className="flex-1 overflow-y-auto builder-scroll px-2 space-y-0.5">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {steps.map((step, index) => {
                    const isActive = step.id === activeStepId;
                    const isSelected = selection.type === 'step' && selection.id === step.id;

                    return (
                      <SortablePageItem
                        key={step.id}
                        step={step}
                        index={index}
                        isActive={isActive}
                        isSelected={isSelected}
                        onStepSelect={onStepSelect}
                        onDuplicateStep={onDuplicateStep}
                        onDeleteStep={onDeleteStep}
                        onRenameStep={onRenameStep}
                      />
                    );
                  })}
                </SortableContext>
                <DragOverlay>
                  {activeStep ? (
                    <DragOverlayItem step={activeStep} index={activeIndex} />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            {/* Social Preview Card */}
            <div className="p-3 border-t border-builder-border-subtle">
              <div className="p-3 rounded-lg bg-builder-bg">
                <div className="text-xs font-medium text-builder-text mb-1">Social Preview</div>
                <div className="text-xs text-builder-text-dim mb-2">1200 × 630 pixels</div>
                <div className="aspect-video bg-builder-surface rounded-md flex items-center justify-center mb-2">
                  <span className="text-lg font-semibold text-builder-text-muted">funnel</span>
                </div>
                <button 
                  onClick={() => onOpenImagePicker?.()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-builder-surface-hover text-xs text-builder-text-secondary hover:bg-builder-surface-active transition-colors"
                >
                  Choose Image
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}

          {activeTab === 'layers' && (
            <EnhancedLayersTree
              steps={steps}
              activeStepId={activeStepId}
              selection={selection}
              onSelectBlock={onSelectBlock}
              onSelectElement={onSelectElement}
            />
          )}

          {activeTab === 'assets' && <AssetsPanel />}

          {/* Add Step Button */}
          <div className="p-3 border-t border-builder-border-subtle">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-builder-surface-hover text-builder-text-muted hover:text-builder-text hover:bg-builder-surface-active text-sm transition-colors">
                  <Plus className="w-4 h-4" />
                  Add step
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 bg-builder-surface border-builder-border z-50">
                {/* Blank Page Option */}
                <DropdownMenuItem
                  onClick={() => onAddBlankStep?.()}
                  className="flex items-center gap-2 text-builder-text hover:bg-builder-surface-hover"
                >
                  <span className="intent-badge bg-builder-surface-active text-builder-text-muted">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  Blank Page
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-builder-border-subtle" />
                {(Object.keys(stepIntentLabels) as StepIntent[]).map((intent) => (
                  <DropdownMenuItem
                    key={intent}
                    onClick={() => onAddStep(intent)}
                    className="flex items-center gap-2 text-builder-text hover:bg-builder-surface-hover"
                  >
                    <span className={cn('intent-badge', getIntentColorClass(intent))}>
                      {intentIcons[intent]}
                    </span>
                    {stepIntentLabels[intent]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
