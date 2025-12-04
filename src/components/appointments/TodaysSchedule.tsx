import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InfoIcon, Calendar, Clock, Phone, CalendarCheck, CalendarClock, CalendarX, UserPlus, PenLine, Send, X, AlertCircle, Star, RotateCcw, RefreshCw, AlertTriangle, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";
import { toast } from "sonner";
import { RescheduleWithLinkDialog } from "./RescheduleWithLinkDialog";
import { FollowUpDialog } from "./FollowUpDialog";
import { NoAnswerDialog } from "./NoAnswerDialog";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string | null;
  start_at_utc: string;
  status: string;
  setter_name: string | null;
  closer_name: string | null;
  event_type_name: string | null;
  setter_notes: string | null;
  cc_collected: number | null;
  mrr_amount: number | null;
  setter_id: string | null;
  closer_id: string | null;
  reschedule_url?: string | null;
  rebooking_type?: string | null;
  original_booking_date?: string | null;
  previous_status?: string | null;
  original_appointment_id?: string | null;
  rescheduled_to_appointment_id?: string | null;
}

interface Task {
  id: string;
  appointment_id: string;
  task_type: string;
  status: string;
  due_at: string;
  assigned_to: string | null;
  confirmation_attempts?: any;
}

interface TodaysScheduleProps {
  teamId: string;
  currentUserId: string;
  onCloseDeal?: (appointment: Appointment) => void;
}

export function TodaysSchedule({ teamId, currentUserId, onCloseDeal }: TodaysScheduleProps) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const { role } = useTeamRole(teamId);
  const [noAnswerCallbackOptions, setNoAnswerCallbackOptions] = useState<number[]>([15, 30, 60, 120]);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [rescheduleWithLinkDialog, setRescheduleWithLinkDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    appointmentName: string;
    rescheduleUrl: string;
  } | null>(null);
  const [followUpDialog, setFollowUpDialog] = useState<{
    open: boolean;
    appointmentId: string;
    taskId: string;
    dealName: string;
  } | null>(null);
  const [noAnswerDialog, setNoAnswerDialog] = useState<{
    open: boolean;
    taskId: string;
    appointmentId: string;
    dealName: string;
  } | null>(null);
  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    appointmentId: string;
    appointmentName: string;
    currentNotes: string | null;
  } | null>(null);
  const [updateNote, setUpdateNote] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('todays-schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `team_id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, currentUserId, role]);

  const loadData = async () => {
    await Promise.all([loadAppointments(), loadTasks(), loadTeamSettings()]);
    setLoading(false);
  };

  const loadTeamSettings = async () => {
    const { data: teamData } = await supabase
      .from('teams')
      .select('no_answer_callback_options')
      .eq('id', teamId)
      .single();
    
    const callbackOpts = teamData?.no_answer_callback_options as number[] | null;
    if (Array.isArray(callbackOpts) && callbackOpts.length > 0) {
      setNoAnswerCallbackOptions(callbackOpts);
    }
  };

  const loadAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .gte("start_at_utc", today.toISOString())
        .lt("start_at_utc", tomorrow.toISOString());

      // Filter based on user's role
      if (role === 'setter') {
        query = query.eq('setter_id', currentUserId);
      } else {
        query = query.eq('closer_id', currentUserId);
      }

      const { data, error } = await query.order("start_at_utc", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading today's schedule:", error);
    }
  };

  const loadTasks = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("confirmation_tasks")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "pending")
        .gte("due_at", today.toISOString())
        .lt("due_at", tomorrow.toISOString());

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  };

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

  const handleClearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
  };

  const getTaskForAppointment = (appointmentId: string) => {
    return tasks.find(t => t.appointment_id === appointmentId);
  };

  const countNoAnswerAttempts = (attempts: any): number => {
    if (!Array.isArray(attempts)) return 0;
    return attempts.filter((a: any) => a?.type === 'no_answer').length;
  };

  const handleConfirmTask = async () => {
    if (!confirmDialog) return;

    try {
      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_confirmations: 1
        })
        .eq('id', confirmDialog.taskId);

      if (error) throw error;

      const { error: aptError } = await supabase
        .from('appointments')
        .update({ status: 'CONFIRMED' })
        .eq('id', confirmDialog.appointmentId);

      if (aptError) throw aptError;

      toast.success('Task confirmed successfully');
      setConfirmDialog(null);
      setConfirmNote('');
      loadData();
    } catch (error) {
      console.error('Error confirming task:', error);
      toast.error('Failed to confirm task');
    }
  };

  const handleNoShow = async (taskId: string, appointmentId: string, dealName: string) => {
    setFollowUpDialog({
      open: true,
      appointmentId,
      taskId,
      dealName
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

      await supabase.rpc('cleanup_confirmation_tasks', {
        p_appointment_id: followUpDialog.appointmentId,
        p_reason: 'No-show with follow-up scheduled'
      });

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
      loadData();
    } catch (error: any) {
      console.error("Error scheduling follow-up:", error);
      toast.error(error.message || "Failed to schedule follow-up");
    }
  };

  const handleNoAnswerRetry = async (taskId: string, appointmentId: string, retryMinutes: number, notes: string) => {
    try {
      const apt = appointments.find(a => a.id === appointmentId);
      const appointmentTime = apt?.start_at_utc ? new Date(apt.start_at_utc) : null;
      
      const { data: task, error: fetchError } = await supabase
        .from('confirmation_tasks')
        .select('confirmation_attempts')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      const newAttempt = {
        timestamp: new Date().toISOString(),
        confirmed_by: user?.id,
        notes: notes || 'No Answer',
        type: 'no_answer'
      };

      const attempts = [...(Array.isArray(task?.confirmation_attempts) ? task.confirmation_attempts : []), newAttempt];
      
      if (retryMinutes === 0) {
        const { error } = await supabase
          .from('confirmation_tasks')
          .update({ confirmation_attempts: attempts })
          .eq('id', taskId);

        if (error) throw error;

        toast.success('No answer logged - Double dial', { description: 'Attempt recorded' });
        loadData();
        return;
      }

      const newDueAt = new Date(Date.now() + retryMinutes * 60 * 1000);

      if (appointmentTime && newDueAt >= appointmentTime) {
        const { error } = await supabase
          .from('confirmation_tasks')
          .update({ confirmation_attempts: attempts })
          .eq('id', taskId);

        if (error) throw error;

        toast.info('No answer logged', { description: 'Callback skipped - would overlap with appointment time' });
        loadData();
        return;
      }

      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          confirmation_attempts: attempts,
          due_at: newDueAt.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success(`Callback scheduled in ${retryMinutes} minutes`);
      loadData();
    } catch (error) {
      console.error('Error handling no answer:', error);
      toast.error('Failed to log no answer');
    }
  };

  const handleSaveUpdate = async () => {
    if (!updateDialog || !updateNote.trim()) return;
    
    try {
      setSavingUpdate(true);
      
      const timestamp = format(new Date(), "MMM d, h:mm a");
      const existingNotes = updateDialog.currentNotes || "";
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[${timestamp}] ${updateNote.trim()}`
        : `[${timestamp}] ${updateNote.trim()}`;
      
      const { error } = await supabase
        .from("appointments")
        .update({ setter_notes: newNotes })
        .eq("id", updateDialog.appointmentId);
      
      if (error) throw error;
      
      toast.success("Update added");
      setUpdateNote("");
      setUpdateDialog(null);
      loadData();
    } catch (error) {
      console.error("Error saving update:", error);
      toast.error("Failed to save update");
    } finally {
      setSavingUpdate(false);
    }
  };

  const renderTaskCard = (appointment: Appointment, task: Task) => {
    const noAnswerCount = countNoAnswerAttempts(task.confirmation_attempts || []);

    return (
      <Card key={appointment.id} className="bg-card card-hover border-l-4 border-l-blue-500">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-semibold truncate">{appointment.lead_name}</p>
              <p className="text-sm text-muted-foreground truncate">{appointment.lead_email}</p>
              {appointment.lead_phone && (
                <p className="text-sm text-muted-foreground">{appointment.lead_phone}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {appointment.event_type_name && (
                  <Badge variant="outline" className="text-xs">
                    {appointment.event_type_name}
                  </Badge>
                )}
                <Badge className="text-xs bg-blue-500 text-white border-0">
                  <Phone className="h-3 w-3 mr-1" />
                  {task.task_type === 'call_confirmation' ? 'Call Confirmation' : task.task_type}
                </Badge>
                {noAnswerCount > 0 && (
                  <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-400">
                    <Phone className="h-3 w-3 mr-1" />
                    {noAnswerCount} attempt{noAnswerCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {/* Rebooking badges */}
                {appointment.rebooking_type === 'returning_client' && (
                  <Badge className="text-xs bg-emerald-500 text-white border-0">
                    <Star className="h-3 w-3 mr-1" />
                    Returning Client
                  </Badge>
                )}
                {appointment.rebooking_type === 'win_back' && (
                  <Badge className="text-xs bg-blue-500 text-white border-0">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Win-Back
                  </Badge>
                )}
                {appointment.rebooking_type === 'rebooking' && (
                  <Badge className="text-xs bg-purple-500 text-white border-0">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Rebook
                  </Badge>
                )}
                {appointment.rebooking_type === 'reschedule' && (
                  <Badge className="text-xs bg-amber-500 text-white border-0">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Double Book
                  </Badge>
                )}
              </div>

              {/* Rebooking warnings */}
              {appointment.rebooking_type && (
                <div className={cn(
                  "text-xs p-2 rounded-lg border-l-4 mt-2",
                  appointment.rebooking_type === 'returning_client' && "bg-emerald-500/10 border-emerald-400",
                  appointment.rebooking_type === 'win_back' && "bg-blue-500/10 border-blue-400",
                  appointment.rebooking_type === 'rebooking' && "bg-purple-500/10 border-purple-400",
                  appointment.rebooking_type === 'reschedule' && "bg-amber-500/10 border-amber-400",
                )}>
                  {appointment.rebooking_type === 'returning_client' && (
                    <><strong className="text-emerald-700 dark:text-emerald-300">RETURNING CLIENT</strong><span className="text-foreground/70"> — Previously closed. Find out why they're booking again!</span></>
                  )}
                  {appointment.rebooking_type === 'win_back' && (
                    <><strong className="text-blue-700 dark:text-blue-300">WIN-BACK</strong><span className="text-foreground/70"> — Was {appointment.previous_status?.replace('_', ' ')}. Another chance!</span></>
                  )}
                  {appointment.rebooking_type === 'rebooking' && (
                    <><strong className="text-purple-700 dark:text-purple-300">REBOOK</strong><span className="text-foreground/70"> — Previously scheduled (after original date passed).</span></>
                  )}
                  {appointment.rebooking_type === 'reschedule' && (
                    <><strong className="text-amber-700 dark:text-amber-300">DOUBLE BOOK</strong><span className="text-foreground/70"> — Has existing appointment. Confirm correct date!</span></>
                  )}
                </div>
              )}

              {/* Setter notes */}
              {appointment.setter_notes && (
                <div className="text-xs p-2 bg-muted/50 rounded mt-2 whitespace-pre-line">
                  {appointment.setter_notes}
                </div>
              )}
            </div>

            {/* Time info */}
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-bold">
                  {formatDateTimeWithTimezone(appointment.start_at_utc, 'h:mm a')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs">
                  Due: {formatDateTimeWithTimezone(task.due_at, 'h:mm a')}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap pt-2 border-t">
            <Button 
              size="sm"
              onClick={() => setConfirmDialog({ 
                open: true, 
                taskId: task.id, 
                appointmentId: appointment.id,
                appointmentName: appointment.lead_name
              })}
            >
              <CalendarCheck className="h-4 w-4 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNoAnswerDialog({
                open: true,
                taskId: task.id,
                appointmentId: appointment.id,
                dealName: appointment.lead_name
              })}
            >
              <Phone className="h-4 w-4 mr-1" />
              No Answer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (appointment.reschedule_url) {
                  setRescheduleWithLinkDialog({
                    open: true,
                    taskId: task.id,
                    appointmentId: appointment.id,
                    appointmentName: appointment.lead_name,
                    rescheduleUrl: appointment.reschedule_url
                  });
                } else {
                  toast.error("No reschedule link available");
                }
              }}
            >
              <CalendarClock className="h-4 w-4 mr-1" />
              Reschedule
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleNoShow(task.id, appointment.id, appointment.lead_name)}
            >
              <CalendarX className="h-4 w-4 mr-1" />
              No-Show
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUpdateDialog({
                open: true,
                appointmentId: appointment.id,
                appointmentName: appointment.lead_name,
                currentNotes: appointment.setter_notes
              })}
            >
              <PenLine className="h-4 w-4 mr-1" />
              Add Update
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          Today's Schedule - {formatDateTimeWithTimezone(new Date(), 'MMMM d, yyyy')}
        </h3>
      </div>

      <AppointmentFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter="all"
        onStatusFilterChange={() => {}}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        eventTypes={eventTypes}
        onClearFilters={handleClearFilters}
        teamId={teamId}
      />

      {appointments.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No appointments scheduled for today. Enjoy your day off!
          </AlertDescription>
        </Alert>
      ) : filteredAppointments.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No appointments match your current filters.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appointment) => {
            const task = getTaskForAppointment(appointment.id);
            
            // If there's an active task, render as task card with actions
            if (task) {
              return renderTaskCard(appointment, task);
            }
            
            // Otherwise render regular appointment card with update capability
            return (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                teamId={teamId}
                onCloseDeal={onCloseDeal}
                onUpdate={loadData}
                showAddUpdate={true}
              />
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirm that you've contacted <strong>{confirmDialog?.appointmentName}</strong> and they confirmed the appointment.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm-note">Add a note (optional)</Label>
              <Input
                id="confirm-note"
                placeholder="Add any additional notes..."
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTask}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={updateDialog?.open} onOpenChange={(open) => !open && setUpdateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Update for {updateDialog?.appointmentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {updateDialog?.currentNotes && (
              <div className="text-sm p-3 bg-muted/50 rounded max-h-32 overflow-y-auto whitespace-pre-line">
                <Label className="text-xs text-muted-foreground">Previous notes:</Label>
                <p className="mt-1">{updateDialog.currentNotes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="update-note">New update</Label>
              <Textarea
                id="update-note"
                placeholder="Add your update..."
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpdateDialog(null); setUpdateNote(""); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveUpdate} disabled={!updateNote.trim() || savingUpdate}>
              <Send className="h-4 w-4 mr-1" />
              {savingUpdate ? "Saving..." : "Save Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      {rescheduleWithLinkDialog && (
        <RescheduleWithLinkDialog
          open={rescheduleWithLinkDialog.open}
          onOpenChange={(open) => !open && setRescheduleWithLinkDialog(null)}
          appointmentId={rescheduleWithLinkDialog.appointmentId}
          appointmentName={rescheduleWithLinkDialog.appointmentName}
          rescheduleUrl={rescheduleWithLinkDialog.rescheduleUrl}
          onConfirm={async (reason, notes) => {
            // Mark the task as completed
            if (rescheduleWithLinkDialog.taskId) {
              await supabase
                .from('confirmation_tasks')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', rescheduleWithLinkDialog.taskId);
            }
            setRescheduleWithLinkDialog(null);
            loadData();
          }}
        />
      )}

      {/* Follow-up Dialog */}
      {followUpDialog && (
        <FollowUpDialog
          open={followUpDialog.open}
          onOpenChange={(open) => !open && setFollowUpDialog(null)}
          dealName={followUpDialog.dealName}
          stage="no_show"
          teamId={teamId}
          onConfirm={handleFollowUpConfirm}
        />
      )}

      {/* No Answer Dialog */}
      {noAnswerDialog && (
        <NoAnswerDialog
          open={noAnswerDialog.open}
          onOpenChange={(open) => !open && setNoAnswerDialog(null)}
          dealName={noAnswerDialog.dealName}
          callbackOptions={noAnswerCallbackOptions}
          onConfirm={(retryMinutes, notes) => {
            handleNoAnswerRetry(noAnswerDialog.taskId, noAnswerDialog.appointmentId, retryMinutes, notes);
            setNoAnswerDialog(null);
          }}
        />
      )}
    </div>
  );
}
