import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DepositCollectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (depositAmount: number, notes: string, followUpDate: Date) => void;
  dealName: string;
}

export function DepositCollectedDialog({ open, onOpenChange, onConfirm, dealName }: DepositCollectedDialogProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date>(addDays(new Date(), 7));

  const handleConfirm = () => {
    const amount = parseFloat(depositAmount);
    if (!isNaN(amount) && amount > 0 && notes.trim() && followUpDate) {
      onConfirm(amount, notes.trim(), followUpDate);
      setDepositAmount("");
      setNotes("");
      setFollowUpDate(addDays(new Date(), 7));
      onOpenChange(false);
    }
  };

  const isValid = depositAmount && !isNaN(parseFloat(depositAmount)) && parseFloat(depositAmount) > 0 && notes.trim() && followUpDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit Collected</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Recording deposit for <span className="font-semibold">{dealName}</span>
          </p>
          
          <div className="space-y-2">
            <Label>Deposit Amount ($)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add notes about the deposit or progress..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Follow-Up Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !followUpDate && "text-muted-foreground"
                  )}
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
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Save Deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
