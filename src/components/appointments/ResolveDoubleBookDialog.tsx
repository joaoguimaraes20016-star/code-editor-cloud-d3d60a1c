import { useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, User, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { formatDateTimeWithTimezone } from "@/lib/utils";

interface ResolveDoubleBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newAppointment: {
    id: string;
    lead_name: string;
    lead_email: string;
    start_at_utc: string;
    setter_name: string | null;
    closer_name: string | null;
    original_appointment_id: string | null;
  };
  originalAppointment?: {
    id: string;
    lead_name: string;
    lead_email: string;
    start_at_utc: string;
    setter_name: string | null;
    closer_name: string | null;
    status: string;
  } | null;
  teamId: string;
  onSuccess?: () => void;
}

export function ResolveDoubleBookDialog({
  open,
  onOpenChange,
  newAppointment,
  originalAppointment,
  teamId,
  onSuccess,
}: ResolveDoubleBookDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [fetchedOriginal, setFetchedOriginal] = useState<typeof originalAppointment>(originalAppointment);

  // Fetch original appointment if not provided
  const fetchOriginalAppointment = async () => {
    if (!newAppointment.original_appointment_id) return;
    
    setLoadingOriginal(true);
    const { data } = await supabase
      .from("appointments")
      .select("id, lead_name, lead_email, start_at_utc, setter_name, closer_name, status")
      .eq("id", newAppointment.original_appointment_id)
      .single();
    
    if (data) {
      setFetchedOriginal(data);
    }
    setLoadingOriginal(false);
  };

  // Fetch on open if needed
  useState(() => {
    if (open && !originalAppointment && newAppointment.original_appointment_id) {
      fetchOriginalAppointment();
    }
  });

  const handleKeepNew = async () => {
    setLoading(true);
    try {
      // 1. Cancel the original appointment
      if (fetchedOriginal?.id) {
        await supabase
          .from("appointments")
          .update({
            status: "CANCELLED",
            pipeline_stage: "cancelled",
            previous_status: fetchedOriginal.status,
          })
          .eq("id", fetchedOriginal.id);

        // Cleanup tasks for original appointment
        await supabase.rpc("cleanup_confirmation_tasks", {
          p_appointment_id: fetchedOriginal.id,
          p_reason: "Double book resolved - keeping new appointment",
        });
      }

      // 2. Clear double book context on new appointment (becomes normal lead)
      await supabase
        .from("appointments")
        .update({
          rebooking_type: null, // Clear to make it a normal lead
          pipeline_stage: "new", // Reset to new stage
        })
        .eq("id", newAppointment.id);

      // 3. Log the resolution
      await supabase.from("activity_logs").insert({
        team_id: teamId,
        appointment_id: newAppointment.id,
        actor_name: "Team Member",
        action_type: "Double Book Resolved",
        note: `Kept new appointment. ${resolveNote || "Original appointment cancelled."}`,
      });

      toast.success("Double book resolved - keeping new appointment");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error resolving double book:", error);
      toast.error("Failed to resolve double book");
    } finally {
      setLoading(false);
    }
  };

  const handleKeepOriginal = async () => {
    setLoading(true);
    try {
      // 1. Cancel the new appointment
      await supabase
        .from("appointments")
        .update({
          status: "CANCELLED",
          pipeline_stage: "cancelled",
          rebooking_type: null,
        })
        .eq("id", newAppointment.id);

      // Cleanup tasks for new appointment
      await supabase.rpc("cleanup_confirmation_tasks", {
        p_appointment_id: newAppointment.id,
        p_reason: "Double book resolved - keeping original appointment",
      });

      // 2. Clear the rescheduled_to reference on original (if any)
      if (fetchedOriginal?.id) {
        await supabase
          .from("appointments")
          .update({
            rescheduled_to_appointment_id: null,
            pipeline_stage: "new", // Reset from rebooking_conflict if needed
          })
          .eq("id", fetchedOriginal.id);

        // Log the resolution
        await supabase.from("activity_logs").insert({
          team_id: teamId,
          appointment_id: fetchedOriginal.id,
          actor_name: "Team Member",
          action_type: "Double Book Resolved",
          note: `Kept original appointment. ${resolveNote || "New appointment cancelled."}`,
        });
      }

      toast.success("Double book resolved - keeping original appointment");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error resolving double book:", error);
      toast.error("Failed to resolve double book");
    } finally {
      setLoading(false);
    }
  };

  const displayOriginal = fetchedOriginal || originalAppointment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Resolve Double Book
          </DialogTitle>
          <DialogDescription>
            This lead has two appointments scheduled. Confirm which one they actually want to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Side by side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Appointment */}
            <Card className="p-4 border-2 border-muted">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">Original</Badge>
                {loadingOriginal && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {displayOriginal ? (
                <div className="space-y-2">
                  <p className="font-semibold">{displayOriginal.lead_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateTimeWithTimezone(displayOriginal.start_at_utc, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatDateTimeWithTimezone(displayOriginal.start_at_utc, "h:mm a")}</span>
                  </div>
                  {displayOriginal.setter_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-info" />
                      <span>Setter: {displayOriginal.setter_name}</span>
                    </div>
                  )}
                  {displayOriginal.closer_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary" />
                      <span>Closer: {displayOriginal.closer_name}</span>
                    </div>
                  )}
                  <Button
                    className="w-full mt-3"
                    variant="outline"
                    onClick={handleKeepOriginal}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Keep Original
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading original appointment...</p>
              )}
            </Card>

            {/* New Appointment */}
            <Card className="p-4 border-2 border-warning">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-warning text-warning-foreground">New Booking</Badge>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">{newAppointment.lead_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTimeWithTimezone(newAppointment.start_at_utc, "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDateTimeWithTimezone(newAppointment.start_at_utc, "h:mm a")}</span>
                </div>
                {newAppointment.setter_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-info" />
                    <span>Setter: {newAppointment.setter_name}</span>
                  </div>
                )}
                {newAppointment.closer_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span>Closer: {newAppointment.closer_name}</span>
                  </div>
                )}
                <Button
                  className="w-full mt-3"
                  onClick={handleKeepNew}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Keep New Booking
                </Button>
              </div>
            </Card>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="resolve-note">Resolution Note (optional)</Label>
            <Textarea
              id="resolve-note"
              placeholder="Add any notes about this resolution..."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
