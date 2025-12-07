import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { formatDateTimeWithTimezone } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User, Clock, History, ArrowRight, AlertTriangle, RefreshCw, PenLine, Send, X, Video } from "lucide-react";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import { RescheduleHistory } from "./RescheduleHistory";
import { CollapsibleNotes } from "./CollapsibleNotes";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface AppointmentCardProps {
  appointment: {
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
    original_appointment_id?: string | null;
    rescheduled_to_appointment_id?: string | null;
    reschedule_count?: number;
    pipeline_stage?: string | null;
    retarget_date?: string | null;
    closer_notes?: string | null;
    meeting_link?: string | null;
  };
  teamId?: string;
  onUpdateStatus?: (id: string, status: string) => void;
  onCloseDeal?: (appointment: any) => void;
  onViewDetails?: (appointment: any) => void;
  onAssign?: () => void;
  onUpdate?: () => void;
  showAddUpdate?: boolean;
}

const statusColors: Record<string, string> = {
  NEW: "pending",
  SHOWED: "confirmed",
  NO_SHOW: "destructive",
  CANCELLED: "secondary",
  CLOSED: "confirmed",
  RESCHEDULED: "rescheduled",
  CONFIRMED: "confirmed",
};

export function AppointmentCard({
  appointment,
  teamId,
  onUpdateStatus,
  onCloseDeal,
  onViewDetails,
  onAssign,
  onUpdate,
  showAddUpdate = false,
}: AppointmentCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);
  const [showUpdateInput, setShowUpdateInput] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const formattedDate = formatDateTimeWithTimezone(appointment.start_at_utc);

  // Check if this is a rescheduled appointment
  const isRescheduled = appointment.status === 'RESCHEDULED' || appointment.pipeline_stage === 'rescheduled';
  
  // Use stored original_closer_name from appointment record
  const originalCloserName = (appointment as any).original_closer_name;
  const hasCloserReassignment = originalCloserName && appointment.closer_name && originalCloserName !== appointment.closer_name;

  const handleSaveUpdate = async () => {
    if (!updateNote.trim()) return;
    
    try {
      setSavingUpdate(true);
      
      // Append new note to existing notes with timestamp
      const timestamp = format(new Date(), "MMM d, h:mm a");
      const existingNotes = appointment.setter_notes || "";
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[${timestamp}] ${updateNote.trim()}`
        : `[${timestamp}] ${updateNote.trim()}`;
      
      const { error } = await supabase
        .from("appointments")
        .update({ setter_notes: newNotes })
        .eq("id", appointment.id);
      
      if (error) throw error;
      
      toast.success("Update added");
      setUpdateNote("");
      setShowUpdateInput(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving update:", error);
      toast.error("Failed to save update");
    } finally {
      setSavingUpdate(false);
    }
  };

  return (
    <Card className="p-5 card-hover group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-1 truncate group-hover:text-primary transition-colors">{appointment.lead_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Mail className="w-4 h-4" />
            <span className="truncate">{appointment.lead_email}</span>
          </div>
          {appointment.lead_phone && (
            <div className="text-sm text-muted-foreground">
              {appointment.lead_phone}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 flex-wrap">
          <Badge variant={statusColors[appointment.status] as any || "secondary"}>
            {appointment.status}
          </Badge>
          
          {/* Rescheduled Badge with Date - Don't show for rebooked leads or original appointments */}
          {isRescheduled && !appointment.original_appointment_id && !appointment.rescheduled_to_appointment_id && (
            <Badge className="bg-yellow-500 text-white border-0 gap-1">
              <RefreshCw className="h-3 w-3" />
              Rescheduled
              {appointment.retarget_date && (
                <span className="ml-1">
                  for {format(parseISO(appointment.retarget_date), "MMM d")}
                </span>
              )}
            </Badge>
          )}

          {/* Closer Reassignment Warning - On-brand styling */}
          {hasCloserReassignment && (
            <Badge variant="outline" className="border-warning bg-warning/10 text-warning-foreground gap-1">
              <AlertTriangle className="h-3 w-3" />
              Reassigned: {originalCloserName} → {appointment.closer_name}
            </Badge>
          )}
          
          {/* Double Book badge (rebooking_type === 'reschedule') */}
          {(appointment as any).rebooking_type === 'reschedule' && appointment.original_appointment_id && (
            <Badge 
              className="bg-amber-500 text-white border-0 cursor-pointer hover:bg-amber-600 gap-1"
              onClick={() => setShowRescheduleHistory(true)}
            >
              <AlertTriangle className="h-3 w-3" />
              Double Book
              <span className="ml-1 px-2 py-0.5 bg-white text-amber-600 rounded font-semibold text-xs shadow-sm">
                View
              </span>
            </Badge>
          )}
          
          {/* Rebook badge (rebooking_type === 'rebooking') */}
          {(appointment as any).rebooking_type === 'rebooking' && appointment.original_appointment_id && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-purple-400/20 border-purple-400/50 text-purple-500 dark:text-purple-300 gap-1"
              onClick={() => setShowRescheduleHistory(true)}
            >
              <RefreshCw className="h-3 w-3" />
              Rebook
              <span className="ml-1 px-2 py-0.5 bg-purple-500 text-white rounded font-semibold text-xs shadow-sm">
                View
              </span>
            </Badge>
          )}
          
          {/* Generic rebooked lead badge (no rebooking_type but has original) */}
          {appointment.original_appointment_id && !(appointment as any).rebooking_type && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-purple-400/20 border-purple-400/50 text-purple-500 dark:text-purple-300 gap-1"
              onClick={() => setShowRescheduleHistory(true)}
            >
              <History className="h-3 w-3" />
              Rebooked Lead
              {appointment.reschedule_count && appointment.reschedule_count > 1 && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-400/40 rounded-full text-xs font-bold">
                  {appointment.reschedule_count}x
                </span>
              )}
              <span className="ml-1 px-2 py-0.5 bg-purple-500 text-white rounded font-semibold text-xs shadow-sm">
                View
              </span>
            </Badge>
          )}
          
          {/* Double Book badge on ORIGINAL appointment */}
          {appointment.rescheduled_to_appointment_id && (
            <Badge 
              className="bg-amber-500 text-white border-0 cursor-pointer hover:bg-amber-600 gap-1"
              onClick={() => setShowRescheduleHistory(true)}
            >
              <AlertTriangle className="h-3 w-3" />
              Double Book
              <span className="ml-1 px-2 py-0.5 bg-white text-amber-600 rounded font-semibold text-xs shadow-sm">
                View
              </span>
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {teamId && (
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  Edit Appointment
                </DropdownMenuItem>
              )}
              {onViewDetails && (
                <DropdownMenuItem onClick={() => onViewDetails(appointment)}>
                  View Details
                </DropdownMenuItem>
              )}
              {onCloseDeal && appointment.status !== 'CLOSED' && (
                <DropdownMenuItem onClick={() => onCloseDeal(appointment)}>
                  Close Deal
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          {appointment.event_type_name && (
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded text-xs font-medium">
              <Calendar className="w-3 h-3" />
              <span>{appointment.event_type_name}</span>
            </div>
          )}
        </div>

        {/* Meeting Link */}
        {appointment.meeting_link && (
          <a 
            href={appointment.meeting_link} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
          >
            <Video className="w-4 h-4" />
            <span className="font-medium">
              {appointment.meeting_link.includes('zoom') ? 'Join Zoom Meeting' : 
               appointment.meeting_link.includes('meet.google') ? 'Join Google Meet' : 
               appointment.meeting_link.includes('teams') ? 'Join Teams Meeting' : 'Join Meeting'}
            </span>
          </a>
        )}

        <div className="flex items-center gap-2 text-sm flex-wrap">
          {appointment.setter_name ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-info/10 border border-info/30 rounded-md">
              <User className="w-3.5 h-3.5 text-info" />
              <span className="text-xs text-muted-foreground mr-1">Setter:</span>
              <span className="text-info-foreground font-medium">{appointment.setter_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border border-muted rounded-md">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-1">Setter:</span>
              <span className="text-muted-foreground italic">Unassigned</span>
            </div>
          )}
          
          {appointment.closer_name ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded-md">
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground mr-1">Closer:</span>
              <span className="text-foreground font-medium">{appointment.closer_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border border-muted rounded-md">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-1">Closer:</span>
              <span className="text-muted-foreground italic">Unassigned</span>
            </div>
          )}
        </div>

        {/* Setter & Closer Notes - Collapsible */}
        <CollapsibleNotes 
          title="Setter Notes" 
          notes={appointment.setter_notes} 
          variant="setter" 
        />
        <CollapsibleNotes 
          title="Closer Notes" 
          notes={appointment.closer_notes} 
          variant="closer" 
        />

        {/* Add Update Section */}
        {showAddUpdate && (
          <div className="space-y-2">
            {showUpdateInput ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add an update..."
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  className="min-h-[60px] text-sm"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveUpdate}
                    disabled={!updateNote.trim() || savingUpdate}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {savingUpdate ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowUpdateInput(false);
                      setUpdateNote("");
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUpdateInput(true)}
                className="w-full"
              >
                <PenLine className="w-3 h-3 mr-1" />
                Add Update
              </Button>
            )}
          </div>
        )}

        {/* Double Book Warning (rebooking_type === 'reschedule') */}
        {(appointment as any).rebooking_type === 'reschedule' && appointment.original_appointment_id && (
          <div className="text-sm p-3 rounded-lg border-l-4 bg-amber-500/10 border-amber-400 dark:bg-amber-500/15">
            <strong className="text-amber-700 dark:text-amber-300">DOUBLE BOOK</strong>
            <span className="text-foreground/70"> — This lead has an existing appointment. Confirm which date is correct!</span>
          </div>
        )}

        {/* Rebook Warning (rebooking_type === 'rebooking' - original date passed) */}
        {(appointment as any).rebooking_type === 'rebooking' && appointment.original_appointment_id && (
          <div className="text-sm p-3 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
            <strong className="text-purple-700 dark:text-purple-300">REBOOK</strong>
            <span className="text-foreground/70"> — This lead previously booked after original date passed. Click "View" above to see history.</span>
          </div>
        )}

        {/* Generic Rebooked Lead Warning */}
        {appointment.original_appointment_id && !(appointment as any).rebooking_type && (
          <div className="text-sm p-3 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
            <strong className="text-purple-700 dark:text-purple-300">REBOOKED LEAD</strong>
            <span className="text-foreground/70"> — This lead has a previous booking. Click "View" above to see their booking history.</span>
          </div>
        )}

        {/* Lead Rebooked for New Time Warning */}
        {appointment.rescheduled_to_appointment_id && (
          <div className="text-sm p-3 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
            <strong className="text-purple-700 dark:text-purple-300">LEAD REBOOKED</strong>
            <span className="text-foreground/70"> — This lead booked a new appointment.{appointment.closer_name && ` Original closer: ${appointment.closer_name}.`} Click "View" above to see the new booking.</span>
          </div>
        )}

        {((appointment.cc_collected && appointment.cc_collected > 0) || (appointment.mrr_amount && appointment.mrr_amount > 0)) && (
          <div className="flex gap-2 pt-2 border-t border-border">
            {appointment.cc_collected && appointment.cc_collected > 0 && (
              <div className="flex-1 p-3 bg-success/10 border border-success/30 rounded-md text-center">
                <div className="text-2xl font-bold text-success tabular-nums">
                  ${appointment.cc_collected.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Cash Paid</div>
              </div>
            )}
            {appointment.mrr_amount && appointment.mrr_amount > 0 && (
              <div className="flex-1 p-3 bg-primary/10 border border-primary/30 rounded-md text-center">
                <div className="text-2xl font-bold text-primary tabular-nums">
                  ${appointment.mrr_amount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">per month</div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {teamId && showEditDialog && (
        <EditAppointmentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          appointment={appointment}
          teamId={teamId}
          onSuccess={() => {
            onUpdate?.();
          }}
        />
      )}
      
      <RescheduleHistory
        open={showRescheduleHistory}
        onOpenChange={setShowRescheduleHistory}
        appointmentId={appointment.id}
      />
    </Card>
  );
}
