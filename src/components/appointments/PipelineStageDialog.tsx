import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
  is_default: boolean;
}

interface PipelineStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: PipelineStage | null;
  teamId: string;
  maxOrderIndex: number;
  onSuccess: () => void;
}

const COLOR_OPTIONS = [
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
];

export function PipelineStageDialog({
  open,
  onOpenChange,
  stage,
  teamId,
  maxOrderIndex,
  onSuccess,
}: PipelineStageDialogProps) {
  const [label, setLabel] = useState(stage?.stage_label || "");
  const [color, setColor] = useState(stage?.stage_color || "blue");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Please enter a stage name");
      return;
    }

    setSaving(true);
    try {
      if (stage) {
        // Update existing stage
        const { error } = await supabase
          .from("team_pipeline_stages")
          .update({
            stage_label: label.trim(),
            stage_color: color,
          })
          .eq("id", stage.id);

        if (error) throw error;
        toast.success("Stage updated successfully");
      } else {
        // Create new stage
        const stageId = label.toLowerCase().replace(/\s+/g, "_");
        const { error } = await supabase.from("team_pipeline_stages").insert({
          team_id: teamId,
          stage_id: stageId,
          stage_label: label.trim(),
          stage_color: color,
          order_index: maxOrderIndex + 1,
          is_default: false,
        });

        if (error) throw error;
        toast.success("Stage created successfully");
      }

      onSuccess();
      onOpenChange(false);
      setLabel("");
      setColor("blue");
    } catch (error) {
      console.error("Error saving stage:", error);
      toast.error("Failed to save stage");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? "Edit Stage" : "Add New Stage"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Stage Name</Label>
            <Input
              id="stage-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Proposal Sent"
              disabled={stage?.is_default}
            />
            {stage?.is_default && (
              <p className="text-xs text-muted-foreground">
                Default stages cannot have their names changed
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Stage Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`h-10 rounded-md transition-all ${option.class} ${
                    color === option.value
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  title={option.label}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}