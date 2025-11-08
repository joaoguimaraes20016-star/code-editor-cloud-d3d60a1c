import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (followUpDate: Date, reason: string) => void;
  onSkip?: () => void;
  dealName: string;
  stage: "cancelled" | "no_show" | "disqualified";
  teamId: string;
}

export function FollowUpDialog({ open, onOpenChange, onConfirm, onSkip, dealName, stage, teamId }: FollowUpDialogProps) {
  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState<Date>(addDays(new Date(), 7));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  // Load team settings for this stage
  useEffect(() => {
    if (open && teamId) {
      loadTeamSettings();
    }
  }, [open, teamId, stage]);

  const loadTeamSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_follow_up_settings')
        .select('*')
        .eq('team_id', teamId)
        .eq('pipeline_stage', stage)
        .maybeSingle();

      if (data) {
        setCreateFollowUp(data.suggest_follow_up);
        setFollowUpDate(addDays(new Date(), data.default_days));
        setFollowUpTime(data.default_time.slice(0, 5)); // Convert "10:00:00" to "10:00"
      }
    } catch (error) {
      console.error('Error loading follow-up settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (createFollowUp && followUpDate && reason.trim()) {
      onConfirm(followUpDate, reason.trim());
      resetForm();
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setCreateFollowUp(true);
    setFollowUpDate(addDays(new Date(), 7));
    setFollowUpTime("10:00");
    setReason("");
  };

  const stageLabel = stage === "cancelled" ? "Cancelled" : stage === "no_show" ? "No Show" : "Disqualified";
  const defaultReasons = stage === "cancelled" 
    ? ["Changed their mind", "Budget concerns", "Found another solution", "Not ready yet"]
    : stage === "no_show"
    ? ["Did not show up", "Wrong contact info", "Forgot about appointment", "No response"]
    : ["Not qualified", "Budget too low", "Wrong fit", "No decision maker"];

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

          {/* Toggle for follow-up creation */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="create-followup" className="text-base font-medium">
                Create follow-up task?
              </Label>
              <p className="text-sm text-muted-foreground">
                Schedule a task to follow up with this lead
              </p>
            </div>
            <Switch
              id="create-followup"
              checked={createFollowUp}
              onCheckedChange={setCreateFollowUp}
            />
          </div>
          
          {createFollowUp && (
            <>
              <div className="space-y-2">
                <Label>Follow-Up Date & Time</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-left font-normal"
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

                  <Select value={followUpTime} onValueChange={setFollowUpTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="09:00">9:00 AM</SelectItem>
                      <SelectItem value="10:00">10:00 AM</SelectItem>
                      <SelectItem value="11:00">11:00 AM</SelectItem>
                      <SelectItem value="12:00">12:00 PM</SelectItem>
                      <SelectItem value="13:00">1:00 PM</SelectItem>
                      <SelectItem value="14:00">2:00 PM</SelectItem>
                      <SelectItem value="15:00">3:00 PM</SelectItem>
                      <SelectItem value="16:00">4:00 PM</SelectItem>
                      <SelectItem value="17:00">5:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!createFollowUp ? (
            <Button onClick={handleSkip} disabled={!onSkip}>
              Move Without Follow-Up
            </Button>
          ) : (
            <Button 
              onClick={handleConfirm} 
              disabled={!followUpDate || !reason.trim()}
            >
              Move & Create Follow-Up
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
