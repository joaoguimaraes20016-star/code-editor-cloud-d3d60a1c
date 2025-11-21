import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, UserPlus, CalendarCheck, CalendarX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { FollowUpDialog } from "./FollowUpDialog";

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
  event_type_name: string | null;
  pipeline_stage: string | null;
}

interface ConfirmTodayWorkspaceProps {
  teamId: string;
  userRole: string;
}

export function ConfirmTodayWorkspace({ teamId, userRole }: ConfirmTodayWorkspaceProps) {
  const { user } = useAuth();
  const [unassigned, setUnassigned] = useState<Appointment[]>([]);
  const [myAssigned, setMyAssigned] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpDialog, setFollowUpDialog] = useState<{ open: boolean; appointmentId: string; stageId: string; dealName: string; stage: "cancelled" | "no_show" } | null>(null);

  useEffect(() => {
    loadTodaysAppointments();

    const channel = supabase
      .channel('confirm-today-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => loadTodaysAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user?.id]);

  const loadTodaysAppointments = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .gte('start_at_utc', `${today}T00:00:00Z`)
        .lt('start_at_utc', `${today}T23:59:59Z`)
        .order('start_at_utc', { ascending: true });

      if (error) throw error;

      const unassignedAppts = data?.filter(apt => apt.setter_id === null) || [];
      const myAppts = data?.filter(apt => apt.setter_id === user.id) || [];

      setUnassigned(unassignedAppts);
      setMyAssigned(myAppts);
    } catch (error) {
      console.error('Error loading today\'s appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async (appointmentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ setter_id: user.id })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Appointment assigned to you');
      loadTodaysAppointments();
    } catch (error) {
      console.error('Error assigning appointment:', error);
      toast.error('Failed to assign appointment');
    }
  };

  const handleConfirm = async (appointmentId: string, setterId: string | null) => {
    if (!user) return;

    try {
      const updateData: any = { 
        status: 'CONFIRMED',
        pipeline_stage: 'booked' // Keep in booked stage when confirmed
      };
      
      // If unassigned, auto-assign to current user
      if (!setterId) {
        updateData.setter_id = user.id;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success(setterId ? 'Appointment confirmed' : 'Confirmed & Assigned to You', {
        description: !setterId ? 'You now own this lead for commission credit' : undefined
      });
      loadTodaysAppointments();
    } catch (error) {
      console.error('Error confirming appointment:', error);
      toast.error('Failed to confirm appointment');
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    // Find appointment in either unassigned or myAssigned
    const appointment = [...unassigned, ...myAssigned].find(apt => apt.id === appointmentId);
    if (!appointment) return;

    // Open follow-up dialog instead of direct update
    setFollowUpDialog({
      open: true,
      appointmentId,
      stageId: 'no_show',
      dealName: appointment.lead_name,
      stage: 'no_show'
    });
  };

  const handleFollowUpConfirm = async (followUpDate: Date, reason: string) => {
    if (!followUpDialog) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'CANCELLED',
          pipeline_stage: 'no_show',
          retarget_date: format(followUpDate, "yyyy-MM-dd"),
          retarget_reason: reason
        })
        .eq('id', followUpDialog.appointmentId);

      if (error) throw error;

      // Cleanup confirmation tasks (status changed to CANCELLED)
      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: followUpDialog.appointmentId,
        p_reason: 'No-show with follow-up scheduled'
      });

      // Create follow-up task
      await supabase.rpc("create_task_with_assignment", {
        p_team_id: teamId,
        p_appointment_id: followUpDialog.appointmentId,
        p_task_type: "follow_up",
        p_follow_up_date: format(followUpDate, "yyyy-MM-dd"),
        p_follow_up_reason: reason,
        p_reschedule_date: null
      });

      toast.success("Follow-up scheduled successfully");
      setFollowUpDialog(null);
      loadTodaysAppointments();
    } catch (error: any) {
      console.error("Error scheduling follow-up:", error);
      toast.error(error.message || "Failed to schedule follow-up");
    }
  };

  const formatTime = (utcDate: string) => {
    try {
      const dateObj = parseISO(utcDate);
      const formattedTime = format(dateObj, 'h:mm a');
      const timezone = new Intl.DateTimeFormat('en-US', { 
        timeZoneName: 'short' 
      }).formatToParts(dateObj).find(part => part.type === 'timeZoneName')?.value || '';
      return `${formattedTime} ${timezone}`.trim();
    } catch {
      return utcDate;
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
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-5 w-5" />
        <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
      </div>

      {/* Unassigned Today Section */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-600" />
            Unassigned Today
            <Badge variant="secondary" className="ml-auto">
              {unassigned.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unassigned appointments today</p>
          ) : (
            unassigned.map((apt) => (
              <Card key={apt.id} className="bg-background">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{apt.lead_name}</p>
                      <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
                      {apt.event_type_name && (
                        <Badge variant="outline" className="text-xs">
                          {apt.event_type_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTime(apt.start_at_utc)}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      onClick={() => handleAssignToMe(apt.id)}
                      className="flex-1"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign to Me
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleConfirm(apt.id, apt.setter_id)}
                    >
                      <CalendarCheck className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleNoShow(apt.id)}
                    >
                      <CalendarX className="h-4 w-4 mr-1" />
                      No-Show
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* My Assigned Today Section */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-green-600" />
            My Assigned Today
            <Badge variant="secondary" className="ml-auto">
              {myAssigned.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myAssigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned appointments today</p>
          ) : (
            myAssigned.map((apt) => (
              <Card key={apt.id} className="bg-background">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{apt.lead_name}</p>
                      <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
                      {apt.event_type_name && (
                        <Badge variant="outline" className="text-xs">
                          {apt.event_type_name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={
                            apt.pipeline_stage === 'no_show' ? 'destructive' : 
                            apt.pipeline_stage === 'cancelled' ? 'secondary' : 
                            apt.status === 'CONFIRMED' ? 'confirmed' : 
                            apt.status === 'RESCHEDULED' ? 'rescheduled' :
                            apt.status === 'NEW' ? 'pending' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {apt.pipeline_stage === 'no_show' ? 'No Show' : 
                           apt.pipeline_stage === 'cancelled' ? 'Cancelled' : 
                           apt.status === 'NEW' ? 'Pending Confirmation' :
                           apt.status}
                        </Badge>
                        {apt.status === 'CONFIRMED' && apt.setter_id === user?.id && !apt.pipeline_stage?.includes('no_show') && !apt.pipeline_stage?.includes('cancelled') && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Confirmed & Assigned to You
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTime(apt.start_at_utc)}
                    </div>
                  </div>
                  {apt.setter_notes && (
                    <p className="text-sm text-muted-foreground border-l-2 pl-3">
                      {apt.setter_notes}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {apt.status !== 'CONFIRMED' && (
                      <Button 
                        size="sm"
                        onClick={() => handleConfirm(apt.id, apt.setter_id)}
                      >
                        <CalendarCheck className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleNoShow(apt.id)}
                    >
                      <CalendarX className="h-4 w-4 mr-1" />
                      No-Show
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

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

          toast.success('Appointment status updated');
          setFollowUpDialog(null);
        }}
      />
    </div>
  );
}
