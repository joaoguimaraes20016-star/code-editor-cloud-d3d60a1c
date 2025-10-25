import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (rescheduleDate: Date) => void;
  dealName: string;
}

export function RescheduleDialog({ open, onOpenChange, onConfirm, dealName }: RescheduleDialogProps) {
  const [rescheduleDate, setRescheduleDate] = useState<Date>();

  const handleConfirm = () => {
    if (rescheduleDate) {
      onConfirm(rescheduleDate);
      setRescheduleDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Moving <span className="font-semibold">{dealName}</span> to Rescheduled
          </p>
          
          <div className="space-y-2">
            <Label>Select Reschedule Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {rescheduleDate ? format(rescheduleDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={rescheduleDate}
                  onSelect={setRescheduleDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!rescheduleDate}>
            Confirm Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
