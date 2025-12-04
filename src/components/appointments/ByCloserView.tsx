import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DealCard } from "./DealCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TodaysDashboard } from "./TodaysDashboard";
import { DroppableStageColumn } from "./DroppableStageColumn";
import { RescheduleDialog } from "./RescheduleDialog";
import { RescheduleWithLinkDialog } from "./RescheduleWithLinkDialog";
import { FollowUpDialog } from "./FollowUpDialog";
import { DepositCollectedDialog } from "./DepositCollectedDialog";
import { DateRangeFilter, DateRangePreset } from "@/components/DateRangeFilter";
import { useUndoAction } from "@/hooks/useUndoAction";
import { toast } from "sonner";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { BulkAssignCloser } from "./BulkAssignCloser";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

interface ByCloserViewProps {
  teamId: string;
  onCloseDeal: (appointment: any, undoHandlers?: any) => void;
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

interface CloserPipelineViewProps {
  group: CloserGroup;
  stages: PipelineStage[];
  teamId: string;
  onReload: () => Promise<void>;
  onCloseDeal: (appointment: any, undoHandlers?: any) => void;
}

function CloserPipelineView({ group, stages, teamId, onReload, onCloseDeal }: CloserPipelineViewProps) {
  const [confirmationTasks, setConfirmationTasks] = useState<Map<string, any>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string } | null>(null);
  const [rescheduleLinkDialog, setRescheduleLinkDialog] = useState<{ open: boolean; appointmentId: string; rescheduleUrl: string; dealName: string } | null>(null);
  const [followUpDialog, setFollowUpDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string; stage: "cancelled" | "no_show" } | null>(null);
  const [depositDialog, setDepositDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string } | null>(null);
  
  const { trackAction, showUndoToast } = useUndoAction(() => {
    onReload();
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Load confirmation tasks for all appointments
  useEffect(() => {
    loadConfirmationTasks();
  }, [group.appointments]);
  
  const loadConfirmationTasks = async () => {
    if (!group.appointments || group.appointments.length === 0) return;
    
    const appointmentIds = group.appointments.map(a => a.id);
    const { data: tasks } = await supabase
      .from('confirmation_tasks')
      .select('*')
      .in('appointment_id', appointmentIds);
    
    const tasksMap = new Map();
    tasks?.forEach(task => {
      tasksMap.set(task.appointment_id, task);
    });
    setConfirmationTasks(tasksMap);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    let targetStageId = over.id as string;
    
    // Map "appointments_booked" droppable ID to actual "booked" stage
    if (targetStageId === 'appointments_booked') {
      targetStageId = 'booked';
    }
    
    const appointment = group.appointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    // Check if the stage is actually changing
    const currentStage = appointment.pipeline_stage || 'booked';
    if (currentStage === targetStageId) return;

    // Find target stage data for special handling
    const targetStage = stages.find(s => s.stage_id === targetStageId);
    
    // Check if moving to won/closed stage - open close deal dialog
    const isClosedStage = targetStage && 
      (targetStage.stage_id === 'won' || 
       targetStage.stage_label.toLowerCase().includes('won') || 
       targetStage.stage_label.toLowerCase().includes('closed') ||
       targetStage.stage_label.toLowerCase().includes('close'));
    
    if (isClosedStage) {
      // Move to closed stage first
      await performStageMove(appointmentId, targetStageId, appointment);
      // Open close deal dialog
      onCloseDeal({ ...appointment, pipeline_stage: targetStageId }, { trackAction, showUndoToast });
      return;
    }

    // Check if moving to rescheduled
    if (targetStageId === "rescheduled") {
      // If reschedule URL is available, open the link dialog
      if (appointment.reschedule_url) {
        setRescheduleLinkDialog({
          open: true,
          appointmentId,
          rescheduleUrl: appointment.reschedule_url,
          dealName: appointment.lead_name
        });
        return;
      }
      
      // Check if we can fetch the reschedule URL
      if (!appointment.calendly_invitee_uri) {
        toast.error("This appointment was imported before reschedule links were tracked. Please re-import appointments from Calendly in Team Settings.", { duration: 5000 });
        return;
      }

      // Fetch reschedule URL from Calendly on-demand
      toast.loading("Fetching reschedule link...", { id: 'fetch-reschedule' });
      try {
        const { data: teamData } = await supabase
          .from('teams')
          .select('calendly_access_token')
          .eq('id', teamId)
          .single();

        if (!teamData?.calendly_access_token) {
          toast.error("Calendly not configured for this team", { id: 'fetch-reschedule' });
          return;
        }

        const response = await fetch(appointment.calendly_invitee_uri, {
          headers: {
            'Authorization': `Bearer ${teamData.calendly_access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch from Calendly');

        const data = await response.json();
        const rescheduleUrl = data.resource?.reschedule_url;

        if (!rescheduleUrl) {
          toast.error("No reschedule link available for this appointment", { id: 'fetch-reschedule' });
          return;
        }

        await supabase
          .from('appointments')
          .update({ reschedule_url: rescheduleUrl })
          .eq('id', appointmentId);

        toast.success("Reschedule link fetched!", { id: 'fetch-reschedule' });

        setRescheduleLinkDialog({
          open: true,
          appointmentId,
          rescheduleUrl,
          dealName: appointment.lead_name
        });
      } catch (error) {
        console.error("Error fetching reschedule URL:", error);
        toast.error("Failed to fetch reschedule link from Calendly", { id: 'fetch-reschedule' });
      }
      return;
    }

    // Check for canceled or no-show
    if (targetStageId === "canceled" || targetStageId === "no_show") {
      setFollowUpDialog({ 
        open: true, 
        appointmentId, 
        stageId: targetStageId,
        dealName: appointment.lead_name,
        stage: targetStageId === "canceled" ? "cancelled" : "no_show"
      });
      return;
    }

    // Check if moving to deposit stage
    if (targetStageId === "deposit" || targetStage?.stage_label.toLowerCase().includes("deposit")) {
      setDepositDialog({
        open: true,
        appointmentId,
        stageId: targetStageId,
        dealName: appointment.lead_name
      });
      return;
    }

    // Track the action for undo
    trackAction({
      table: "appointments",
      recordId: appointmentId,
      previousData: { 
        pipeline_stage: appointment.pipeline_stage,
        status: appointment.status,
        cc_collected: appointment.cc_collected,
        mrr_amount: appointment.mrr_amount,
        mrr_months: appointment.mrr_months,
        product_name: appointment.product_name,
      },
      description: `Moved ${appointment.lead_name} to ${targetStage?.stage_label || targetStageId}`,
    });

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ pipeline_stage: targetStageId })
        .eq('id', appointmentId);

      if (error) throw error;

      const stageName = targetStage?.stage_label || targetStageId;
      showUndoToast(`Moved ${appointment.lead_name} to ${stageName}`);
      
      await onReload();
    } catch (error) {
      console.error('Error moving appointment:', error);
      toast.error('Failed to move appointment');
      await onReload();
    }
  };

  const performStageMove = async (
    appointmentId: string, 
    newStageId: string, 
    appointment: any,
    additionalData?: { rescheduleDate?: Date; followUpDate?: Date; followUpReason?: string }
  ) => {
    try {
      const updateData: any = { pipeline_stage: newStageId };
      
      if (newStageId === "rescheduled" && additionalData?.rescheduleDate) {
        updateData.retarget_date = format(additionalData.rescheduleDate, "yyyy-MM-dd");
        updateData.retarget_reason = "Rescheduled by user";
      }

      if (additionalData?.followUpDate && additionalData?.followUpReason) {
        updateData.retarget_date = format(additionalData.followUpDate, "yyyy-MM-dd");
        updateData.retarget_reason = additionalData.followUpReason;
      }

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (error) throw error;

      // Cleanup confirmation tasks for terminal stages
      const terminalStages = ['rescheduled', 'cancelled', 'no_show', 'won', 'closed', 'lost', 'disqualified'];
      if (terminalStages.includes(newStageId)) {
        await supabase.rpc('cleanup_confirmation_tasks', {
          p_appointment_id: appointmentId,
          p_reason: `Moved to ${newStageId} stage`
        });
      }

      if (additionalData?.rescheduleDate) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "reschedule",
          p_follow_up_date: null,
          p_follow_up_reason: null,
          p_reschedule_date: format(additionalData.rescheduleDate, "yyyy-MM-dd")
        });
      } else if (additionalData?.followUpDate && additionalData?.followUpReason) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(additionalData.followUpDate, "yyyy-MM-dd"),
          p_follow_up_reason: additionalData.followUpReason,
          p_reschedule_date: null
        });
      }

      toast.success("Deal moved successfully");
      await onReload();
    } catch (error: any) {
      console.error("Error moving deal:", error);
      toast.error(error.message || "Failed to move deal");
    }
  };

  const handleUndo = async (appointmentId: string) => {
    const appointment = group.appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const currentStage = appointment.pipeline_stage?.toLowerCase() || '';
    const isDepositOrClosed = 
      currentStage === 'deposit' || 
      currentStage === 'won' || 
      currentStage.includes('deposit') ||
      currentStage.includes('closed') ||
      currentStage.includes('won');

    if (isDepositOrClosed) {
      if (!confirm(`Reset ${appointment.lead_name} back to a fresh booked appointment? This will clear all deposit/sale details.`)) {
        return;
      }

      try {
        // Delete related financial records
        await supabase
          .from('mrr_commissions')
          .delete()
          .match({
            team_id: appointment.team_id,
            prospect_email: appointment.lead_email
          });

        await supabase
          .from('sales')
          .delete()
          .match({
            team_id: appointment.team_id,
            customer_name: appointment.lead_name
          });

        // Reset appointment to booked
        await supabase
          .from('appointments')
          .update({
            pipeline_stage: 'booked',
            status: 'NEW',
            cc_collected: 0,
            revenue: 0,
            mrr_amount: 0,
            mrr_months: 0,
            product_name: null
          })
          .eq('id', appointmentId);

        toast.success('Deal reset to booked successfully');
        await onReload();
      } catch (error) {
        console.error('Error resetting deal:', error);
        toast.error('Failed to reset deal');
      }
    } else {
      // Just move back to booked for non-closed deals
      if (!confirm(`Move ${appointment.lead_name} back to Appointments Booked?`)) {
        return;
      }

      try {
        await supabase
          .from('appointments')
          .update({ pipeline_stage: 'booked' })
          .eq('id', appointmentId);

        toast.success('Deal moved back to booked');
        await onReload();
      } catch (error) {
        console.error('Error moving deal:', error);
        toast.error('Failed to move deal');
      }
    }
  };
  
  // Group appointments by stage for the selected closer
  const dealsByStage = useMemo(() => {
    if (!group || stages.length === 0) return new Map();

    const grouped = new Map<string, any[]>();
    
    // Initialize all stages with empty arrays (except 'booked' which we'll handle separately)
    stages.forEach(stage => {
      if (stage.stage_id !== 'booked') {
        grouped.set(stage.stage_id, []);
      }
    });

    // Add single "Appointments Booked" stage for NEW and BOOKED appointments
    grouped.set('appointments_booked', []);

    // Group appointments
    group.appointments.forEach(apt => {
      // NEW and BOOKED appointments go to "Appointments Booked"
      if (!apt.pipeline_stage || apt.pipeline_stage === 'new' || apt.pipeline_stage === 'booked') {
        grouped.get('appointments_booked')!.push(apt);
      } else if (apt.pipeline_stage === 'rescheduled' || apt.status === 'RESCHEDULED') {
        // Rescheduled appointments appear in BOTH "Appointments Booked" (with tag) AND "rescheduled" stage
        grouped.get('appointments_booked')!.push(apt);
        if (!grouped.has('rescheduled')) {
          grouped.set('rescheduled', []);
        }
        grouped.get('rescheduled')!.push(apt);
      } else {
        // Other appointments go to their pipeline stage
        const stageId = apt.pipeline_stage;
        if (!grouped.has(stageId)) {
          grouped.set(stageId, []);
        }
        grouped.get(stageId)!.push(apt);
      }
    });

    return grouped;
  }, [group, stages, confirmationTasks]);

  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Build ordered stages for mobile view
  const orderedStages = [
    { id: 'appointments_booked', stage_id: 'appointments_booked', stage_label: 'Appointments Booked', stage_color: 'hsl(var(--primary))', order_index: -1 },
    ...stages.filter(s => s.stage_id !== 'booked')
  ];
  
  const selectedStage = orderedStages[selectedStageIndex];
  const mobileStageDeals = selectedStage.stage_id === 'appointments_booked' 
    ? dealsByStage.get('appointments_booked') || []
    : dealsByStage.get(selectedStage.stage_id) || [];

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Mobile Pipeline View */}
        <div className="md:hidden flex flex-col">
          {/* Stage Selector - compact app-like tabs */}
          <div className="flex items-center gap-1 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setSelectedStageIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedStageIndex === 0}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>

            <ScrollArea className="flex-1">
              <div className="flex gap-1 pb-0.5">
                {orderedStages.map((stage, index) => {
                  const count = stage.stage_id === 'appointments_booked' 
                    ? dealsByStage.get('appointments_booked')?.length || 0
                    : dealsByStage.get(stage.stage_id)?.length || 0;
                  const isSelected = index === selectedStageIndex;
                  
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedStageIndex(index)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                      style={isSelected && stage.stage_id !== 'appointments_booked' ? {
                        backgroundColor: stage.stage_color,
                        color: 'white'
                      } : undefined}
                    >
                      <span className="truncate max-w-[60px]">{stage.stage_label}</span>
                      <span className={cn(
                        "text-[9px] font-bold",
                        isSelected ? "opacity-80" : "opacity-60"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setSelectedStageIndex(prev => Math.min(orderedStages.length - 1, prev + 1))}
              disabled={selectedStageIndex === orderedStages.length - 1}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Stage Header - minimal */}
          <div 
            className="mb-2 px-2 py-1.5 rounded-lg border-l-2"
            style={{ 
              borderLeftColor: selectedStage.stage_id === 'appointments_booked' 
                ? 'hsl(var(--primary))' 
                : selectedStage.stage_color,
              backgroundColor: selectedStage.stage_id === 'appointments_booked'
                ? 'hsl(var(--primary) / 0.08)'
                : `${selectedStage.stage_color}10`
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px]">{selectedStage.stage_label}</span>
              <span className="text-[10px] text-muted-foreground">
                {mobileStageDeals.length} {mobileStageDeals.length === 1 ? 'deal' : 'deals'}
              </span>
            </div>
          </div>

          {/* Appointments List */}
          <div className="space-y-2 pb-3">
            {mobileStageDeals.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground">
                No deals in this stage
              </div>
            ) : (
              mobileStageDeals.map((appointment) => (
                <DealCard
                  key={appointment.id}
                  id={appointment.id}
                  teamId={teamId}
                  appointment={appointment}
                  confirmationTask={confirmationTasks.get(appointment.id)}
                  onCloseDeal={() => onCloseDeal(appointment, { trackAction, showUndoToast })}
                  onMoveTo={() => {}}
                  onUndo={handleUndo}
                  userRole="closer"
                />
              ))
            )}
          </div>

          {/* Quick stage navigation dots */}
          <div className="flex justify-center gap-1 pt-1.5 pb-0.5">
            {orderedStages.map((stage, index) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageIndex(index)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  index === selectedStageIndex
                    ? "bg-primary w-3"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                )}
                aria-label={`Go to ${stage.stage_label}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Pipeline View */}
        <ScrollArea className="w-full hidden md:block">
          <div className="flex gap-4 pb-4">
            {/* Appointments Booked Stage */}
            <DroppableStageColumn id="appointments_booked">
              <Card className="h-full">
                <div className="p-4 border-b bg-primary/10 border-b-primary">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Appointments Booked</h3>
                    <Badge variant="secondary">
                      {dealsByStage.get('appointments_booked')?.length || 0}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 space-y-3 min-h-[200px]">
                  {dealsByStage.get('appointments_booked')?.map(appointment => (
                    <DealCard
                      key={appointment.id}
                      id={appointment.id}
                      teamId={teamId}
                      appointment={appointment}
                      confirmationTask={confirmationTasks.get(appointment.id)}
                      onCloseDeal={() => onCloseDeal(appointment, { trackAction, showUndoToast })}
                      onMoveTo={() => {}}
                      onUndo={handleUndo}
                      userRole="closer"
                    />
                  ))}
                  {(!dealsByStage.get('appointments_booked') || dealsByStage.get('appointments_booked')?.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">No deals</p>
                  )}
                </div>
              </Card>
            </DroppableStageColumn>

            {/* Pipeline Stages */}
            {stages
              .filter(stage => stage.stage_id !== 'booked')
              .map(stage => (
              <DroppableStageColumn key={stage.stage_id} id={stage.stage_id}>
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
                        confirmationTask={confirmationTasks.get(appointment.id)}
                        onCloseDeal={() => onCloseDeal(appointment, { trackAction, showUndoToast })}
                        onMoveTo={() => {}}
                        onUndo={handleUndo}
                        userRole="closer"
                      />
                    ))}
                    {(!dealsByStage.get(stage.stage_id) || dealsByStage.get(stage.stage_id)?.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">No deals</p>
                    )}
                  </div>
                </Card>
              </DroppableStageColumn>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-50">
              <DealCard
                id={activeId}
                teamId={teamId}
                appointment={group.appointments.find(a => a.id === activeId)!}
                confirmationTask={confirmationTasks.get(activeId)}
                onCloseDeal={() => {}}
                onMoveTo={() => {}}
                onUndo={handleUndo}
                userRole="closer"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      {rescheduleLinkDialog && (
        <RescheduleWithLinkDialog
          open={rescheduleLinkDialog.open}
          onOpenChange={(open) => !open && setRescheduleLinkDialog(null)}
          appointmentId={rescheduleLinkDialog.appointmentId}
          rescheduleUrl={rescheduleLinkDialog.rescheduleUrl}
          appointmentName={rescheduleLinkDialog.dealName}
          onConfirm={async (reason, notes) => {
            await performStageMove(rescheduleLinkDialog.appointmentId, "rescheduled", 
              group.appointments.find(a => a.id === rescheduleLinkDialog.appointmentId)!);
            setRescheduleLinkDialog(null);
          }}
        />
      )}

      {followUpDialog && (
        <FollowUpDialog
          open={followUpDialog.open}
          onOpenChange={(open) => !open && setFollowUpDialog(null)}
          dealName={followUpDialog.dealName}
          stage={followUpDialog.stage}
          teamId={teamId}
          onConfirm={async (date, reason) => {
            await performStageMove(
              followUpDialog.appointmentId, 
              followUpDialog.stageId,
              group.appointments.find(a => a.id === followUpDialog.appointmentId)!,
              { followUpDate: date, followUpReason: reason }
            );
            setFollowUpDialog(null);
          }}
          onSkip={async () => {
            await performStageMove(
              followUpDialog.appointmentId, 
              followUpDialog.stageId,
              group.appointments.find(a => a.id === followUpDialog.appointmentId)!
            );
            setFollowUpDialog(null);
          }}
        />
      )}

      {depositDialog && (
        <DepositCollectedDialog
          open={depositDialog.open}
          onOpenChange={(open) => !open && setDepositDialog(null)}
          dealName={depositDialog.dealName}
          onConfirm={async (amount, notes, followUpDate) => {
            await performStageMove(depositDialog.appointmentId, depositDialog.stageId,
              group.appointments.find(a => a.id === depositDialog.appointmentId)!);
            setDepositDialog(null);
          }}
        />
      )}
    </>
  );
}

export function ByCloserView({ teamId, onCloseDeal }: ByCloserViewProps) {
  const [loading, setLoading] = useState(true);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [dateFilter, setDateFilter] = useState<{ from: Date | null; to: Date | null; preset: DateRangePreset }>({ from: null, to: null, preset: "alltime" });

  useEffect(() => {
    loadData();
  }, [teamId]);

  // Wrap onCloseDeal to reload data after closing
  const handleCloseDeal = async (appointment: any, undoHandlers?: any) => {
    await onCloseDeal(appointment, undoHandlers);
    // Reload to show updated revenue on cards
    await loadCloserGroups();
  };

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

      // Get all appointments with closers assigned - filter by closer_id AND closer_name (NULL safety)
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('closer_id', 'is', null)
        .not('closer_name', 'is', null)
        .order('start_at_utc', { ascending: true });

      if (error) throw error;
      setAllAppointments(appointments || []);
    } catch (error) {
      console.error('Error loading closer groups:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and group appointments by closer with date filter
  const closerGroups = useMemo(() => {
    // Apply date filter
    let filtered = allAppointments;
    if (dateFilter.from || dateFilter.to) {
      filtered = allAppointments.filter(apt => {
        const appointmentDate = parseISO(apt.start_at_utc);
        if (dateFilter.from && dateFilter.to) {
          return isWithinInterval(appointmentDate, {
            start: startOfDay(dateFilter.from),
            end: endOfDay(dateFilter.to),
          });
        } else if (dateFilter.from) {
          return appointmentDate >= startOfDay(dateFilter.from);
        } else if (dateFilter.to) {
          return appointmentDate <= endOfDay(dateFilter.to);
        }
        return true;
      });
    }

    // Group by closer
    const groups = new Map<string, any[]>();
    filtered.forEach(apt => {
      if (!apt.closer_id) return;
      const closerId = apt.closer_id;
      if (!groups.has(closerId)) {
        groups.set(closerId, []);
      }
      groups.get(closerId)!.push(apt);
    });

    // Calculate stats for each closer
    const closerData: CloserGroup[] = Array.from(groups.entries()).map(([closerId, apts]) => {
      // Define what counts as "lost" leads that shouldn't be in stats
      const lostStatuses = ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
      const lostStages = ['cancelled', 'no_show', 'disqualified', 'lost', 'rescheduled'];
      
      // Filter out lost/inactive leads for stats
      const activeOrClosedApts = apts.filter(a => 
        !lostStatuses.includes(a.status) && 
        !lostStages.includes(a.pipeline_stage?.toLowerCase())
      );
      
      // In pipeline: active appointments not yet closed
      const inPipeline = activeOrClosedApts.filter(a => 
        a.status !== 'CLOSED' && 
        a.pipeline_stage !== 'won' &&
        !(a.cc_collected && a.cc_collected > 0)
      ).length;
      
      // Closed: appointments with CLOSED status or won stage or has revenue
      const closed = activeOrClosedApts.filter(a => 
        a.status === 'CLOSED' || 
        a.pipeline_stage === 'won' ||
        (a.cc_collected && a.cc_collected > 0)
      ).length;
      
      const revenue = apts.reduce((sum, a) => sum + (Number(a.cc_collected) || 0), 0);

      return {
        closerId,
        closerName: apts[0].closer_name || 'Unknown',
        appointments: apts,
        stats: {
          total: inPipeline + closed, // Only count active + closed, not lost leads
          inPipeline,
          closed,
          revenue,
        },
      };
    });

    // Sort by total appointments descending
    closerData.sort((a, b) => b.stats.total - a.stats.total);

    // Set selected closer if not set
    if (closerData.length > 0 && !selectedCloser) {
      setSelectedCloser(closerData[0].closerId);
    }

    return closerData;
  }, [allAppointments, dateFilter, selectedCloser]);

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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-lg md:rounded-xl p-3 md:p-6 border border-accent/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base md:text-xl font-bold">By Closer View</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">See each closer's pipeline and deals</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <DateRangeFilter onRangeChange={setDateFilter} />
            </div>
            {selectedCloser && (
              <BulkAssignCloser
                teamId={teamId}
                closerId={selectedCloser}
                closerName={closerGroups.find(g => g.closerId === selectedCloser)?.closerName || ""}
                onComplete={() => loadData()}
              />
            )}
          </div>
        </div>
      </div>

      <Tabs value={selectedCloser || undefined} onValueChange={setSelectedCloser}>
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-auto p-1 md:p-2 flex-wrap gap-1 md:gap-2">
            {closerGroups.map(group => (
              <TabsTrigger 
                key={group.closerId} 
                value={group.closerId}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm data-[state=active]:bg-accent"
              >
                <Avatar className="h-4 w-4 md:h-6 md:w-6">
                  <AvatarFallback className="text-[10px] md:text-xs bg-primary/10">
                    {group.closerName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[60px] md:max-w-none truncate">{group.closerName}</span>
                <Badge variant="secondary" className="ml-0.5 md:ml-1 text-[10px] md:text-xs px-1 md:px-1.5 py-0">
                  {group.stats.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {closerGroups.map(group => (
          <TabsContent key={group.closerId} value={group.closerId} className="mt-4 md:mt-6">
            {/* Today's Schedule for this Closer */}
            <div className="mb-4 md:mb-8">
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Today's Schedule - {group.closerName}</h3>
              <TodaysDashboard 
                teamId={teamId} 
                userRole="closer"
                viewingAsCloserId={group.closerId}
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-1.5 md:gap-4 mb-4 md:mb-6">
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Total Deals</p>
                <p className="text-sm md:text-2xl font-bold">{group.stats.total}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">In Pipeline</p>
                <p className="text-sm md:text-2xl font-bold">{group.stats.inPipeline}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Closed</p>
                <p className="text-sm md:text-2xl font-bold text-green-600">{group.stats.closed}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Revenue</p>
                <p className="text-sm md:text-2xl font-bold">${group.stats.revenue.toLocaleString()}</p>
              </Card>
            </div>

            {/* Pipeline View */}
            <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Full Pipeline</h3>
            {group.closerId === selectedCloser && (
              <CloserPipelineView 
                group={group} 
                stages={stages} 
                teamId={teamId}
                onReload={loadCloserGroups}
                onCloseDeal={handleCloseDeal}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
