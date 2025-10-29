import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUndoAction } from "@/hooks/useUndoAction";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  useDroppable,
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
import { Settings, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DroppableStageColumn } from "./DroppableStageColumn";
import { RescheduleDialog } from "./RescheduleDialog";
import { FollowUpDialog } from "./FollowUpDialog";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { DepositCollectedDialog } from "./DepositCollectedDialog";
import { format } from "date-fns";
import { getUserFriendlyError } from "@/lib/errorUtils";


interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
  cc_collected: number | null;
  mrr_amount: number | null;
  mrr_months: number | null;
  product_name: string | null;
  setter_name: string | null;
  setter_id: string | null;
  closer_id: string | null;
  closer_name: string | null;
  team_id: string;
  event_type_name: string | null;
  updated_at: string;
  pipeline_stage: string | null;
  status: string | null;
}

interface DealPipelineProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
  onCloseDeal: (
    appointment: Appointment,
    undoHandlers?: {
      trackAction: (action: { table: string; recordId: string; previousData: Record<string, any>; description: string }) => void;
      showUndoToast: (description: string) => void;
    }
  ) => void;
  viewFilter?: 'all' | string; // 'all' or specific closer_id
}

interface PipelineStage {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_color: string;
  order_index: number;
  is_default: boolean;
}

export function DealPipeline({ teamId, userRole, currentUserId, onCloseDeal, viewFilter = 'all' }: DealPipelineProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"closest" | "furthest">("closest");
  const [managerOpen, setManagerOpen] = useState(false);
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string } | null>(null);
  const [followUpDialog, setFollowUpDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string; stage: "cancelled" | "no_show" } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; appointmentId: string; dealName: string; currentStatus: string | null } | null>(null);
  const [depositDialog, setDepositDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string } | null>(null);
  
  const { trackAction, showUndoToast } = useUndoAction(() => {
    // Refresh appointments after undo
    loadDeals();
  });

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
      console.log("Loading deals for team:", teamId);
      let query = supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .not('pipeline_stage', 'is', null); // Show all appointments in pipeline

      // Apply view filter
      if (viewFilter === 'all') {
        // Show all deals (no filtering) - for admins viewing main pipeline
      } else if (viewFilter) {
        // Filter by specific closer_id
        query = query.eq('closer_id', viewFilter);
      } else if (userRole === 'closer' && currentUserId) {
        // Default: closers see only their own deals
        query = query.eq('closer_id', currentUserId);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });
      console.log("Loaded appointments:", data?.length);
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
      .channel(`deal-changes-${teamId}-${viewFilter}-${Date.now()}`)
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
      .channel(`stage-changes-${teamId}-${Date.now()}`)
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
  }, [teamId, viewFilter, userRole, currentUserId]);

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
      const stageDeals = filteredAppointments.filter(
        (apt) => apt.pipeline_stage === stage.stage_id
      );
      
      // Sort by date within each stage
      stageDeals.sort((a, b) => {
        const dateA = new Date(a.start_at_utc).getTime();
        const dateB = new Date(b.start_at_utc).getTime();
        return sortBy === "closest" ? dateA - dateB : dateB - dateA;
      });
      
      grouped[stage.stage_id] = stageDeals;
    });
    return grouped;
  }, [filteredAppointments, stages, sortBy]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const overId = over.id as string;
    
    // Check if we dropped over a stage or over another card
    const targetStage = stages.find(s => s.stage_id === overId);
    const targetCard = appointments.find(a => a.id === overId);
    
    // Determine the new stage
    const newStage = targetStage ? targetStage.stage_id : (targetCard?.pipeline_stage || null);
    
    if (!newStage) return;

    // Find the appointment being dragged
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment || appointment.pipeline_stage === newStage) return;

    // Check if moving to won/closed stage - open close deal dialog
    const targetStageData = stages.find(s => s.stage_id === newStage);
    const isClosedStage = targetStageData && 
      (targetStageData.stage_id === 'won' || 
       targetStageData.stage_label.toLowerCase().includes('won') || 
       targetStageData.stage_label.toLowerCase().includes('closed') || 
       targetStageData.stage_label.toLowerCase().includes('close'));

    if (isClosedStage) {
      // Move to closed stage
      await performStageMove(appointmentId, newStage, appointment);
      
      // Create follow-up task for the closer
      if (appointment.closer_id) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
          p_follow_up_reason: "Deal closed - Schedule follow-up for retention and upsell"
        });
      }
      
      // Open close deal dialog
      onCloseDeal({ ...appointment, pipeline_stage: newStage }, { trackAction, showUndoToast });
      return;
    }

    // Check if moving to stages that require additional info
    if (newStage === "rescheduled") {
      setRescheduleDialog({ 
        open: true, 
        appointmentId, 
        stageId: newStage,
        dealName: appointment.lead_name 
      });
      return;
    }

    if (newStage === "canceled" || newStage === "no_show") {
      setFollowUpDialog({ 
        open: true, 
        appointmentId, 
        stageId: newStage,
        dealName: appointment.lead_name,
        stage: newStage === "canceled" ? "cancelled" : "no_show"
      });
      return;
    }

    // Check if moving to deposit stage
    if (newStage === "deposit" || targetStageData?.stage_label.toLowerCase().includes("deposit")) {
      setDepositDialog({
        open: true,
        appointmentId,
        stageId: newStage,
        dealName: appointment.lead_name
      });
      return;
    }

    // Optimistically update UI
    setAppointments((prev) =>
      prev.map((app) =>
        app.id === appointmentId ? { ...app, pipeline_stage: newStage } : app
      )
    );

    try {
      // Track the action for undo - capture all relevant fields
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
        description: `Moved ${appointment.lead_name} to ${newStage}`,
      });

      // Update only the pipeline_stage - don't change status or visibility
      const { error } = await supabase
        .from("appointments")
        .update({ pipeline_stage: newStage })
        .eq("id", appointmentId);

      if (error) throw error;

      showUndoToast(`Moved ${appointment.lead_name} to ${newStage}`);
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast.error("Failed to move deal");
      loadDeals();
    }
  };

  const performStageMove = async (
    appointmentId: string, 
    newStageId: string, 
    appointment: Appointment,
    additionalData?: { rescheduleDate?: Date; followUpDate?: Date; followUpReason?: string }
  ) => {
    try {
      const updateData: any = { pipeline_stage: newStageId };
      
      // Add retarget_date for rescheduled
      if (newStageId === "rescheduled" && additionalData?.rescheduleDate) {
        updateData.retarget_date = format(additionalData.rescheduleDate, "yyyy-MM-dd");
        updateData.retarget_reason = "Rescheduled by user";
      }

      // Add retarget_date for follow-ups (no-show/cancelled)
      if (additionalData?.followUpDate && additionalData?.followUpReason) {
        updateData.retarget_date = format(additionalData.followUpDate, "yyyy-MM-dd");
        updateData.retarget_reason = additionalData.followUpReason;
      }

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (error) throw error;

      // Create follow-up or reschedule task if needed
      if (additionalData?.rescheduleDate) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "reschedule",
          p_reschedule_date: format(additionalData.rescheduleDate, "yyyy-MM-dd")
        });
      } else if (additionalData?.followUpDate && additionalData?.followUpReason) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(additionalData.followUpDate, "yyyy-MM-dd"),
          p_follow_up_reason: additionalData.followUpReason
        });
      }

      toast.success("Deal moved successfully");
      await loadDeals();
    } catch (error: any) {
      console.error("Error moving deal:", error);
      toast.error(error.message || "Failed to move deal");
    }
  };

  const handleRescheduleConfirm = async (rescheduleDate: Date) => {
    if (!rescheduleDialog) return;
    
    const appointment = appointments.find((a) => a.id === rescheduleDialog.appointmentId);
    
    if (appointment) {
      await performStageMove(
        rescheduleDialog.appointmentId,
        rescheduleDialog.stageId,
        appointment,
        { rescheduleDate }
      );
    }
    
    setRescheduleDialog(null);
  };

  const handleFollowUpConfirm = async (followUpDate: Date, reason: string) => {
    if (!followUpDialog) return;
    
    const appointment = appointments.find((a) => a.id === followUpDialog.appointmentId);
    
    if (appointment) {
      await performStageMove(
        followUpDialog.appointmentId,
        followUpDialog.stageId,
        appointment,
        { followUpDate, followUpReason: reason }
      );
    }
    
    setFollowUpDialog(null);
  };

  const handleDepositConfirm = async (depositAmount: number, notes: string, followUpDate: Date) => {
    if (!depositDialog) return;
    
    const appointment = appointments.find((a) => a.id === depositDialog.appointmentId);
    
    if (appointment) {
      try {
        console.log("💰 Saving deposit:", {
          appointmentId: depositDialog.appointmentId,
          stageId: depositDialog.stageId,
          depositAmount,
          notes,
          followUpDate,
          currentUser: appointment.closer_name
        });

        // Update appointment with deposit amount and move to deposit stage
        const { data, error } = await supabase
          .from("appointments")
          .update({ 
            pipeline_stage: depositDialog.stageId,
            cc_collected: depositAmount,
            setter_notes: notes
          })
          .eq("id", depositDialog.appointmentId)
          .select();

        if (error) {
          console.error("❌ Deposit update error:", error);
          throw error;
        }

        console.log("✅ Deposit saved successfully:", data);

        // Create follow-up task
        const { error: taskError } = await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: depositDialog.appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(followUpDate, "yyyy-MM-dd"),
          p_follow_up_reason: `Deposit collected: $${depositAmount}. ${notes}`
        });

        if (taskError) {
          console.error("⚠️ Task creation error:", taskError);
        }

        toast.success(`Deposit of $${depositAmount} recorded`);
        await loadDeals();
      } catch (error: any) {
        console.error("💥 Error recording deposit:", error);
        toast.error(getUserFriendlyError(error));
      }
    }
    
    setDepositDialog(null);
  };

  const handleMoveTo = async (appointmentId: string, stage: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    // Check if moving to won/closed stage - open close deal dialog
    const targetStageData = stages.find(s => s.stage_id === stage);
    const isClosedStage = targetStageData && 
      (targetStageData.stage_id === 'won' || 
       targetStageData.stage_label.toLowerCase().includes('won') || 
       targetStageData.stage_label.toLowerCase().includes('closed') || 
       targetStageData.stage_label.toLowerCase().includes('close'));

    if (isClosedStage) {
      // Move to closed stage and open the close deal dialog
      await performStageMove(appointmentId, stage, appointment);
      
      // Create a follow-up task for the closer
      if (appointment.closer_id) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: appointment.team_id,
          p_appointment_id: appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
          p_follow_up_reason: "Deal closed - Schedule follow-up for retention and upsell"
        });
      }
      
      // Open the close deal dialog to finalize details
      onCloseDeal({ ...appointment, pipeline_stage: stage }, { trackAction, showUndoToast });
      return;
    }

    // Check if moving to stages that require additional info
    if (stage === "rescheduled") {
      setRescheduleDialog({ 
        open: true, 
        appointmentId, 
        stageId: stage,
        dealName: appointment.lead_name 
      });
      return;
    }

    if (stage === "canceled" || stage === "no_show") {
      setFollowUpDialog({ 
        open: true, 
        appointmentId, 
        stageId: stage,
        dealName: appointment.lead_name,
        stage: stage === "canceled" ? "cancelled" : "no_show"
      });
      return;
    }

    // Normal move without dialog
    setAppointments((prev) =>
      prev.map((app) =>
        app.id === appointmentId ? { ...app, pipeline_stage: stage } : app
      )
    );

    try {
      // Track the action for undo - capture all relevant fields
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
        description: `Moved ${appointment.lead_name} to ${stage}`,
      });

      const { error } = await supabase
        .from("appointments")
        .update({ pipeline_stage: stage })
        .eq("id", appointmentId);

      if (error) throw error;
      showUndoToast(`Moved ${appointment.lead_name} to ${stage}`);
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast.error("Failed to move deal");
      loadDeals();
    }
  };

  const handleCloseDeal = (appointment: Appointment) => {
    onCloseDeal(appointment, { trackAction, showUndoToast });
  };

  const handleDelete = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this deal? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;
      
      toast.success('Deal deleted successfully');
      loadDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error('Failed to delete deal');
    }
  };

  const handleUndo = async (appointmentId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    // Check if deal is in deposit or closed stage - if so, clear all closed details
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
        // Delete MRR commissions by prospect name (appointment_id might not be set)
        await supabase
          .from('mrr_commissions')
          .delete()
          .match({
            team_id: appointment.team_id,
            prospect_name: appointment.lead_name
          });

        // Delete MRR schedules
        const { data: mrrSchedules } = await supabase
          .from('mrr_schedules')
          .select('id')
          .match({
            team_id: appointment.team_id,
            client_name: appointment.lead_name
          });

        if (mrrSchedules && mrrSchedules.length > 0) {
          const scheduleIds = mrrSchedules.map(s => s.id);
          
          // Delete MRR follow-up tasks linked to these schedules
          await supabase
            .from('mrr_follow_up_tasks')
            .delete()
            .in('mrr_schedule_id', scheduleIds);

          // Delete the MRR schedules
          await supabase
            .from('mrr_schedules')
            .delete()
            .in('id', scheduleIds);
        }

        // Delete sales records for this customer
        await supabase
          .from('sales')
          .delete()
          .match({ 
            team_id: appointment.team_id,
            customer_name: appointment.lead_name
          });

        // Reset appointment to fresh booked state - clear ALL closed deal data
        const { error } = await supabase
          .from('appointments')
          .update({ 
            pipeline_stage: 'booked',
            status: 'NEW',
            cc_collected: 0,
            mrr_amount: 0,
            mrr_months: 0,
            revenue: 0,
            product_name: null,
            retarget_date: null,
            retarget_reason: null
          })
          .eq('id', appointmentId);

        if (error) throw error;

        // Log the reset action
        await supabase
          .from("activity_logs")
          .insert({
            team_id: appointment.team_id,
            appointment_id: appointmentId,
            actor_name: "User",
            action_type: "Reset",
            note: `Reset to fresh booked appointment from ${appointment.pipeline_stage}`
          });

      toast.success(`${appointment.lead_name} reset to booked appointment`);
        // Force refresh with a small delay to ensure DB propagation
        setTimeout(() => loadDeals(), 100);
      } catch (error) {
        console.error('Error resetting deal:', error);
        toast.error('Failed to reset deal');
      }
      return;
    }

    // Normal undo logic for other stages - move back to booked
    if (!confirm(`Undo this action and move ${appointment.lead_name} back to Booked?`)) {
      return;
    }

    try {
      // Move back to booked and clear deposit/revenue data
      const { error } = await supabase
        .from('appointments')
        .update({ 
          pipeline_stage: 'booked',
          cc_collected: 0,
          retarget_date: null,
          retarget_reason: null
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Log the undo action
      await supabase
        .from("activity_logs")
        .insert({
          team_id: appointment.team_id,
          appointment_id: appointmentId,
          actor_name: "User",
          action_type: "Undone",
          note: `Moved back to Booked from ${appointment.pipeline_stage}`
        });
      
      toast.success('Action undone - moved back to Booked');
      // Force refresh with a small delay to ensure DB propagation
      setTimeout(() => loadDeals(), 100);
    } catch (error) {
      console.error('Error undoing action:', error);
      toast.error('Failed to undo action');
    }
  };

  const handleChangeStatus = (appointmentId: string, currentStatus: string | null, dealName: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    setStatusDialog({
      open: true,
      appointmentId,
      dealName,
      currentStatus
    });
  };

  const handleStatusConfirm = async (newStatus: string) => {
    if (!statusDialog) return;

    const appointment = appointments.find((a) => a.id === statusDialog.appointmentId);
    if (!appointment) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus as any })
        .eq('id', statusDialog.appointmentId);

      if (error) throw error;

      // Log the status change
      await supabase
        .from("activity_logs")
        .insert({
          team_id: appointment.team_id,
          appointment_id: statusDialog.appointmentId,
          actor_name: "User",
          action_type: "Status Changed",
          note: `Changed status to ${newStatus}`
        });
      
      toast.success(`Status changed to ${newStatus}`);
      setStatusDialog(null);
      loadDeals();
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Failed to change status');
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-card via-card/95 to-secondary/30 border border-primary/20 rounded-xl p-5 shadow-md backdrop-blur-sm">
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: "closest" | "furthest") => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="closest">Closest Dates First</SelectItem>
                  <SelectItem value="furthest">Furthest Dates First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button 
          onClick={() => setManagerOpen(true)} 
          variant="outline" 
          className="whitespace-nowrap border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage Pipeline
        </Button>
      </div>

      <div className="bg-gradient-to-br from-muted/20 via-background to-muted/10 rounded-xl p-6 border border-primary/10 shadow-lg">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-4 px-2">
            {stages.map((stage) => {
              const stageAppointments = dealsByStage[stage.stage_id] || [];
              const colors = getStageColors(stage.stage_id);

              return (
                <DroppableStageColumn key={stage.id} id={stage.stage_id}>
                  <div className="mb-4 space-y-3 p-4 bg-gradient-to-br from-card/80 via-card/60 to-secondary/40 rounded-xl border border-primary/10 backdrop-blur-sm shadow-md">
                    <div className={cn(
                      "inline-flex items-center px-4 py-2 rounded-full shadow-sm",
                      colors.badge
                    )}>
                      <span className={cn("text-sm font-bold uppercase tracking-wider", colors.text)}>
                        {stage.stage_label}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        {stageAppointments.length} {stageAppointments.length === 1 ? 'DEAL' : 'DEALS'}
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 rounded-xl" style={{ height: 'calc(100vh - 380px)' }}>
                    <SortableContext
                      items={stageAppointments.map((apt) => apt.id)}
                      strategy={verticalListSortingStrategy}
                      id={stage.stage_id}
                    >
                      <div className="space-y-3 pb-2 pr-3">
                        {stageAppointments.length === 0 ? (
                          <div className="text-center py-16 px-4 bg-muted/20 rounded-xl border border-dashed border-border/50">
                            <p className="text-sm text-muted-foreground font-medium">
                              No deals here yet
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              Drag deals to this stage
                            </p>
                          </div>
                        ) : (
                          stageAppointments.map((appointment) => (
                            <DealCard
                              key={appointment.id}
                              id={appointment.id}
                              teamId={teamId}
                              appointment={appointment}
                              onCloseDeal={handleCloseDeal}
                              onMoveTo={handleMoveTo}
                              onDelete={handleDelete}
                              onUndo={handleUndo}
                              onChangeStatus={handleChangeStatus}
                              userRole={userRole}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </ScrollArea>
                </DroppableStageColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeId && (() => {
              const activeAppointment = appointments.find(a => a.id === activeId);
              return activeAppointment ? (
                <div className="opacity-90 cursor-grabbing" style={{ width: '280px' }}>
                  <DealCard
                    id={activeId}
                    teamId={teamId}
                    appointment={activeAppointment}
                    onCloseDeal={handleCloseDeal}
                    onMoveTo={handleMoveTo}
                    onDelete={handleDelete}
                    onUndo={handleUndo}
                    onChangeStatus={handleChangeStatus}
                    userRole={userRole}
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

      {rescheduleDialog && (
        <RescheduleDialog
          open={rescheduleDialog.open}
          onOpenChange={(open) => !open && setRescheduleDialog(null)}
          onConfirm={handleRescheduleConfirm}
          dealName={rescheduleDialog.dealName}
        />
      )}

      {followUpDialog && (
        <FollowUpDialog
          open={followUpDialog.open}
          onOpenChange={(open) => !open && setFollowUpDialog(null)}
          onConfirm={handleFollowUpConfirm}
          dealName={followUpDialog.dealName}
          stage={followUpDialog.stage}
        />
      )}

      {statusDialog && (
        <ChangeStatusDialog
          open={statusDialog.open}
          onOpenChange={(open) => !open && setStatusDialog(null)}
          onConfirm={handleStatusConfirm}
          dealName={statusDialog.dealName}
          currentStatus={statusDialog.currentStatus}
        />
      )}

      {depositDialog && (
        <DepositCollectedDialog
          open={depositDialog.open}
          onOpenChange={(open) => !open && setDepositDialog(null)}
          onConfirm={handleDepositConfirm}
          dealName={depositDialog.dealName}
        />
      )}
    </div>
  );
}
