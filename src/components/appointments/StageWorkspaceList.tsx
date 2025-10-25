import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
}

interface StageWithCount extends PipelineStage {
  count: number;
}

interface StageWorkspaceListProps {
  teamId: string;
  onSelectStage: (stageId: string, stageName: string, stageColor: string) => void;
}

export function StageWorkspaceList({ teamId, onSelectStage }: StageWorkspaceListProps) {
  const [stages, setStages] = useState<StageWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStagesWithCounts();

    const channel = supabase
      .channel('stage-counts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => loadStagesWithCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadStagesWithCounts = async () => {
    try {
      const { data: stagesData, error: stagesError } = await supabase
        .from('team_pipeline_stages')
        .select('*')
        .eq('team_id', teamId)
        .order('order_index', { ascending: true });

      if (stagesError) throw stagesError;

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('pipeline_stage')
        .eq('team_id', teamId);

      if (appointmentsError) throw appointmentsError;

      const stageCounts = (appointmentsData || []).reduce((acc, apt) => {
        const stage = apt.pipeline_stage || 'unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const stagesWithCounts = (stagesData || []).map(stage => ({
        ...stage,
        count: stageCounts[stage.stage_id] || 0
      }));

      setStages(stagesWithCounts);
    } catch (error) {
      console.error('Error loading stages:', error);
      toast.error('Failed to load pipeline stages');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">All Pipeline Stages</h2>
      
      <div className="space-y-2">
        {stages.map((stage) => (
          <Card 
            key={stage.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectStage(stage.stage_id, stage.stage_label, stage.stage_color)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: stage.stage_color }}
                />
                <span className="font-medium">{stage.stage_label}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {stage.count}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stages.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No pipeline stages configured. Contact an admin to set up stages.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
