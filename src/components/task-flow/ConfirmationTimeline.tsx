import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ConfirmationCard } from "./ConfirmationCard";
import { Calendar, Clock } from "lucide-react";

interface ConfirmationConfig {
  sequence: number;
  hours_before: number;
  label: string;
  assigned_role: "setter" | "closer" | "off";
  enabled: boolean;
}

interface ConfirmationTimelineProps {
  confirmations: ConfirmationConfig[];
  onUpdate: (index: number, field: keyof ConfirmationConfig, value: any) => void;
  onRemove: (index: number) => void;
  onReorder: (newOrder: ConfirmationConfig[]) => void;
}

export function ConfirmationTimeline({
  confirmations,
  onUpdate,
  onRemove,
  onReorder,
}: ConfirmationTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = confirmations.findIndex((c) => c.sequence === active.id);
      const newIndex = confirmations.findIndex((c) => c.sequence === over.id);
      const newOrder = arrayMove(confirmations, oldIndex, newIndex);
      onReorder(newOrder);
    }
  };

  const sortedConfirmations = [...confirmations].sort(
    (a, b) => b.hours_before - a.hours_before
  );

  return (
    <div className="space-y-4">
      {/* Visual Preview Bar */}
      <div className="relative bg-muted/30 rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Confirmation Flow Preview</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-background px-3 py-1.5 rounded-md border border-border shadow-sm">
            <Calendar className="h-3.5 w-3.5" />
            Booked
          </div>
          
          <div className="flex-1 flex items-center gap-2">
            {sortedConfirmations
              .filter((c) => c.enabled && c.assigned_role !== "off")
              .map((conf, idx) => (
                <div key={conf.sequence} className="flex items-center gap-2">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-border to-primary/50 min-w-[30px]" />
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border shadow-sm ${
                      conf.assigned_role === "setter"
                        ? "bg-success/10 text-success-foreground border-success/20"
                        : "bg-info/10 text-info-foreground border-info/20"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {conf.hours_before >= 1 ? `${conf.hours_before}h` : `${Math.round(conf.hours_before * 60)}m`}
                  </div>
                </div>
              ))}
          </div>
          
          <div className="h-[2px] flex-1 bg-gradient-to-r from-primary/50 to-primary min-w-[30px]" />
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-md shadow-sm">
            <Calendar className="h-3.5 w-3.5" />
            Appointment
          </div>
        </div>
      </div>

      {/* Draggable Confirmation Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={confirmations.map((c) => c.sequence)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {confirmations.map((confirmation, index) => (
              <ConfirmationCard
                key={confirmation.sequence}
                confirmation={confirmation}
                index={index}
                onUpdate={onUpdate}
                onRemove={onRemove}
                canRemove={confirmations.length > 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
