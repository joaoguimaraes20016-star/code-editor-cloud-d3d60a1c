import { useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User, Clock, MessageSquare } from "lucide-react";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
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
  };
  teamId?: string;
  onUpdateStatus?: (id: string, status: string) => void;
  onCloseDeal?: (appointment: any) => void;
  onViewDetails?: (appointment: any) => void;
  onAssign?: () => void;
  onUpdate?: () => void;
}

const statusColors: Record<string, string> = {
  NEW: "default",
  SHOWED: "success",
  NO_SHOW: "destructive",
  CANCELLED: "secondary",
  CLOSED: "success",
  RESCHEDULED: "warning",
  CONFIRMED: "info",
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
  const formattedDate = format(new Date(appointment.start_at_utc), "MMM dd, yyyy 'at' h:mm a");

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
        <div className="flex items-center gap-2 ml-3">
          <Badge variant={statusColors[appointment.status] as any || "secondary"}>
            {appointment.status}
          </Badge>
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

        {(appointment.setter_name || appointment.closer_name) && (
          <div className="flex items-center gap-2 text-sm">
            {appointment.setter_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-info/10 border border-info/30 rounded-md">
                <User className="w-3.5 h-3.5 text-info" />
                <span className="text-info-foreground font-medium">{appointment.setter_name}</span>
              </div>
            )}
            {appointment.closer_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded-md">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground font-medium">{appointment.closer_name}</span>
              </div>
            )}
          </div>
        )}

        {appointment.setter_notes && (
          <div className="p-3 bg-chart-2/10 border border-chart-2/30 rounded-md">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-chart-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{appointment.setter_notes}</p>
            </div>
          </div>
        )}

        {(appointment.cc_collected || appointment.mrr_amount) && (
          <div className="flex gap-2 pt-2 border-t border-border">
            {appointment.cc_collected && (
              <div className="flex-1 p-3 bg-success/10 border border-success/30 rounded-md text-center">
                <div className="text-2xl font-bold text-success tabular-nums">
                  ${appointment.cc_collected.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Cash Paid</div>
              </div>
            )}
            {appointment.mrr_amount && (
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
    </Card>
  );
}
