import { format, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User, Phone, Clock, MessageSquare, DollarSign, UserPlus, Users, CheckCircle, Edit, CalendarClock, Wallet, AlertCircle, Wrench, Target } from "lucide-react";
import { useState } from "react";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import { ConfirmationProgressTracker } from "./ConfirmationProgressTracker";
import { RescheduleWithLinkDialog } from "./RescheduleWithLinkDialog";
import { toast } from "sonner";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";

interface HorizontalAppointmentCardProps {
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
    reschedule_url: string | null;
  };
  confirmationTask?: {
    id: string;
    completed_confirmations: number;
    required_confirmations: number;
    confirmation_attempts: any[];
    due_at: string | null;
    is_overdue: boolean;
    confirmation_sequence: number;
    assigned_role?: string | null;
    routing_mode?: string | null;
  } | null;
  teamId?: string;
  userRole?: string;
  showAssignButton?: boolean;
  showReassignButton?: boolean;
  showCloseDealButton?: boolean;
  showEditButton?: boolean;
  showRescheduleButton?: boolean;
  onAssign?: () => void;
  onReassign?: () => void;
  onCloseDeal?: () => void;
  onDepositClick?: () => void;
  onUpdate?: () => void;
}

const statusColors: Record<string, { badge: string; border: string }> = {
  NEW: { badge: "pending", border: "border-l-orange-500" },
  SHOWED: { badge: "confirmed", border: "border-l-green-500" },
  NO_SHOW: { badge: "destructive", border: "border-l-red-500" },
  CANCELLED: { badge: "secondary", border: "border-l-gray-400" },
  CLOSED: { badge: "confirmed", border: "border-l-green-600" },
  RESCHEDULED: { badge: "rescheduled", border: "border-l-yellow-500" },
  CONFIRMED: { badge: "confirmed", border: "border-l-green-500" },
};

export function HorizontalAppointmentCard({
  appointment,
  confirmationTask,
  teamId,
  userRole,
  showAssignButton,
  showReassignButton,
  showCloseDealButton,
  showEditButton = true,
  showRescheduleButton = false,
  onAssign,
  onReassign,
  onCloseDeal,
  onDepositClick,
  onUpdate,
}: HorizontalAppointmentCardProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const formattedDate = formatDateTimeWithTimezone(appointment.start_at_utc);
  const statusStyle = statusColors[appointment.status] || statusColors.NEW;
  
  // Always show "Pending Confirmation" instead of "NEW"
  const displayStatus = appointment.status === 'NEW' 
    ? 'Pending Confirmation' 
    : appointment.status;

  // Determine visual indicators
  const appointmentDate = parseISO(appointment.start_at_utc);
  const isAppointmentToday = isToday(appointmentDate);
  const isAppointmentOverdue = isBefore(appointmentDate, startOfDay(new Date()));
  const isTaskDueToday = confirmationTask?.due_at ? isToday(parseISO(confirmationTask.due_at)) : false;
  const isTaskOverdue = confirmationTask?.is_overdue || false;

  const handleReschedule = async (reason: string, notes?: string) => {
    toast.success("Reschedule link sent to client");
    setShowRescheduleDialog(false);
    onUpdate?.();
  };

  const renderRoleBadge = () => {
    if (!confirmationTask?.assigned_role) return null;
    
    return (
      <Badge variant={confirmationTask.assigned_role === "setter" ? "default" : "secondary"} className="gap-1">
        {confirmationTask.assigned_role === "setter" ? (
          <>
            <Wrench className="h-3 w-3" />
            Setter Task
          </>
        ) : (
          <>
            <Target className="h-3 w-3" />
            Closer Task
          </>
        )}
      </Badge>
    );
  };

  return (
    <Card className={cn(
      "p-4 hover:shadow-md transition-all duration-200 border-l-4 group",
      isTaskOverdue 
        ? "border-red-600 bg-gradient-to-r from-red-500/10 to-transparent" 
        : statusStyle.border
    )}>
      {/* Setter View ONLY: Show confirmation task */}
      {confirmationTask && userRole === 'setter' && (
        <div className="mb-4 pb-4 border-b">
          {confirmationTask.due_at && (
            <div className="flex items-center justify-between gap-4 mb-3">
              {/* Deadline */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  new Date() >= new Date(confirmationTask.due_at)
                    ? 'bg-destructive/10' 
                    : 'bg-primary/10'
                }`}>
                  <Clock className={`w-5 h-5 ${
                    new Date() >= new Date(confirmationTask.due_at) ? 'text-destructive' : 'text-primary'
                  }`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {new Date() >= new Date(confirmationTask.due_at) ? 'Action Required' : 'Confirm Before (1hr before call)'}
                  </p>
                  <p className={`text-2xl font-bold ${
                    new Date() >= new Date(confirmationTask.due_at) ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {new Date() >= new Date(confirmationTask.due_at) 
                      ? 'CONFIRM NOW' 
                      : formatDateTimeWithTimezone(confirmationTask.due_at, "h:mm a")}
                  </p>
                </div>
              </div>

              {/* Appointment Time */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Call Time</p>
                <p className="text-lg font-semibold">{formatDateTimeWithTimezone(appointment.start_at_utc, "h:mm a")}</p>
              </div>
            </div>
          )}

          {/* Progress Tracker */}
          <ConfirmationProgressTracker 
            task={{ ...confirmationTask, appointment_id: appointment.id }} 
            onUpdate={onUpdate}
          />
        </div>
      )}

      {/* Closers don't see confirmation tasks - those are for setters */}
      
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Lead Information - Left Section */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold truncate">{appointment.lead_name}</h3>
            <Badge variant={statusStyle.badge as any} className="text-xs">
              {displayStatus}
            </Badge>
            {renderRoleBadge()}
            {/* Visual Indicators */}
            {isTaskOverdue && (
              <Badge className="text-xs font-bold bg-red-600 text-white border-0 animate-pulse">
                <AlertCircle className="w-3 h-3 mr-1" />
                OVERDUE
              </Badge>
            )}
            {!isTaskOverdue && isAppointmentOverdue && (
              <Badge className="text-xs font-semibold bg-red-500 text-white border-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                Appointment Overdue
              </Badge>
            )}
            {isTaskDueToday && !isTaskOverdue && (
              <Badge className="text-xs font-semibold bg-amber-500 text-white border-0">
                <Clock className="w-3 h-3 mr-1" />
                Task Due Today
              </Badge>
            )}
            {isAppointmentToday && !isAppointmentOverdue && (
              <Badge className="text-xs font-semibold bg-green-500 text-white border-0">
                <Calendar className="w-3 h-3 mr-1" />
                Appointment Today
              </Badge>
            )}
          </div>
          
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{appointment.lead_email}</span>
            </div>
            {appointment.lead_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{appointment.lead_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Appointment Details - Center Section */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          
          {appointment.event_type_name && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{appointment.event_type_name}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {appointment.setter_name ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-info/10 border border-info/30 rounded text-xs">
                <User className="w-3 h-3 text-info" />
                <span className="font-medium">Setter: {appointment.setter_name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-muted rounded text-xs">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground italic">Setter: Unassigned</span>
              </div>
            )}
            
            {appointment.closer_name ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/30 rounded text-xs">
                <User className="w-3 h-3 text-primary" />
                <span className="font-medium">Closer: {appointment.closer_name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-muted rounded text-xs">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground italic">Closer: Unassigned</span>
              </div>
            )}
          </div>

          {/* Financial Info */}
          {(!!((appointment.cc_collected && appointment.cc_collected > 0) || (appointment.mrr_amount && appointment.mrr_amount > 0))) && (
            <div className="flex gap-2 text-xs">
              {appointment.cc_collected && appointment.cc_collected > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-success/10 border border-success/30 rounded">
                  <DollarSign className="w-3 h-3 text-success" />
                  <span className="font-semibold text-success">${appointment.cc_collected.toLocaleString()}</span>
                  <span className="text-muted-foreground">paid</span>
                </div>
              )}
              {appointment.mrr_amount && appointment.mrr_amount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/30 rounded">
                  <DollarSign className="w-3 h-3 text-primary" />
                  <span className="font-semibold text-primary">${appointment.mrr_amount.toLocaleString()}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions - Right Section */}
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex gap-2">
            {teamId && showEditButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditDialog(true)}
                className="flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </Button>
            )}
            
            {showAssignButton && onAssign && (
              <Button
                size="sm"
                onClick={onAssign}
                className="flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Assign</span>
              </Button>
            )}
            
            {showReassignButton && onReassign && (
              <Button
                size="sm"
                variant="outline"
                onClick={onReassign}
                className="flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Reassign</span>
              </Button>
            )}
            
            {showRescheduleButton && appointment.reschedule_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRescheduleDialog(true)}
                className="flex items-center gap-1.5"
              >
                <CalendarClock className="w-4 h-4" />
                <span>Reschedule</span>
              </Button>
            )}

            {userRole === 'closer' && onDepositClick && appointment.status !== 'CLOSED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onDepositClick}
                className="flex items-center gap-1.5"
              >
                <Wallet className="w-4 h-4" />
                <span>Deposit</span>
              </Button>
            )}
            
            {showCloseDealButton && onCloseDeal && appointment.status !== 'CLOSED' && (
              <Button
                size="sm"
                onClick={onCloseDeal}
                className="flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Close Deal</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section - Collapsible */}
      {appointment.setter_notes && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">Setter Notes</span>
            <span className="text-xs">({notesExpanded ? 'hide' : 'show'})</span>
          </button>
          {notesExpanded && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
              {appointment.setter_notes}
            </div>
          )}
        </div>
      )}

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

      {appointment.reschedule_url && showRescheduleDialog && (
        <RescheduleWithLinkDialog
          open={showRescheduleDialog}
          onOpenChange={setShowRescheduleDialog}
          rescheduleUrl={appointment.reschedule_url}
          appointmentName={appointment.lead_name}
          appointmentId={appointment.id}
          onConfirm={handleReschedule}
        />
      )}
    </Card>
  );
}
