import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AutomationFormDialog } from "./AutomationFormDialog";
import { runAutomationsForEvent } from "@/lib/automations/triggerHelper";
import type { TriggerType } from "@/lib/automations/types";

interface AutomationsListProps {
  teamId: string;
}

interface Automation {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
  definition: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function AutomationsList({ teamId }: AutomationsListProps) {
  const queryClient = useQueryClient();
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingTrigger, setTestingTrigger] = useState(false);

  const { data: automations, isLoading } = useQuery({
    queryKey: ["automations", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Automation[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("automations")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] });
      toast.success("Automation updated");
    },
    onError: (err) => {
      toast.error("Failed to update automation");
      console.error(err);
    },
  });

  const handleTestTrigger = async () => {
    setTestingTrigger(true);
    try {
      const result = await runAutomationsForEvent({
        triggerType: "appointment_booked",
        teamId,
        eventPayload: {
          appointment: {
            id: "test-appointment-" + Date.now(),
            lead_name: "Test Lead",
            lead_email: "test@example.com",
            start_at_utc: new Date().toISOString(),
          },
          lead: {
            first_name: "Test",
            last_name: "Lead",
            email: "test@example.com",
          },
        },
      });

      if (result.status === "ok") {
        toast.success(`Test trigger fired! ${result.automationsRun.length} automation(s) ran, ${result.stepsExecuted.length} step(s) executed.`);
      } else {
        toast.error(`Test trigger failed: ${result.error}`);
      }
      console.log("[Test Trigger] Result:", result);
    } catch (err) {
      toast.error("Test trigger failed");
      console.error(err);
    } finally {
      setTestingTrigger(false);
    }
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingAutomation(null);
  };

  const triggerTypeLabels: Record<TriggerType, string> = {
    lead_created: "Lead Created",
    lead_tag_added: "Tag Added",
    appointment_booked: "Appointment Booked",
    appointment_rescheduled: "Rescheduled",
    appointment_no_show: "No Show",
    appointment_completed: "Completed",
    payment_received: "Payment Received",
    time_delay: "Time Delay",
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Automations</CardTitle>
            <CardDescription>
              Manage automated workflows triggered by events
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTrigger}
              disabled={testingTrigger}
            >
              {testingTrigger ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Trigger
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Automation
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !automations?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No automations yet. Click "New Automation" to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((automation) => (
                <TableRow key={automation.id}>
                  <TableCell className="font-medium">
                    {automation.name}
                    {automation.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                        {automation.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {triggerTypeLabels[automation.trigger_type as TriggerType] || automation.trigger_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: automation.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(automation.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(automation)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AutomationFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        teamId={teamId}
        automation={editingAutomation}
      />
    </Card>
  );
}
