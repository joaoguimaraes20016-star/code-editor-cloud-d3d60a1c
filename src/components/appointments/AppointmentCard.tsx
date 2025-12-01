import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { formatDateTimeWithTimezone } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User, Clock, MessageSquare, History, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import { RescheduleHistory } from "./RescheduleHistory";
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
  };
  teamId?: string;
  onUpdateStatus?: (id: string, status: string) => void;
  onCloseDeal?: (appointment: any) => void;
  onViewDetails?: (appointment: any) => void;
  onAssign?: () => void;
  onUpdate?: () => void;
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
}: AppointmentCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);
  const formattedDate = formatDateTimeWithTimezone(appointment.start_at_utc);

  // Check if this is a rescheduled appointment
  const isRescheduled = appointment.status === 'RESCHEDULED' || appointment.pipeline_stage === 'rescheduled';
  
  // Use stored original_closer_name from appointment record
  const originalCloserName = (appointment as any).original_closer_name;
  const hasCloserReassignment = originalCloserName && appointment.closer_name && originalCloserName !== appointment.closer_name;

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
          
          {/* Rescheduled Badge with Date */}
          {isRescheduled && (
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
          
          {appointment.original_appointment_id && (
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
              <span className="ml-1 px-1.5 py-0.5 bg-purple-400/30 rounded text-xs font-medium hover:bg-purple-400/40">
                View
              </span>
            </Badge>
          )}
          
          {appointment.rescheduled_to_appointment_id && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-purple-400/20 border-purple-400/50 text-purple-500 dark:text-purple-300 gap-1"
              onClick={() => setShowRescheduleHistory(true)}
            >
              <ArrowRight className="h-3 w-3" />
              Rebooked for a New Time
              <span className="ml-1 px-1.5 py-0.5 bg-purple-400/30 rounded text-xs font-medium hover:bg-purple-400/40">
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

        {appointment.setter_notes && (
          <div className="p-3 bg-chart-2/10 border border-chart-2/30 rounded-md">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-chart-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{appointment.setter_notes}</p>
            </div>
          </div>
        )}

        {/* Rebooked Lead Warning */}
        {appointment.original_appointment_id && (
          <div className="text-sm p-3 rounded-lg border-l-4 font-semibold shadow-sm bg-purple-100 border-purple-500 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100">
            <strong>REBOOKED LEAD</strong> — This lead has a previous booking. Click "View" above to see their booking history.
          </div>
        )}

        {/* Rebooked for New Time Warning */}
        {appointment.rescheduled_to_appointment_id && (
          <div className="text-sm p-3 rounded-lg border-l-4 font-semibold shadow-sm bg-purple-100 border-purple-500 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100">
            <strong>LEAD REBOOKED</strong> — This lead booked a new appointment. Click "View" above to see the new booking.
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
