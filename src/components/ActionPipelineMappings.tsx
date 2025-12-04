import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorUtils";
import { Loader2, GitBranch, AlertCircle, RotateCcw, PhoneMissed, XCircle, Calendar, Copy } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ActionPipelineMappingsProps {
  teamId: string;
}

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
}

interface ActionMappings {
  double_book: string | null;
  rebook: string | null;
  no_show: string | null;
  cancelled: string | null;
  rescheduled: string | null;
  no_answer: string | null;
}

const ACTION_CONFIG = [
  {
    key: "double_book",
    label: "Double Book Detected",
    description: "When a lead books again before their original appointment",
    icon: Copy,
  },
  {
    key: "rebook",
    label: "Rebook Detected",
    description: "When a lead books again after their original appointment passed",
    icon: RotateCcw,
  },
  {
    key: "no_show",
    label: "No-Show Marked",
    description: "When an appointment is marked as no-show",
    icon: AlertCircle,
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "When an appointment is cancelled",
    icon: XCircle,
  },
  {
    key: "rescheduled",
    label: "Rescheduled",
    description: "When an appointment is rescheduled",
    icon: Calendar,
  },
  {
    key: "no_answer",
    label: "No Answer",
    description: "When a confirmation call goes unanswered",
    icon: PhoneMissed,
  },
];

const DEFAULT_MAPPINGS: ActionMappings = {
  double_book: "booked",
  rebook: "booked",
  no_show: "no_show",
  cancelled: "canceled",
  rescheduled: "rescheduled",
  no_answer: null,
};

export function ActionPipelineMappings({ teamId }: ActionPipelineMappingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [mappings, setMappings] = useState<ActionMappings>(DEFAULT_MAPPINGS);

  useEffect(() => {
    loadData();
  }, [teamId]);

  const loadData = async () => {
    try {
      const [stagesRes, teamRes] = await Promise.all([
        supabase
          .from("team_pipeline_stages")
          .select("*")
          .eq("team_id", teamId)
          .order("order_index"),
        supabase
          .from("teams")
          .select("action_pipeline_mappings")
          .eq("id", teamId)
          .single(),
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (teamRes.error) throw teamRes.error;

      setStages(stagesRes.data || []);
      
      if (teamRes.data?.action_pipeline_mappings) {
        const savedMappings = teamRes.data.action_pipeline_mappings as Record<string, string | null>;
        setMappings({
          ...DEFAULT_MAPPINGS,
          ...savedMappings,
        } as ActionMappings);
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
      const mappingsJson: Json = mappings as unknown as Json;
      const { error } = await supabase
        .from("teams")
        .update({ action_pipeline_mappings: mappingsJson })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Mappings saved",
        description: "Action pipeline mappings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving mappings",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (actionKey: string, stageId: string | null) => {
    setMappings((prev) => ({
      ...prev,
      [actionKey]: stageId === "none" ? null : stageId,
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <CardTitle>Action Pipeline Mappings</CardTitle>
        </div>
        <CardDescription>
          Configure which pipeline stage leads move to when specific actions occur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {ACTION_CONFIG.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{action.label}</Label>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </div>
              <Select
                value={mappings[action.key as keyof ActionMappings] || "none"}
                onValueChange={(value) => updateMapping(action.key, value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No change</span>
                  </SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.stage_id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.stage_color }}
                        />
                        {stage.stage_label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Mappings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
