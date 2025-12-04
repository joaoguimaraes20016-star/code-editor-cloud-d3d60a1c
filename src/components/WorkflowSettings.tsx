import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorUtils";
import { Loader2, Phone, RefreshCw, Settings as SettingsIcon, GitBranch } from "lucide-react";
import { TaskFlowBuilder } from "./TaskFlowBuilder";
import { FollowUpSettings } from "./FollowUpSettings";
import { ActionPipelineMappings } from "./ActionPipelineMappings";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkflowSettingsProps {
  teamId: string;
}

export function WorkflowSettings({ teamId }: WorkflowSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);
  const [allowSetterPipelineUpdates, setAllowSetterPipelineUpdates] = useState(false);
  const [noAnswerCallbackOptions, setNoAnswerCallbackOptions] = useState<number[]>([15, 30, 60, 120]);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("auto_create_tasks, allow_setter_pipeline_updates, no_answer_callback_options")
        .eq("id", teamId)
        .single();

      if (error) throw error;
      if (data) {
        setAutoCreateTasks(data.auto_create_tasks ?? true);
        setAllowSetterPipelineUpdates(data.allow_setter_pipeline_updates ?? false);
        const options = data.no_answer_callback_options as number[] | null;
        setNoAnswerCallbackOptions(Array.isArray(options) ? options : [15, 30, 60, 120]);
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
          allow_setter_pipeline_updates: allowSetterPipelineUpdates,
          no_answer_callback_options: noAnswerCallbackOptions
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
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle>Workflow Settings</CardTitle>
          </div>
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

          <div className="flex items-center justify-between space-x-4 pt-4 border-t">
            <div className="flex-1 space-y-1">
              <Label htmlFor="no-answer-callback" className="text-base font-medium">
                No Answer callback options (minutes)
              </Label>
              <p className="text-sm text-muted-foreground">
                When a call goes unanswered, these preset callback times will be shown. 
                Comma-separated list of minutes (e.g., 15, 30, 60, 120).
              </p>
            </div>
            <Input
              id="no-answer-callback"
              className="w-40"
              value={noAnswerCallbackOptions.join(', ')}
              onChange={(e) => {
                const parsed = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n) && n > 0);
                setNoAnswerCallbackOptions(parsed.length > 0 ? parsed : [30]);
              }}
              placeholder="15, 30, 60, 120"
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

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Call Confirmation Flow</h2>
        </div>
        <Alert>
          <AlertDescription>
            Configure when and who handles call confirmations before appointments. 
            These tasks are automatically created for each appointment.
          </AlertDescription>
        </Alert>
        <TaskFlowBuilder teamId={teamId} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Automated Follow-Up Flows</h2>
        </div>
        <Alert>
          <AlertDescription>
            Set up automatic follow-up tasks for appointments that don't show, cancel, reschedule, or get disqualified.
          </AlertDescription>
        </Alert>
        <FollowUpSettings teamId={teamId} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Action Pipeline Mappings</h2>
        </div>
        <Alert>
          <AlertDescription>
            Configure which pipeline stage leads automatically move to when certain actions occur (rebook, double book, no-show, etc.)
          </AlertDescription>
        </Alert>
        <ActionPipelineMappings teamId={teamId} />
      </div>
    </div>
  );
}
