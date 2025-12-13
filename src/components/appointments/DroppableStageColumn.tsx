import { useDroppable } from "@dnd-kit/core";
import { ReactNode, memo } from "react";

interface DroppableStageColumnProps {
  id: string;
  children: ReactNode;
}

function DroppableStageColumnComponent({ id, children }: DroppableStageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 transition-all ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      style={{ width: '300px' }}
    >
      {children}
    </div>
  );
}

export const DroppableStageColumn = memo(DroppableStageColumnComponent);
