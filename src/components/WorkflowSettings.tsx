import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorUtils";
import { Loader2 } from "lucide-react";
import { ConfirmationScheduleSettings } from "@/components/ConfirmationScheduleSettings";
import { TaskRoutingSettings } from "@/components/TaskRoutingSettings";

interface WorkflowSettingsProps {
  teamId: string;
}

export function WorkflowSettings({ teamId }: WorkflowSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);
  const [allowSetterPipelineUpdates, setAllowSetterPipelineUpdates] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("auto_create_tasks, allow_setter_pipeline_updates")
        .eq("id", teamId)
        .single();

      if (error) throw error;
      if (data) {
        setAutoCreateTasks(data.auto_create_tasks ?? true);
        setAllowSetterPipelineUpdates(data.allow_setter_pipeline_updates ?? false);
      }
    } catch (error: any) {
      toast({
        title: "Error loading settings",
        description: getUserFriendlyError(error),
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
          auto_create_tasks: autoCreateTasks,
          allow_setter_pipeline_updates: allowSetterPipelineUpdates
        })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Workflow settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Settings</CardTitle>
          <CardDescription>
            Configure how your team's workflows operate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="auto-tasks" className="text-base font-medium">
                Auto-create confirmation tasks
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, new appointments automatically create confirmation tasks for setters. 
                Disable this if your offer doesn't need call confirmations.
              </p>
            </div>
            <Switch
              id="auto-tasks"
              checked={autoCreateTasks}
              onCheckedChange={setAutoCreateTasks}
            />
          </div>

          <div className="flex items-center justify-between space-x-4 pt-4 border-t">
            <div className="flex-1 space-y-1">
              <Label htmlFor="setter-pipeline" className="text-base font-medium">
                Allow setters to move leads in pipeline
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, setters can drag and drop leads between pipeline stages. 
                Disable this to restrict pipeline management to closers and admins only.
              </p>
            </div>
            <Switch
              id="setter-pipeline"
              checked={allowSetterPipelineUpdates}
              onCheckedChange={setAllowSetterPipelineUpdates}
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <TaskRoutingSettings teamId={teamId} />

      <ConfirmationScheduleSettings teamId={teamId} />
    </div>
  );
}
