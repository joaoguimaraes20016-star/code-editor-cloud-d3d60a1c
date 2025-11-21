import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { StageActionMenu } from "./StageActionMenu";
import { FollowUpDialog } from "./FollowUpDialog";
import { formatDateTimeWithTimezone } from "@/lib/utils";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
  status: string;
  setter_id: string | null;
  setter_name: string | null;
  closer_id: string | null;
  closer_name: string | null;
  setter_notes: string | null;
  pipeline_stage: string | null;
}

interface StageWorkspaceViewProps {
  teamId: string;
  stageId: string;
  stageName: string;
  stageColor: string;
}

export function StageWorkspaceView({ 
  teamId, 
  stageId, 
  stageName, 
  stageColor 
}: StageWorkspaceViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpDialog, setFollowUpDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string; stage: "cancelled" | "no_show" } | null>(null);

  useEffect(() => {
    loadStageAppointments();

    const channel = supabase
      .channel(`stage-${stageId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => loadStageAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, stageId]);

  const loadStageAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('pipeline_stage', stageId)
        .order('start_at_utc', { ascending: false });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading stage appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'CONFIRMED', pipeline_stage: 'booked' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Appointment confirmed');
      loadStageAppointments();
    } catch (error) {
      console.error('Error confirming:', error);
      toast.error('Failed to confirm');
    }
  };

  const handleNoShow = async (id: string) => {
    const appointment = appointments.find(apt => apt.id === id);
    if (!appointment) return;

    // Open follow-up dialog instead of direct update
    setFollowUpDialog({
      open: true,
      appointmentId: id,
      stageId: 'no_show',
      dealName: appointment.lead_name,
      stage: 'no_show'
    });
  };

  const handleRetarget = async (id: string) => {
    const retargetDate = new Date();
    retargetDate.setDate(retargetDate.getDate() + 7);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          retarget_date: retargetDate.toISOString().split('T')[0],
          retarget_reason: `Retarget from ${stageName}`
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Added to retarget queue');
      loadStageAppointments();
    } catch (error) {
      console.error('Error retargeting:', error);
      toast.error('Failed to add to retarget queue');
    }
  };

  const handleDisqualify = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ pipeline_stage: 'disqualified' })
        .eq('id', id);

      if (error) throw error;

      // Cleanup confirmation tasks
      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: id,
        p_reason: 'Lead disqualified'
      });

      toast.success('Lead disqualified');
      loadStageAppointments();
    } catch (error) {
      console.error('Error disqualifying:', error);
      toast.error('Failed to disqualify');
    }
  };

  const handleMoveToClosed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'CLOSED', pipeline_stage: 'won' })
        .eq('id', id);

      if (error) throw error;

      // Cleanup confirmation tasks (though close_deal_transaction should handle this too)
      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: id,
        p_reason: 'Deal closed'
      });

      toast.success('Moved to closed');
      loadStageAppointments();
    } catch (error) {
      console.error('Error moving to closed:', error);
      toast.error('Failed to move to closed');
    }
  };

  const handleFollowUpConfirm = async (followUpDate: Date, reason: string) => {
    if (!followUpDialog) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'CANCELLED',
          pipeline_stage: followUpDialog.stageId,
          retarget_date: format(followUpDate, "yyyy-MM-dd"),
          retarget_reason: reason
        })
        .eq('id', followUpDialog.appointmentId);

      if (error) throw error;

      // Cleanup confirmation tasks
      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: followUpDialog.appointmentId,
        p_reason: `${followUpDialog.stageId} with follow-up scheduled`
      });

      // Create follow-up task
      const appointment = appointments.find(a => a.id === followUpDialog.appointmentId);
      if (appointment) {
        await supabase.rpc("create_task_with_assignment", {
          p_team_id: teamId,
          p_appointment_id: followUpDialog.appointmentId,
          p_task_type: "follow_up",
          p_follow_up_date: format(followUpDate, "yyyy-MM-dd"),
          p_follow_up_reason: reason,
          p_reschedule_date: null
        });
      }

      toast.success("Follow-up scheduled successfully");
      setFollowUpDialog(null);
      loadStageAppointments();
    } catch (error: any) {
      console.error("Error scheduling follow-up:", error);
      toast.error(error.message || "Failed to schedule follow-up");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDateTimeWithTimezone(parseISO(dateStr), 'MMM d, h:mm a');
    } catch {
      return dateStr;
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
      <div className="flex items-center gap-3">
        <div 
          className="w-4 h-4 rounded-full" 
          style={{ backgroundColor: stageColor }}
        />
        <h2 className="text-2xl font-bold">{stageName}</h2>
        <Badge variant="secondary" className="ml-auto">
          {appointments.length} leads
        </Badge>
      </div>

      <div className="space-y-3">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No appointments in this stage
            </CardContent>
          </Card>
        ) : (
          appointments.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold">{apt.lead_name}</p>
                    <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {formatDate(apt.start_at_utc)}
                      </Badge>
                      {apt.setter_name && (
                        <Badge variant="secondary" className="text-xs">
                          Setter: {apt.setter_name}
                        </Badge>
                      )}
                      {apt.closer_name && (
                        <Badge variant="secondary" className="text-xs">
                          Closer: {apt.closer_name}
                        </Badge>
                      )}
                    </div>
                    {apt.setter_notes && (
                      <p className="text-sm border-l-2 pl-3 text-muted-foreground">
                        {apt.setter_notes}
                      </p>
                    )}
                  </div>
                </div>
                <StageActionMenu
                  appointmentId={apt.id}
                  pipelineStage={apt.pipeline_stage}
                  onConfirm={handleConfirm}
                  onNoShow={handleNoShow}
                  onRetarget={handleRetarget}
                  onDisqualify={handleDisqualify}
                  onMoveToClosed={handleMoveToClosed}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <FollowUpDialog
        open={followUpDialog?.open || false}
        onOpenChange={(open) => !open && setFollowUpDialog(null)}
        onConfirm={handleFollowUpConfirm}
        dealName={followUpDialog?.dealName || ""}
        stage={followUpDialog?.stage || "no_show"}
        teamId={teamId}
        onSkip={async () => {
          if (!followUpDialog) return;
          
          // Move without creating follow-up
          const { error } = await supabase
            .from('appointments')
            .update({ 
              pipeline_stage: followUpDialog.stageId,
            })
            .eq('id', followUpDialog.appointmentId);

          if (error) {
            toast.error('Failed to update appointment');
            return;
          }

          toast.success('Appointment moved successfully');
          setFollowUpDialog(null);
          loadStageAppointments();
        }}
      />
    </div>
  );
}
