import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreVertical, DollarSign, Calendar, User } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface DealCardProps {
  id: string;
  appointment: {
    id: string;
    lead_name: string;
    lead_email: string;
    start_at_utc: string;
    cc_collected: number | null;
    mrr_amount: number | null;
    setter_name: string | null;
    updated_at: string;
    pipeline_stage: string | null;
  };
  onCloseDeal: (appointment: any) => void;
  onMoveTo: (id: string, stage: string) => void;
}

export function DealCard({ id, appointment, onCloseDeal, onMoveTo }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dealValue = (appointment.cc_collected || 0) + (appointment.mrr_amount || 0) * 12;
  const daysInStage = differenceInDays(new Date(), new Date(appointment.updated_at));
  
  const getDaysColor = (days: number) => {
    if (days < 7) return "text-green-600 dark:text-green-400";
    if (days < 14) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab mt-0.5 flex-shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-0.5 truncate">{appointment.lead_name}</h4>
            <p className="text-xs text-muted-foreground truncate">{appointment.lead_email}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCloseDeal(appointment)}>
              Close Deal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveTo(id, 'lost')}>
              Mark as Lost
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dealValue > 0 && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-muted/50 rounded">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">${dealValue.toLocaleString()}</span>
        </div>
      )}

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {appointment.setter_name && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span className="truncate">{appointment.setter_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          <span>{format(new Date(appointment.start_at_utc), "MMM dd, yyyy")}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${getDaysColor(daysInStage)}`}>
          <div className="h-1.5 w-1.5 rounded-full bg-current" />
          {daysInStage}d in stage
        </div>
      </div>
    </Card>
  );
}
