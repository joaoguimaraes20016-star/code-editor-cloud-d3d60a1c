import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newStatus: string) => void;
  dealName: string;
  currentStatus: string | null;
}

const STATUS_OPTIONS = [
  { value: "NEW", label: "Pending Confirmation" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

export function ChangeStatusDialog({ open, onOpenChange, onConfirm, dealName, currentStatus }: ChangeStatusDialogProps) {
  const [newStatus, setNewStatus] = useState<string>(currentStatus || "NEW");

  const handleConfirm = () => {
    onConfirm(newStatus);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Changing status for <span className="font-semibold">{dealName}</span>
          </p>
          
          <div className="space-y-2">
            <Label>New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStatus === "RESCHEDULED" && (
            <p className="text-sm text-muted-foreground">
              A reschedule task will be created and assigned for confirmation.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Change Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
