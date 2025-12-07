import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { FileText, Video, Link as LinkIcon, Trash2, Pencil, GripVertical } from 'lucide-react';

interface TeamAsset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string | null;
  file_type: string | null;
  loom_url: string | null;
  external_url: string | null;
  created_at: string;
  order_index?: number;
}

interface SortableAssetItemProps {
  asset: TeamAsset;
  canManage: boolean;
  colorClass: string;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (id: string, filePath: string | null) => void;
  onClick: (asset: TeamAsset) => void;
}

export function SortableAssetItem({ 
  asset, 
  canManage, 
  colorClass, 
  onEdit, 
  onDelete, 
  onClick 
}: SortableAssetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id, disabled: !canManage });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group w-full text-left px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-between cursor-pointer"
      onClick={() => onClick(asset)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-4">
        {canManage && (
          <button 
            type="button"
            {...attributes} 
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {asset.loom_url ? (
          <Video className={`h-6 w-6 ${colorClass}`} />
        ) : asset.external_url ? (
          <LinkIcon className={`h-6 w-6 ${colorClass}`} />
        ) : (
          <FileText className={`h-6 w-6 ${colorClass}`} />
        )}
        <span className="text-sm sm:text-base md:text-lg font-medium group-hover:text-primary group-hover:underline transition-colors">
          {asset.title}
        </span>
      </div>
      {canManage && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset.id, asset.file_path);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
