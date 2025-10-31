import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  appointments: Array<{ id: string; lead_name: string; lead_email: string; start_at_utc: string }>;
  onTaskCreated?: () => void;
}

export function CreateTaskDialog({ 
  open, 
  onOpenChange, 
  teamId, 
  appointments,
  onTaskCreated 
}: CreateTaskDialogProps) {
  const [appointmentId, setAppointmentId] = useState("");
  const [taskType, setTaskType] = useState<"call_confirmation" | "follow_up" | "reschedule">("call_confirmation");
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [followUpReason, setFollowUpReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Date>();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!appointmentId) {
      toast.error("Please select an appointment");
      return;
    }

    if (taskType === "follow_up" && !followUpDate) {
      toast.error("Please select a follow-up date");
      return;
    }

    if (taskType === "reschedule" && !rescheduleDate) {
      toast.error("Please select a reschedule date");
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase.rpc("create_task_with_assignment", {
        p_team_id: teamId,
        p_appointment_id: appointmentId,
        p_task_type: taskType,
        p_follow_up_date: taskType === "follow_up" && followUpDate ? format(followUpDate, "yyyy-MM-dd") : null,
        p_follow_up_reason: taskType === "follow_up" ? followUpReason : null,
        p_reschedule_date: taskType === "reschedule" && rescheduleDate ? format(rescheduleDate, "yyyy-MM-dd") : null,
      });

      if (error) throw error;

      toast.success("Task created successfully");
      onTaskCreated?.();
      onOpenChange(false);
      
      // Reset form
      setAppointmentId("");
      setTaskType("call_confirmation");
      setFollowUpDate(undefined);
      setFollowUpReason("");
      setRescheduleDate(undefined);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Select an appointment and task type to create a new task that will be auto-assigned.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Appointment</Label>
            <Select value={appointmentId} onValueChange={setAppointmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select appointment" />
              </SelectTrigger>
              <SelectContent>
                {appointments.map((apt) => (
                  <SelectItem key={apt.id} value={apt.id}>
                    {apt.lead_name} - {format(new Date(apt.start_at_utc), "MMM d, h:mm a")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Task Type</Label>
            <Select value={taskType} onValueChange={(val: any) => setTaskType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call_confirmation">Call Confirmation</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {taskType === "follow_up" && (
            <>
              <div>
                <Label>Follow-up Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={followUpDate} onSelect={setFollowUpDate} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Follow-up Reason</Label>
                <Textarea 
                  value={followUpReason} 
                  onChange={(e) => setFollowUpReason(e.target.value)}
                  placeholder="Why is this follow-up needed?"
                />
              </div>
            </>
          )}

          {taskType === "reschedule" && (
            <div>
              <Label>Reschedule Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rescheduleDate ? format(rescheduleDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={rescheduleDate} onSelect={setRescheduleDate} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="flex-1">
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
