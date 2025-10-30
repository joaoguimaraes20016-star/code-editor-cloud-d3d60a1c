import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorUtils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

const editSchema = z.object({
  lead_name: z.string().min(1, "Name is required"),
  lead_email: z.string().email("Valid email required"),
  lead_phone: z.string().optional(),
  start_at_utc: z.date(),
  setter_id: z.string().nullable(),
  closer_id: z.string().nullable(),
  cc_collected: z.coerce.number().min(0).optional(),
  mrr_amount: z.coerce.number().min(0).optional(),
  mrr_months: z.coerce.number().min(0).optional(),
  status: z.string(),
  pipeline_stage: z.string().optional(),
  setter_notes: z.string().optional(),
  product_name: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  teamId: string;
  onSuccess?: () => void;
}

export function EditAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  teamId,
  onSuccess,
}: EditAppointmentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      lead_name: appointment.lead_name,
      lead_email: appointment.lead_email,
      lead_phone: appointment.lead_phone || "",
      start_at_utc: new Date(appointment.start_at_utc),
      setter_id: appointment.setter_id,
      closer_id: appointment.closer_id,
      cc_collected: appointment.cc_collected || 0,
      mrr_amount: appointment.mrr_amount || 0,
      mrr_months: appointment.mrr_months || 0,
      status: appointment.status,
      pipeline_stage: appointment.pipeline_stage || "",
      setter_notes: appointment.setter_notes || "",
      product_name: appointment.product_name || "",
    },
  });

  const selectedDate = watch("start_at_utc");

  useEffect(() => {
    if (open) {
      loadTeamMembers();
      loadPipelineStages();
    }
  }, [open, teamId]);

  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select(`user_id, profiles!team_members_user_id_fkey(full_name)`)
      .eq("team_id", teamId);

    if (!error && data) {
      setTeamMembers(data);
    }
  };

  const loadPipelineStages = async () => {
    const { data, error } = await supabase
      .from("team_pipeline_stages")
      .select("*")
      .eq("team_id", teamId)
      .order("order_index");

    if (!error && data) {
      setStages(data);
    }
  };

  const onSubmit = async (data: EditFormValues) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          lead_name: data.lead_name,
          lead_email: data.lead_email,
          lead_phone: data.lead_phone || null,
          start_at_utc: data.start_at_utc.toISOString(),
          setter_id: data.setter_id,
          closer_id: data.closer_id,
          cc_collected: data.cc_collected || 0,
          mrr_amount: data.mrr_amount || 0,
          mrr_months: data.mrr_months || 0,
          status: data.status as any,
          pipeline_stage: data.pipeline_stage || null,
          setter_notes: data.setter_notes || null,
          product_name: data.product_name || null,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Log the edit
      await supabase.from("activity_logs").insert([{
        team_id: teamId,
        appointment_id: appointment.id,
        actor_name: "Admin",
        action_type: "Edited",
        note: "Appointment details updated",
      }]);

      toast({
        title: "Appointment updated",
        description: "Changes saved successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error updating appointment",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
          <DialogDescription>
            Update appointment details. All fields are editable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Lead Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lead_name">Lead Name *</Label>
              <Input id="lead_name" {...register("lead_name")} />
              {errors.lead_name && <p className="text-sm text-destructive">{errors.lead_name.message}</p>}
            </div>
            <div>
              <Label htmlFor="lead_email">Email *</Label>
              <Input id="lead_email" type="email" {...register("lead_email")} />
              {errors.lead_email && <p className="text-sm text-destructive">{errors.lead_email.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="lead_phone">Phone</Label>
            <Input id="lead_phone" {...register("lead_phone")} />
          </div>

          {/* Appointment Date */}
          <div>
            <Label>Appointment Date & Time *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP p") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setValue("start_at_utc", date)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Team Assignments */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="setter_id">Setter</Label>
              <Select
                value={watch("setter_id") || "none"}
                onValueChange={(val) => setValue("setter_id", val === "none" ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="closer_id">Closer</Label>
              <Select
                value={watch("closer_id") || "none"}
                onValueChange={(val) => setValue("closer_id", val === "none" ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Revenue Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cc_collected">Cash Collected</Label>
              <Input id="cc_collected" type="number" step="0.01" {...register("cc_collected")} />
            </div>
            <div>
              <Label htmlFor="mrr_amount">MRR Amount</Label>
              <Input id="mrr_amount" type="number" step="0.01" {...register("mrr_amount")} />
            </div>
            <div>
              <Label htmlFor="mrr_months">MRR Months</Label>
              <Input id="mrr_months" type="number" {...register("mrr_months")} />
            </div>
          </div>

          {/* Status & Stage */}
          <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={watch("status")} onValueChange={(val) => setValue("status", val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="SHOWED">Showed</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
                <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
            <div>
              <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
              <Select
                value={watch("pipeline_stage") || ""}
                onValueChange={(val) => setValue("pipeline_stage", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.stage_id}>
                      {stage.stage_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes & Product */}
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input id="product_name" {...register("product_name")} />
          </div>

          <div>
            <Label htmlFor="setter_notes">Notes</Label>
            <Textarea id="setter_notes" {...register("setter_notes")} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
