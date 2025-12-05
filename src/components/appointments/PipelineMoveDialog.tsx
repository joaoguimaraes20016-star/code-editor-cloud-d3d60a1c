import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, StickyNote } from "lucide-react";

interface PipelineMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  fromStage: string;
  toStage: string;
  onConfirm: (notes: string) => void;
  isLoading?: boolean;
}

export function PipelineMoveDialog({
  open,
  onOpenChange,
  leadName,
  fromStage,
  toStage,
  onConfirm,
  isLoading = false,
}: PipelineMoveDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
  };

  const handleClose = () => {
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Add Closer Notes
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">Moving <strong>{leadName}</strong></span>
            <span className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-muted rounded text-foreground">{fromStage}</span>
              <ArrowRight className="h-4 w-4" />
              <span className="px-2 py-1 bg-primary/20 rounded text-foreground font-medium">{toStage}</span>
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <Label htmlFor="closer-notes">Add notes about this stage change (optional)</Label>
          <Textarea
            id="closer-notes"
            placeholder="e.g., Client needs time to think, following up next week..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Moving..." : "Move Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
