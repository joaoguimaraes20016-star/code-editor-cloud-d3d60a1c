import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, GripVertical, Trash2, Edit } from "lucide-react";
import { PipelineStageDialog } from "./PipelineStageDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
  is_default: boolean;
}

interface PipelineStageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onStagesUpdated: () => void;
}

function StageItem({ stage, onEdit, onDelete }: {
  stage: PipelineStage;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
    green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    red: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    pink: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
    teal: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    cyan: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div
        className={`flex-1 px-3 py-2 rounded-md font-medium ${
          colorClasses[stage.stage_color as keyof typeof colorClasses] || colorClasses.blue
        }`}
      >
        {stage.stage_label}
        {stage.is_default && (
          <span className="ml-2 text-xs opacity-60">(Default)</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="icon" variant="ghost" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        {!stage.is_default && (
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function PipelineStageManager({
  open,
  onOpenChange,
  teamId,
  onStagesUpdated,
}: PipelineStageManagerProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null);

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from("team_pipeline_stages")
        .select("*")
        .eq("team_id", teamId)
        .order("order_index");

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error("Error loading stages:", error);
      toast.error("Failed to load stages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadStages();
    }
  }, [open, teamId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const newStages = [...stages];
    const [movedStage] = newStages.splice(oldIndex, 1);
    newStages.splice(newIndex, 0, movedStage);

    const updatedStages = newStages.map((stage, index) => ({
      ...stage,
      order_index: index,
    }));

    setStages(updatedStages);

    try {
      const updates = updatedStages.map((stage) =>
        supabase
          .from("team_pipeline_stages")
          .update({ order_index: stage.order_index })
          .eq("id", stage.id)
      );

      await Promise.all(updates);
      toast.success("Stage order updated");
      onStagesUpdated();
    } catch (error) {
      console.error("Error updating stage order:", error);
      toast.error("Failed to update stage order");
      loadStages();
    }
  };

  const handleDelete = async () => {
    if (!stageToDelete) return;

    try {
      // Move appointments to "new" stage before deleting
      await supabase
        .from("appointments")
        .update({ pipeline_stage: "new" })
        .eq("team_id", teamId)
        .eq("pipeline_stage", stageToDelete.stage_id);

      const { error } = await supabase
        .from("team_pipeline_stages")
        .delete()
        .eq("id", stageToDelete.id);

      if (error) throw error;

      toast.success("Stage deleted successfully");
      loadStages();
      onStagesUpdated();
    } catch (error) {
      console.error("Error deleting stage:", error);
      toast.error("Failed to delete stage");
    } finally {
      setDeleteDialogOpen(false);
      setStageToDelete(null);
    }
  };

  const handleEdit = (stage: PipelineStage) => {
    setEditingStage(stage);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStage(null);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    loadStages();
    onStagesUpdated();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Manage Pipeline Stages</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button onClick={handleAdd} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add New Stage
            </Button>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {stages.map((stage) => (
                      <StageItem
                        key={stage.id}
                        stage={stage}
                        onEdit={() => handleEdit(stage)}
                        onDelete={() => {
                          setStageToDelete(stage);
                          setDeleteDialogOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PipelineStageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stage={editingStage}
        teamId={teamId}
        maxOrderIndex={stages.length > 0 ? Math.max(...stages.map((s) => s.order_index)) : 0}
        onSuccess={handleSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{stageToDelete?.stage_label}"? All deals in this
              stage will be moved to "New Leads".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}