import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableAssetItem } from './SortableAssetItem';

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

interface SortableAssetListProps {
  assets: TeamAsset[];
  canManage: boolean;
  colorClass: string;
  onReorder: (assets: TeamAsset[]) => void;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (id: string, filePath: string | null) => void;
  onClick: (asset: TeamAsset) => void;
  emptyMessage: string;
}

export function SortableAssetList({
  assets,
  canManage,
  colorClass,
  onReorder,
  onEdit,
  onDelete,
  onClick,
  emptyMessage,
}: SortableAssetListProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = assets.findIndex((a) => a.id === active.id);
      const newIndex = assets.findIndex((a) => a.id === over.id);
      const newOrder = arrayMove(assets, oldIndex, newIndex);
      onReorder(newOrder);
    }
  };

  if (assets.length === 0 && canManage) {
    return <p className="text-base text-muted-foreground px-4">{emptyMessage}</p>;
  }

  if (assets.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {assets.map((asset) => (
            <SortableAssetItem
              key={asset.id}
              asset={asset}
              canManage={canManage}
              colorClass={colorClass}
              onEdit={onEdit}
              onDelete={onDelete}
              onClick={onClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
