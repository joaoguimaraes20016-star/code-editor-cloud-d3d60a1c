import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { TriggerType } from "@/lib/automations/types";

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  automation?: {
    id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    definition: Record<string, any>;
  } | null;
}

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: "lead_created", label: "Lead Created" },
  { value: "lead_tag_added", label: "Lead Tag Added" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "appointment_rescheduled", label: "Appointment Rescheduled" },
  { value: "appointment_no_show", label: "Appointment No Show" },
  { value: "appointment_completed", label: "Appointment Completed" },
  { value: "payment_received", label: "Payment Received" },
  { value: "time_delay", label: "Time Delay" },
];

const SAMPLE_DEFINITION = {
  id: "",
  teamId: "",
  name: "",
  description: "",
  isActive: true,
  trigger: {
    type: "appointment_booked",
    config: {},
  },
  steps: [
    {
      id: "step-1",
      order: 1,
      type: "send_message",
      config: {
        channel: "sms",
        template: "Hey {{lead.first_name}}, your appointment is confirmed!",
      },
    },
  ],
};

export function AutomationFormDialog({
  open,
  onOpenChange,
  teamId,
  automation,
}: AutomationFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!automation;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("appointment_booked");
  const [definitionJson, setDefinitionJson] = useState("");

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description || "");
      setTriggerType(automation.trigger_type as TriggerType);
      setDefinitionJson(JSON.stringify(automation.definition, null, 2));
    } else {
      setName("");
      setDescription("");
      setTriggerType("appointment_booked");
      setDefinitionJson(JSON.stringify(SAMPLE_DEFINITION, null, 2));
    }
  }, [automation, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedDefinition: Record<string, any>;
      try {
        parsedDefinition = JSON.parse(definitionJson);
      } catch {
        throw new Error("Invalid JSON in definition");
      }

      // Update the definition with form values
      parsedDefinition.id = automation?.id || crypto.randomUUID();
      parsedDefinition.teamId = teamId;
      parsedDefinition.name = name;
      parsedDefinition.description = description;
      parsedDefinition.trigger = {
        ...parsedDefinition.trigger,
        type: triggerType,
      };

      if (isEditing && automation) {
        const { error } = await supabase
          .from("automations")
          .update({
            name,
            description,
            trigger_type: triggerType,
            definition: parsedDefinition,
            updated_at: new Date().toISOString(),
          })
          .eq("id", automation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("automations").insert({
          team_id: teamId,
          name,
          description,
          trigger_type: triggerType,
          definition: parsedDefinition,
          is_active: true,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] });
      toast.success(isEditing ? "Automation updated" : "Automation created");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save automation");
      console.error(err);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Automation" : "New Automation"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome SMS for new leads"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger">Trigger Type</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="definition">
              Definition (JSON)
              <span className="text-xs text-muted-foreground ml-2">
                Full AutomationDefinition structure
              </span>
            </Label>
            <Textarea
              id="definition"
              value={definitionJson}
              onChange={(e) => setDefinitionJson(e.target.value)}
              className="font-mono text-sm"
              rows={12}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
