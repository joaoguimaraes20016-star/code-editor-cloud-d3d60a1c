import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreVertical, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { DealAvatar } from "./DealAvatar";

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
      className="group bg-card p-4 cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div 
          {...attributes} 
          {...listeners} 
          className="opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {dealValue > 0 && (
          <div className="flex-1 flex flex-col items-start gap-0.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-md">
            <span className="text-[10px] uppercase tracking-wider font-medium opacity-70">Deal Value</span>
            <span className="text-lg font-bold tabular-nums">${dealValue.toLocaleString()}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
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

      <div className="space-y-2.5">
        <div>
          <h4 className="font-medium text-base mb-1 truncate">{appointment.lead_name}</h4>
          <p className="text-sm text-muted-foreground truncate">{appointment.lead_email}</p>
        </div>

        {appointment.setter_name && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <DealAvatar name={appointment.setter_name} className="h-7 w-7" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Closer</span>
              <span className="text-sm font-medium truncate">{appointment.setter_name}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Appointment</span>
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(appointment.start_at_utc), "MMM dd")}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">In Stage</span>
            <div className={`flex items-center gap-1.5 font-bold ${getDaysColor(daysInStage)}`}>
              <div className="h-2 w-2 rounded-full bg-current" />
              {daysInStage} {daysInStage === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
