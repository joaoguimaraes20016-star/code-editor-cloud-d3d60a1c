import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Save } from "lucide-react";
import { ConfirmationTimeline } from "./task-flow/ConfirmationTimeline";
import { TaskTypeDefaults } from "./task-flow/TaskTypeDefaults";

interface ConfirmationConfig {
  sequence: number;
  hours_before: number;
  label: string;
  assigned_role: "setter" | "closer" | "off";
  enabled: boolean;
}

interface DefaultTaskRouting {
  follow_up: "setter" | "closer";
  reschedule: "setter" | "closer";
  manual_task: "setter" | "closer";
}

interface TaskFlowBuilderProps {
  teamId: string;
}

export function TaskFlowBuilder({ teamId }: TaskFlowBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flowConfig, setFlowConfig] = useState<ConfirmationConfig[]>([]);
  const [defaultRouting, setDefaultRouting] = useState<DefaultTaskRouting>({
    follow_up: "setter",
    reschedule: "setter",
    manual_task: "closer",
  });

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("confirmation_flow_config, default_task_routing")
        .eq("id", teamId)
        .single();

      if (error) throw error;

      if (data?.confirmation_flow_config) {
        setFlowConfig(data.confirmation_flow_config as unknown as ConfirmationConfig[]);
      }

      if (data?.default_task_routing) {
        setDefaultRouting(data.default_task_routing as unknown as DefaultTaskRouting);
      }
    } catch (error) {
      console.error("Error loading task flow settings:", error);
      toast({
        title: "Error",
        description: "Failed to load task flow settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          confirmation_flow_config: flowConfig as any,
          default_task_routing: defaultRouting as any,
        })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task flow settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving task flow settings:", error);
      toast({
        title: "Error",
        description: "Failed to save task flow settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfirmation = (
    index: number,
    field: keyof ConfirmationConfig,
    value: any
  ) => {
    const updated = [...flowConfig];
    updated[index] = { ...updated[index], [field]: value };
    setFlowConfig(updated);
  };

  const addConfirmation = () => {
    const maxSequence = Math.max(...flowConfig.map((c) => c.sequence), 0);
    const newConfirmation: ConfirmationConfig = {
      sequence: maxSequence + 1,
      hours_before: 12,
      label: "New Confirmation",
      assigned_role: "setter",
      enabled: true,
    };
    setFlowConfig([...flowConfig, newConfirmation]);
  };

  const removeConfirmation = (index: number) => {
    if (flowConfig.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "Must have at least one confirmation",
        variant: "destructive",
      });
      return;
    }
    const updated = flowConfig.filter((_, i) => i !== index);
    // Resequence
    updated.forEach((conf, idx) => {
      conf.sequence = idx + 1;
    });
    setFlowConfig(updated);
  };

  const reorderConfirmations = (newOrder: ConfirmationConfig[]) => {
    // Resequence
    newOrder.forEach((conf, idx) => {
      conf.sequence = idx + 1;
    });
    setFlowConfig(newOrder);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Flow</CardTitle>
          <CardDescription>
            Configure when confirmations happen and who handles them. Visual timeline shows the flow from booking to appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConfirmationTimeline
            confirmations={flowConfig}
            onUpdate={updateConfirmation}
            onRemove={removeConfirmation}
            onReorder={reorderConfirmations}
          />

          <Button
            onClick={addConfirmation}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Confirmation Step
          </Button>
        </CardContent>
      </Card>

      <TaskTypeDefaults
        defaultRouting={defaultRouting}
        onChange={setDefaultRouting}
      />

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Task Flow Configuration
          </>
        )}
      </Button>
    </div>
  );
}
