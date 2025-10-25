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
    <Card className="p-5 hover:shadow-md transition-shadow animate-fade-in border-l-4 border-l-primary/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-1 truncate">{appointment.lead_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span className="truncate">{appointment.lead_email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <Badge className={statusColors[appointment.status] || ""} variant="secondary">
            {appointment.status}
          </Badge>
          {onAssign ? (
            <Button onClick={onAssign} size="sm" className="shrink-0">
              Assign to Setter
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 p-2.5 bg-muted/50 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Appointment Time</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-medium">{formattedDate}</span>
            </div>
          </div>

          {appointment.event_type_name && (
            <div className="flex flex-col gap-1 p-2.5 bg-muted/50 rounded-lg">
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Event Type</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium truncate">{appointment.event_type_name}</span>
              </div>
            </div>
          )}
        </div>

        {(appointment.setter_name || appointment.closer_name) && (
          <div className="grid grid-cols-2 gap-3">
            {appointment.setter_name && (
              <div className="flex flex-col gap-1 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider font-medium text-blue-700 dark:text-blue-400">Setter</span>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span className="text-sm font-medium truncate">{appointment.setter_name}</span>
                </div>
              </div>
            )}

            {appointment.closer_name && (
              <div className="flex flex-col gap-1 p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider font-medium text-purple-700 dark:text-purple-400">Closer</span>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                  <span className="text-sm font-medium truncate">{appointment.closer_name}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {appointment.setter_notes && (
          <div className="flex flex-col gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider font-medium text-amber-700 dark:text-amber-400">Setter Notes</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{appointment.setter_notes}</p>
          </div>
        )}

        {(appointment.cc_collected || appointment.mrr_amount) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            {appointment.cc_collected && (
              <div className="flex flex-col gap-1 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider font-medium text-green-700 dark:text-green-400">Cash Collected</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                  ${appointment.cc_collected.toLocaleString()}
                </span>
              </div>
            )}
            {appointment.mrr_amount && (
              <div className="flex flex-col gap-1 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider font-medium text-emerald-700 dark:text-emerald-400">Monthly Revenue</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ${appointment.mrr_amount.toLocaleString()}/mo
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
