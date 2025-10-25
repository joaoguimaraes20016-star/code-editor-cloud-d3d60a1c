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
          ⚙️ Manage Pipeline
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {stages.map((stage) => {
            const stageAppointments = dealsByStage[stage.stage_id] || [];
            const stageValue = stageAppointments.reduce(
              (sum, apt) => sum + (apt.cc_collected || 0) + (apt.mrr_amount || 0) * 12,
              0
            );

            const colorClasses = {
              blue: "border-blue-200 dark:border-blue-800",
              purple: "border-purple-200 dark:border-purple-800",
              indigo: "border-indigo-200 dark:border-indigo-800",
              cyan: "border-cyan-200 dark:border-cyan-800",
              amber: "border-amber-200 dark:border-amber-800",
              green: "border-green-200 dark:border-green-800",
              red: "border-red-200 dark:border-red-800",
              orange: "border-orange-200 dark:border-orange-800",
              pink: "border-pink-200 dark:border-pink-800",
              teal: "border-teal-200 dark:border-teal-800",
            };

            const headerColorClasses = {
              blue: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30",
              purple: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30",
              indigo: "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30",
              cyan: "bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/30",
              amber: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30",
              green: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30",
              red: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30",
              orange: "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30",
              pink: "bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/50 dark:to-pink-900/30",
              teal: "bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/50 dark:to-teal-900/30",
            };

            return (
              <Card
                key={stage.id}
                className={`flex flex-col max-w-[320px] ${
                  colorClasses[stage.stage_color as keyof typeof colorClasses] || colorClasses.blue
                }`}
              >
                <div
                  className={`p-4 rounded-t-lg border-b sticky top-0 z-10 ${
                    headerColorClasses[stage.stage_color as keyof typeof headerColorClasses] ||
                    headerColorClasses.blue
                  }`}
                >
                  <h3 className="font-bold text-lg mb-2">{stage.stage_label}</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stageAppointments.length} deals</span>
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
                    <div className="space-y-3 min-h-[120px]">
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
                        <div className="text-center py-12 text-muted-foreground text-sm">
                          No deals yet
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
            <Card className="p-4 opacity-90 rotate-2 shadow-2xl scale-105">
              <div className="font-semibold text-base">
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
