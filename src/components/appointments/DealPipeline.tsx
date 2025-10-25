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
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
  cc_collected: number | null;
  mrr_amount: number | null;
  setter_name: string | null;
  setter_id: string | null;
  closer_id: string | null;
  closer_name: string | null;
  team_id: string;
  event_type_name: string | null;
  updated_at: string;
  pipeline_stage: string | null;
}

interface DealPipelineProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
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

export function DealPipeline({ teamId, userRole, currentUserId, onCloseDeal }: DealPipelineProps) {
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
      let query = supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .not("closer_id", "is", null);

      // Filter by closer_id for closers (not admins/offer owners)
      if (userRole === 'closer' && currentUserId) {
        query = query.eq('closer_id', currentUserId);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });
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

  const handleCloseDeal = (appointment: Appointment) => {
    onCloseDeal(appointment);
  };

  const getStageColors = (stageId: string) => {
    const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
      'new': { 
        bg: 'bg-blue-500/10 dark:bg-blue-500/20', 
        text: 'text-blue-900 dark:text-blue-100',
        badge: 'bg-blue-500/20 dark:bg-blue-500/30'
      },
      'contacted': { 
        bg: 'bg-purple-500/10 dark:bg-purple-500/20', 
        text: 'text-purple-900 dark:text-purple-100',
        badge: 'bg-purple-500/20 dark:bg-purple-500/30'
      },
      'qualified': { 
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', 
        text: 'text-indigo-900 dark:text-indigo-100',
        badge: 'bg-indigo-500/20 dark:bg-indigo-500/30'
      },
      'won': { 
        bg: 'bg-green-500/10 dark:bg-green-500/20', 
        text: 'text-green-900 dark:text-green-100',
        badge: 'bg-green-500/20 dark:bg-green-500/30'
      },
      'lost': { 
        bg: 'bg-red-500/10 dark:bg-red-500/20', 
        text: 'text-red-900 dark:text-red-100',
        badge: 'bg-red-500/20 dark:bg-red-500/30'
      },
    };
    return colorMap[stageId] || colorMap['new'];
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-lg p-4">
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

      <div className="bg-muted/30 dark:bg-muted/10 rounded-lg p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const stageAppointments = dealsByStage[stage.stage_id] || [];
              const stageValue = stageAppointments.reduce(
                (sum, apt) => sum + (apt.cc_collected || 0) + (apt.mrr_amount || 0) * 12,
                0
              );
              const colors = getStageColors(stage.stage_id);

              return (
                <div key={stage.id} className="flex flex-col flex-shrink-0" style={{ width: '280px' }}>
                  <div className="mb-3 space-y-2">
                    <div className={cn(
                      "inline-flex items-center px-3 py-1.5 rounded-full",
                      colors.badge
                    )}>
                      <span className={cn("text-xs font-bold uppercase tracking-wide", colors.text)}>
                        {stage.stage_label}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        {stageAppointments.length} {stageAppointments.length === 1 ? 'DEAL' : 'DEALS'}
                      </span>
                    </div>
                    
                    {stageValue > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          VALUE
                        </span>
                        <span className="text-sm font-semibold text-primary tabular-nums">
                          ${stageValue.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 340px)' }}>
                    <SortableContext
                      items={stageAppointments.map((apt) => apt.id)}
                      strategy={verticalListSortingStrategy}
                      id={stage.stage_id}
                    >
                      <div className="space-y-3 pb-2 pr-2">
                        {stageAppointments.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-sm text-muted-foreground">
                              No deals in this stage
                            </p>
                          </div>
                        ) : (
                          stageAppointments.map((appointment) => (
                            <DealCard
                              key={appointment.id}
                              id={appointment.id}
                              appointment={appointment}
                              onCloseDeal={handleCloseDeal}
                              onMoveTo={handleMoveTo}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </ScrollArea>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeId && (() => {
              const activeAppointment = filteredAppointments.find(a => a.id === activeId);
              return activeAppointment ? (
                <div className="rotate-3 scale-105">
                  <DealCard
                    id={activeId}
                    appointment={activeAppointment}
                    onCloseDeal={handleCloseDeal}
                    onMoveTo={handleMoveTo}
                  />
                </div>
              ) : null;
            })()}
          </DragOverlay>
        </DndContext>
      </div>

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
