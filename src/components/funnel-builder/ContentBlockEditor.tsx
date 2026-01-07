import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Type, 
  Image as ImageIcon, 
  MousePointer2, 
  AlignLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ImagePicker } from './ImagePicker';
import type { EditorSelection } from './editorSelection';
import { getSelectionChildId, getSelectionStepId } from './editorSelection';

export interface ContentBlock {
  id: string;
  type: 'headline' | 'text' | 'image' | 'button';
  content: {
    text?: string;
    imageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
  };
}

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  selection: EditorSelection;
  stepId?: string | null;
  onSelectBlock?: (blockId: string) => void;
}

const blockTypeIcons = {
  headline: Type,
  text: AlignLeft,
  image: ImageIcon,
  button: MousePointer2,
};

const blockTypeLabels = {
  headline: 'Headline',
  text: 'Text Block',
  image: 'Image',
  button: 'Button',
};

function SortableBlock({ 
  block, 
  onUpdate, 
  onDelete,
  isExpanded,
  onToggleExpand,
  isSelected,
  onSelect,
}: { 
  block: ContentBlock; 
  onUpdate: (content: ContentBlock['content']) => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = blockTypeIcons[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-card transition-all",
        isSelected && "ring-2 ring-primary/60",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2 p-2" onClick={onSelect}>
        <button {...attributes} {...listeners} className="cursor-grab hover:text-primary p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{blockTypeLabels[block.type]}</span>
        <Button variant="ghost" size="sm" onClick={onToggleExpand}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t">
          {block.type === 'headline' && (
            <div className="space-y-2">
              <Label className="text-xs">Headline Text</Label>
              <Input
                value={block.content.text || ''}
                onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
                placeholder="Enter headline..."
              />
            </div>
          )}

          {block.type === 'text' && (
            <div className="space-y-2">
              <Label className="text-xs">Text Content</Label>
              <Textarea
                value={block.content.text || ''}
                onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
                placeholder="Enter text..."
                rows={3}
              />
            </div>
          )}

          {block.type === 'image' && (
            <div className="space-y-2">
              <Label className="text-xs">Image</Label>
              {block.content.imageUrl ? (
                <div className="relative group">
                  <img 
                    src={block.content.imageUrl} 
                    alt="" 
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute inset-0 m-auto w-fit h-fit opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setShowImagePicker(true)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-20"
                  onClick={() => setShowImagePicker(true)}
                >
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Select Image
                </Button>
              )}
              <ImagePicker
                open={showImagePicker}
                onOpenChange={setShowImagePicker}
                onSelect={(url) => onUpdate({ ...block.content, imageUrl: url })}
              />
            </div>
          )}

          {block.type === 'button' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Button Text</Label>
                <Input
                  value={block.content.buttonText || ''}
                  onChange={(e) => onUpdate({ ...block.content, buttonText: e.target.value })}
                  placeholder="Click me"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Button URL (optional)</Label>
                <Input
                  value={block.content.buttonUrl || ''}
                  onChange={(e) => onUpdate({ ...block.content, buttonUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ContentBlockEditor({
  blocks,
  onBlocksChange,
  selection,
  stepId,
  onSelectBlock,
}: ContentBlockEditorProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const selectionStepId = getSelectionStepId(selection);
  const selectedBlockId = selection.type === 'block' && selectionStepId === stepId
    ? getSelectionChildId(selection)
    : null;

  useEffect(() => {
    if (!selectedBlockId) return;
    setExpandedBlocks((prev) => {
      if (prev.has(selectedBlockId)) return prev;
      const next = new Set(prev);
      next.add(selectedBlockId);
      return next;
    });
  }, [selectedBlockId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      content: {},
    };
    onBlocksChange([...blocks, newBlock]);
    setExpandedBlocks(new Set([...expandedBlocks, newBlock.id]));
    onSelectBlock?.(newBlock.id);
  };

  const updateBlock = (id: string, content: ContentBlock['content']) => {
    onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const deleteBlock = (id: string) => {
    onBlocksChange(blocks.filter((b) => b.id !== id));
    expandedBlocks.delete(id);
    setExpandedBlocks(new Set(expandedBlocks));
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedBlocks(newExpanded);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Content Blocks</Label>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                onUpdate={(content) => updateBlock(block.id, content)}
                onDelete={() => deleteBlock(block.id)}
                isExpanded={expandedBlocks.has(block.id)}
                onToggleExpand={() => toggleExpand(block.id)}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelectBlock?.(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          Add content blocks below
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => addBlock('headline')} className="justify-start">
          <Type className="h-4 w-4 mr-2" />
          Headline
        </Button>
        <Button variant="outline" size="sm" onClick={() => addBlock('text')} className="justify-start">
          <AlignLeft className="h-4 w-4 mr-2" />
          Text
        </Button>
        <Button variant="outline" size="sm" onClick={() => addBlock('image')} className="justify-start">
          <ImageIcon className="h-4 w-4 mr-2" />
          Image
        </Button>
        <Button variant="outline" size="sm" onClick={() => addBlock('button')} className="justify-start">
          <MousePointer2 className="h-4 w-4 mr-2" />
          Button
        </Button>
      </div>
    </div>
  );
}
