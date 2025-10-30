import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { GripVertical, MoreVertical, Calendar, MessageSquare, Undo2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { DealAvatar } from "./DealAvatar";
import { ActivityTimeline } from "./ActivityTimeline";

interface DealCardProps {
  id: string;
  teamId: string;
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
    status: string | null;
  };
  onCloseDeal: (appointment: any) => void;
  onMoveTo: (id: string, stage: string) => void;
  onDelete?: (id: string) => void;
  onUndo?: (id: string) => void;
  onChangeStatus?: (id: string, currentStatus: string | null, dealName: string) => void;
  onClearDealData?: (id: string) => void;
  userRole?: string;
}

export function DealCard({ id, teamId, appointment, onCloseDeal, onMoveTo, onDelete, onUndo, onChangeStatus, onClearDealData, userRole }: DealCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const canDelete = userRole === 'admin' || userRole === 'offer_owner';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dealValue = (appointment.cc_collected || 0) + (appointment.mrr_amount || 0) * 12;
  const daysInStage = differenceInDays(new Date(), new Date(appointment.updated_at));
  
  const getDaysColor = (days: number) => {
    if (days < 7) return "text-success";
    if (days < 14) return "text-chart-2";
    return "text-destructive";
  };

  // Show revenue clearly
  const hasRevenue = (appointment.cc_collected || 0) > 0 || (appointment.mrr_amount || 0) > 0;
  const isNoShow = appointment.pipeline_stage === 'no_show';
  const isCancelled = appointment.pipeline_stage === 'cancelled';
  const isConfirmed = appointment.status === 'CONFIRMED' && !isNoShow && !isCancelled;
  const isRescheduled = appointment.status === 'RESCHEDULED' || appointment.pipeline_stage === 'rescheduled';
  const isClosed = appointment.pipeline_stage === 'won' || appointment.pipeline_stage?.toLowerCase().includes('closed');
  const showUndoButton = (isClosed || hasRevenue) && onUndo;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className="group relative bg-gradient-to-br from-card via-card/95 to-secondary/50 p-4 cursor-grab active:cursor-grabbing hover:shadow-glow hover:scale-[1.03] hover:border-primary/60 transition-all duration-300 border border-border/50 backdrop-blur-sm overflow-hidden select-none"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div 
            {...attributes} 
            {...listeners} 
            className="opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0 transition-opacity"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {hasRevenue && (
            <div className="flex-1 space-y-2">
              {appointment.cc_collected && appointment.cc_collected > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-success/10 border border-success/30 rounded-lg backdrop-blur-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-success font-bold uppercase tracking-wider">Cash Collected</span>
                    <span className="text-2xl font-black text-success tabular-nums">
                      ${appointment.cc_collected.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {appointment.mrr_amount && appointment.mrr_amount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/30 rounded-lg backdrop-blur-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Monthly Recurring</span>
                    <span className="text-2xl font-black text-primary tabular-nums">
                      ${appointment.mrr_amount.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1">
            {showUndoButton && (
              <Button 
                variant="outline" 
                size="sm"
                className="h-7 px-2 gap-1 bg-warning/10 hover:bg-warning/20 border-warning/30"
                onClick={() => onUndo!(id)}
              >
                <Undo2 className="h-3 w-3" />
                <span className="text-xs font-medium">Undo</span>
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setShowTimeline(!showTimeline)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  Edit Appointment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCloseDeal(appointment)}>
                  Close Deal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMoveTo(id, 'lost')}>
                  Mark as Lost
                </DropdownMenuItem>
                {onChangeStatus && (
                  <DropdownMenuItem onClick={() => onChangeStatus(id, appointment.status, appointment.lead_name)}>
                    Change Status
                  </DropdownMenuItem>
                )}
                {hasRevenue && onClearDealData && (
                  <DropdownMenuItem onClick={() => onClearDealData(id)}>
                    Clear Deal Data
                  </DropdownMenuItem>
                )}
                {canDelete && onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(id)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete Deal
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {isNoShow && (
            <Badge variant="default" className="bg-gradient-to-r from-red-600 to-rose-600 shadow-sm">
              <span className="flex items-center gap-1">
                ✗ No Show
              </span>
            </Badge>
          )}
          {isCancelled && (
            <Badge variant="default" className="bg-gradient-to-r from-gray-600 to-slate-600 shadow-sm">
              <span className="flex items-center gap-1">
                ✗ Cancelled
              </span>
            </Badge>
          )}
          {isConfirmed && (
            <Badge variant="default" className="bg-gradient-to-r from-green-600 to-emerald-600 shadow-sm">
              <span className="flex items-center gap-1">
                ✓ Confirmed
              </span>
            </Badge>
          )}
          {isRescheduled && (
            <Badge variant="default" className="bg-gradient-to-r from-yellow-600 to-amber-600 shadow-sm">
              <span className="flex items-center gap-1">
                ⟳ Rescheduled
              </span>
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <h4 className="font-medium text-base mb-1 truncate">{appointment.lead_name}</h4>
            <p className="text-sm text-muted-foreground truncate">{appointment.lead_email}</p>
          </div>

          {appointment.setter_name && (
            <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-muted/40 to-muted/20 rounded-lg border border-border/30">
              <DealAvatar name={appointment.setter_name} className="h-7 w-7 ring-2 ring-primary/20" />
              <span className="text-sm font-medium truncate">{appointment.setter_name}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-primary/10">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(appointment.start_at_utc), "MMM dd")}</span>
            </div>
            <div className={`flex items-center gap-1.5 font-bold ${getDaysColor(daysInStage)}`}>
              <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {daysInStage} {daysInStage === 1 ? 'day' : 'days'} ago
            </div>
          </div>
        </div>
        </div>
      </Card>
      
      {showTimeline && (
        <ActivityTimeline 
          appointmentId={appointment.id}
          teamId={teamId}
          onClose={() => setShowTimeline(false)}
        />
      )}
      
      {showEditDialog && (
        <EditAppointmentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          appointment={appointment}
          teamId={teamId}
        />
      )}
    </>
  );
}
