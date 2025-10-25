import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User, Clock, MessageSquare } from "lucide-react";
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
    start_at_utc: string;
    status: string;
    setter_name: string | null;
    closer_name: string | null;
    event_type_name: string | null;
    setter_notes: string | null;
    cc_collected: number | null;
    mrr_amount: number | null;
  };
  onUpdateStatus?: (id: string, status: string) => void;
  onCloseDeal?: (appointment: any) => void;
  onViewDetails?: (appointment: any) => void;
  onAssign?: () => void;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300",
  SHOWED: "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300",
  NO_SHOW: "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-900 dark:bg-gray-900/20 dark:text-gray-300",
  CLOSED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300",
  RESCHEDULED: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300",
  CONFIRMED: "bg-purple-100 text-purple-900 dark:bg-purple-900/20 dark:text-purple-300",
};

export function AppointmentCard({
  appointment,
  onUpdateStatus,
  onCloseDeal,
  onViewDetails,
  onAssign,
}: AppointmentCardProps) {
  const formattedDate = format(new Date(appointment.start_at_utc), "MMM dd, yyyy 'at' h:mm a");

  return (
    <Card className="p-4 hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium truncate">{appointment.lead_name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{appointment.lead_email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <Badge className={statusColors[appointment.status] || ""}>{appointment.status}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAssign && (
                <DropdownMenuItem onClick={onAssign}>
                  Assign
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

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{formattedDate}</span>
        </div>

        {appointment.event_type_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{appointment.event_type_name}</span>
          </div>
        )}

        {appointment.setter_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Setter: {appointment.setter_name}</span>
          </div>
        )}

        {appointment.closer_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Closer: {appointment.closer_name}</span>
          </div>
        )}

        {appointment.setter_notes && (
          <div className="flex items-start gap-2 text-muted-foreground mt-3 p-2 bg-muted/50 rounded">
            <MessageSquare className="w-4 h-4 mt-0.5" />
            <span className="text-xs">{appointment.setter_notes}</span>
          </div>
        )}

        {(appointment.cc_collected || appointment.mrr_amount) && (
          <div className="flex gap-3 mt-3 pt-3 border-t">
            {appointment.cc_collected && (
              <div>
                <span className="text-xs text-muted-foreground">CC:</span>
                <span className="ml-1 font-medium">${appointment.cc_collected.toLocaleString()}</span>
              </div>
            )}
            {appointment.mrr_amount && (
              <div>
                <span className="text-xs text-muted-foreground">MRR:</span>
                <span className="ml-1 font-medium">${appointment.mrr_amount.toLocaleString()}/mo</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
