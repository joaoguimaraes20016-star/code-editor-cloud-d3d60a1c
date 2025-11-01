import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealCard } from "./DealCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ByCloserViewProps {
  teamId: string;
}

interface CloserGroup {
  closerId: string;
  closerName: string;
  appointments: any[];
  stats: {
    total: number;
    inPipeline: number;
    closed: number;
    revenue: number;
  };
}

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
}

export function ByCloserView({ teamId }: ByCloserViewProps) {
  const [loading, setLoading] = useState(true);
  const [closerGroups, setCloserGroups] = useState<CloserGroup[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    loadData();
  }, [teamId]);

  const loadData = async () => {
    await Promise.all([loadStages(), loadCloserGroups()]);
  };

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from('team_pipeline_stages')
        .select('*')
        .eq('team_id', teamId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error('Error loading stages:', error);
    }
  };

  const loadCloserGroups = async () => {
    try {
      setLoading(true);

      // Get all appointments with closers assigned
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('closer_name', 'is', null)
        .order('start_at_utc', { ascending: true });

      if (error) throw error;

      // Group by closer
      const groups = new Map<string, any[]>();
      
      appointments?.forEach(apt => {
        const closerId = apt.closer_id || apt.closer_name;
        if (!groups.has(closerId)) {
          groups.set(closerId, []);
        }
        groups.get(closerId)!.push(apt);
      });

      // Calculate stats for each closer
      const closerData: CloserGroup[] = Array.from(groups.entries()).map(([closerId, apts]) => {
        const inPipeline = apts.filter(a => a.status === 'showed' && (!a.cc_collected || a.cc_collected === 0)).length;
        const closed = apts.filter(a => a.cc_collected && a.cc_collected > 0).length;
        const revenue = apts.reduce((sum, a) => sum + (Number(a.cc_collected) || 0), 0);

        return {
          closerId,
          closerName: apts[0].closer_name || 'Unknown',
          appointments: apts,
          stats: {
            total: apts.length,
            inPipeline,
            closed,
            revenue,
          },
        };
      });

      // Sort by total appointments descending
      closerData.sort((a, b) => b.stats.total - a.stats.total);

      setCloserGroups(closerData);
      if (closerData.length > 0 && !selectedCloser) {
        setSelectedCloser(closerData[0].closerId);
      }
    } catch (error) {
      console.error('Error loading closer groups:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (closerGroups.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No closers with appointments found</p>
      </Card>
    );
  }

  const selectedGroup = closerGroups.find(g => g.closerId === selectedCloser);

  // Group appointments by stage for the selected closer
  const dealsByStage = useMemo(() => {
    if (!selectedGroup || stages.length === 0) return new Map();

    const grouped = new Map<string, any[]>();
    
    // Initialize all stages with empty arrays
    stages.forEach(stage => {
      grouped.set(stage.stage_id, []);
    });

    // Add "new" stage for appointments without a stage
    grouped.set('new', []);

    // Group appointments
    selectedGroup.appointments.forEach(apt => {
      const stageId = apt.pipeline_stage || 'new';
      if (!grouped.has(stageId)) {
        grouped.set(stageId, []);
      }
      grouped.get(stageId)!.push(apt);
    });

    return grouped;
  }, [selectedGroup, stages]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-xl p-6 border border-accent/30">
        <h3 className="text-xl font-bold">By Closer View</h3>
        <p className="text-sm text-muted-foreground mt-1">See each closer's pipeline and deals</p>
      </div>

      <Tabs value={selectedCloser || undefined} onValueChange={setSelectedCloser}>
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-auto p-2 flex-wrap gap-2">
            {closerGroups.map(group => (
              <TabsTrigger 
                key={group.closerId} 
                value={group.closerId}
                className="flex items-center gap-2 data-[state=active]:bg-accent"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {group.closerName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{group.closerName}</span>
                <Badge variant="secondary" className="ml-1">
                  {group.stats.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {closerGroups.map(group => (
          <TabsContent key={group.closerId} value={group.closerId} className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{group.stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">In Pipeline</p>
                <p className="text-2xl font-bold">{group.stats.inPipeline}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-green-600">{group.stats.closed}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${group.stats.revenue.toLocaleString()}</p>
              </Card>
            </div>

            {/* Pipeline View */}
            {group.closerId === selectedCloser && (
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {/* New Stage */}
                  <div className="flex-shrink-0" style={{ width: '300px' }}>
                    <Card className="h-full">
                      <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">New</h3>
                          <Badge variant="secondary">
                            {dealsByStage.get('new')?.length || 0}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3 space-y-3 min-h-[200px]">
                        {dealsByStage.get('new')?.map(appointment => (
                          <DealCard
                            key={appointment.id}
                            id={appointment.id}
                            teamId={teamId}
                            appointment={appointment}
                            onCloseDeal={() => {}}
                            onMoveTo={() => {}}
                            userRole="admin"
                          />
                        ))}
                        {(!dealsByStage.get('new') || dealsByStage.get('new')?.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-8">No deals</p>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Pipeline Stages */}
                  {stages.map(stage => (
                    <div key={stage.stage_id} className="flex-shrink-0" style={{ width: '300px' }}>
                      <Card className="h-full">
                        <div 
                          className="p-4 border-b"
                          style={{ 
                            backgroundColor: `${stage.stage_color}15`,
                            borderBottomColor: stage.stage_color
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{stage.stage_label}</h3>
                            <Badge variant="secondary">
                              {dealsByStage.get(stage.stage_id)?.length || 0}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3 space-y-3 min-h-[200px]">
                          {dealsByStage.get(stage.stage_id)?.map(appointment => (
                            <DealCard
                              key={appointment.id}
                              id={appointment.id}
                              teamId={teamId}
                              appointment={appointment}
                              onCloseDeal={() => {}}
                              onMoveTo={() => {}}
                              userRole="admin"
                            />
                          ))}
                          {(!dealsByStage.get(stage.stage_id) || dealsByStage.get(stage.stage_id)?.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-8">No deals</p>
                          )}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
