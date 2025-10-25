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

  // Show revenue clearly
  const hasRevenue = (appointment.cc_collected || 0) > 0 || (appointment.mrr_amount || 0) > 0;

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
        
        {hasRevenue && (
          <div className="flex-1 grid grid-cols-2 gap-2">
            {appointment.cc_collected && appointment.cc_collected > 0 && (
              <div className="flex flex-col items-center px-2 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/30 rounded-md">
                <span className="text-xs text-green-600 dark:text-green-500 font-medium">Cash</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                  ${appointment.cc_collected.toLocaleString()}
                </span>
              </div>
            )}
            {appointment.mrr_amount && appointment.mrr_amount > 0 && (
              <div className="flex flex-col items-center px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 rounded-md">
                <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">Monthly</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ${appointment.mrr_amount.toLocaleString()}
                </span>
              </div>
            )}
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
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
            <DealAvatar name={appointment.setter_name} className="h-7 w-7" />
            <span className="text-sm font-medium truncate">{appointment.setter_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(appointment.start_at_utc), "MMM dd")}</span>
          </div>
          <div className={`flex items-center gap-1.5 font-bold ${getDaysColor(daysInStage)}`}>
            <div className="h-2 w-2 rounded-full bg-current" />
            {daysInStage} {daysInStage === 1 ? 'day' : 'days'} ago
          </div>
        </div>
      </div>
    </Card>
  );
}
