import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealCard } from "./DealCard";
import { PipelineStageManager } from "./PipelineStageManager";
import { AppointmentFilters } from "./AppointmentFilters";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings } from "lucide-react";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
  cc_collected: number | null;
  mrr_amount: number | null;
  setter_name: string | null;
  event_type_name: string | null;
  updated_at: string;
  pipeline_stage: string | null;
}

interface DealPipelineProps {
  teamId: string;
  onCloseDeal: (appointment: Appointment) => void;
}

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
  is_default: boolean;
}

export function DealPipeline({ teamId, onCloseDeal }: DealPipelineProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [managerOpen, setManagerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from("team_pipeline_stages")
        .select("*")
        .eq("team_id", teamId)
        .order("order_index");

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error("Error loading stages:", error);
      toast.error("Failed to load stages");
    }
  };

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .not("closer_id", "is", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading deals:", error);
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
    loadDeals();

    const appointmentsChannel = supabase
      .channel("deal-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadDeals();
        }
      )
      .subscribe();

    const stagesChannel = supabase
      .channel("stage-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_pipeline_stages",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadStages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(stagesChannel);
    };
  }, [teamId]);

  const eventTypes = useMemo(() => {
    const types = new Set(
      appointments
        .map((a) => a.event_type_name)
        .filter((type): type is string => type !== null)
    );
    return Array.from(types);
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const matchesSearch =
        !searchQuery ||
        appointment.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appointment.lead_email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesEventType =
        eventTypeFilter === "all" || appointment.event_type_name === eventTypeFilter;

      return matchesSearch && matchesEventType;
    });
  }, [appointments, searchQuery, eventTypeFilter]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    stages.forEach((stage) => {
      grouped[stage.stage_id] = filteredAppointments.filter(
        (apt) => apt.pipeline_stage === stage.stage_id
      );
    });
    return grouped;
  }, [filteredAppointments, stages]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const appointmentId = active.id as string;
    const newStage = over.id as string;

    setAppointments((prev) =>
      prev.map((app) =>
        app.id === appointmentId ? { ...app, pipeline_stage: newStage } : app
      )
    );

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ pipeline_stage: newStage })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success("Deal moved successfully");
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast.error("Failed to move deal");
      loadDeals();
    }
  };

  const handleMoveTo = async (appointmentId: string, stage: string) => {
    setAppointments((prev) =>
      prev.map((app) =>
        app.id === appointmentId ? { ...app, pipeline_stage: stage } : app
      )
    );

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ pipeline_stage: stage })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success(`Deal moved successfully`);
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast.error("Failed to move deal");
      loadDeals();
    }
  };

  if (loading || stages.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-6 w-24 mb-4" />
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex-1 w-full">
          <AppointmentFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            eventTypeFilter={eventTypeFilter}
            onEventTypeFilterChange={setEventTypeFilter}
            eventTypes={eventTypes}
            onClearFilters={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setEventTypeFilter("all");
            }}
          />
        </div>
        <Button onClick={() => setManagerOpen(true)} variant="outline" className="whitespace-nowrap">
          <Settings className="h-4 w-4 mr-2" />
          Manage Pipeline
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {stages.map((stage) => {
            const stageAppointments = dealsByStage[stage.stage_id] || [];
            const stageValue = stageAppointments.reduce(
              (sum, apt) => sum + (apt.cc_collected || 0) + (apt.mrr_amount || 0) * 12,
              0
            );

            return (
              <Card
                key={stage.id}
                className="flex flex-col max-w-[320px] border-t-4"
                style={{ borderTopColor: `hsl(var(--${stage.stage_color}))` }}
              >
                <div className="p-4 rounded-t-lg border-b bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full bg-${stage.stage_color}-500`} />
                    <h3 className="font-semibold text-sm">{stage.stage_label}</h3>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stageAppointments.length} {stageAppointments.length === 1 ? 'deal' : 'deals'}</span>
                    {stageValue > 0 && (
                      <span className="font-semibold text-foreground">
                        ${stageValue.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1 p-3">
                  <SortableContext
                    items={stageAppointments.map((apt) => apt.id)}
                    strategy={verticalListSortingStrategy}
                    id={stage.stage_id}
                  >
                    <div className="space-y-2 min-h-[100px]">
                      {stageAppointments.map((appointment) => (
                        <DealCard
                          key={appointment.id}
                          id={appointment.id}
                          appointment={appointment}
                          onCloseDeal={onCloseDeal}
                          onMoveTo={handleMoveTo}
                        />
                      ))}
                      {stageAppointments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          No deals
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </Card>
            );
          })}
        </div>

        <DragOverlay>
          {activeId ? (
            <Card className="p-3 opacity-80 shadow-lg border-primary">
              <div className="font-medium text-sm">
                {appointments.find((apt) => apt.id === activeId)?.lead_name}
              </div>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <PipelineStageManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        teamId={teamId}
        onStagesUpdated={() => {
          loadStages();
          loadDeals();
        }}
      />
    </div>
  );
}
