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
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-900 dark:text-blue-300 font-medium">{appointment.setter_name}</span>
              </div>
            )}
            {appointment.closer_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/30 rounded-md">
                <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-900 dark:text-purple-300 font-medium">{appointment.closer_name}</span>
              </div>
            )}
          </div>
        )}

        {appointment.setter_notes && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/30 rounded-md">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200">{appointment.setter_notes}</p>
            </div>
          </div>
        )}

        {(appointment.cc_collected || appointment.mrr_amount) && (
          <div className="flex gap-2 pt-2 border-t">
            {appointment.cc_collected && (
              <div className="flex-1 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/30 rounded-md text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                  ${appointment.cc_collected.toLocaleString()}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500 mt-1">Cash Paid</div>
              </div>
            )}
            {appointment.mrr_amount && (
              <div className="flex-1 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 rounded-md text-center">
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ${appointment.mrr_amount.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">per month</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
