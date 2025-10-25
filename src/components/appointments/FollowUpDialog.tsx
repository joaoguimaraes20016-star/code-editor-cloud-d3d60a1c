import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (followUpDate: Date, reason: string) => void;
  dealName: string;
  stage: "cancelled" | "no_show";
}

export function FollowUpDialog({ open, onOpenChange, onConfirm, dealName, stage }: FollowUpDialogProps) {
  const [followUpDate, setFollowUpDate] = useState<Date>(addDays(new Date(), 7));
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (followUpDate && reason.trim()) {
      onConfirm(followUpDate, reason.trim());
      setFollowUpDate(addDays(new Date(), 7));
      setReason("");
      onOpenChange(false);
    }
  };

  const stageLabel = stage === "cancelled" ? "Cancelled" : "No Show";
  const defaultReasons = stage === "cancelled" 
    ? ["Changed their mind", "Budget concerns", "Found another solution", "Not ready yet"]
    : ["Did not show up", "Wrong contact info", "Forgot about appointment", "No response"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Follow-Up Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Moving <span className="font-semibold">{dealName}</span> to {stageLabel}
          </p>
          
          <div className="space-y-2">
            <Label>Follow-Up Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={(date) => date && setFollowUpDate(date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Textarea
              placeholder="Why are they being moved to this stage?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {defaultReasons.map((defaultReason) => (
                <Button
                  key={defaultReason}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setReason(defaultReason)}
                >
                  {defaultReason}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!followUpDate || !reason.trim()}>
            Create Follow-Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
