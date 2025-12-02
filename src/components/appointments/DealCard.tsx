import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import { RescheduleHistory } from "./RescheduleHistory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { GripVertical, MoreVertical, Calendar, MessageSquare, Undo2, History, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { formatDateTimeWithTimezone } from "@/lib/utils";
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
    closer_name: string | null;
    updated_at: string;
    pipeline_stage: string | null;
    status: string | null;
    original_appointment_id: string | null;
    rescheduled_to_appointment_id: string | null;
    reschedule_count: number;
    rebooking_type?: string | null;
    retarget_date?: string | null;
    closer_id?: string | null;
  };
  confirmationTask?: {
    completed_confirmations: number;
    required_confirmations: number;
    status: string;
  } | null;
  onCloseDeal: (appointment: any) => void;
  onMoveTo: (id: string, stage: string) => void;
  onDelete?: (id: string) => void;
  onUndo?: (id: string) => void;
  onChangeStatus?: (id: string, currentStatus: string | null, dealName: string) => void;
  onClearDealData?: (id: string) => void;
  userRole?: string;
  allowSetterPipelineUpdates?: boolean;
}

export function DealCard({ id, teamId, appointment, confirmationTask, onCloseDeal, onMoveTo, onDelete, onUndo, onChangeStatus, onClearDealData, userRole, allowSetterPipelineUpdates }: DealCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);

  // Use stored original_closer_name from appointment record
  const originalCloserName = (appointment as any).original_closer_name;
  const hasCloserReassignment = originalCloserName && appointment.closer_name && originalCloserName !== appointment.closer_name;
  
  // Determine if the user can drag this card
  const canDrag = !(userRole === 'setter' && !allowSetterPipelineUpdates);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag });

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
  const isRebookingConflict = appointment.pipeline_stage === 'rebooking_conflict';
  const hasRebookingType = appointment.rebooking_type && ['rebooking', 'reschedule', 'returning_client', 'win_back'].includes(appointment.rebooking_type);
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
          {canDrag && (
            <div 
              {...attributes} 
              {...listeners} 
              className="opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0 transition-opacity"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          
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
                {canDrag && (
                  <DropdownMenuItem onClick={() => onMoveTo(id, 'lost')}>
                    Mark as Lost
                  </DropdownMenuItem>
                )}
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
          {/* Confirmation Status Badge */}
          {confirmationTask && (
            <>
              {confirmationTask.completed_confirmations >= confirmationTask.required_confirmations ? (
                <Badge variant="confirmed" className="shadow-sm">
                  <span className="flex items-center gap-1">
                    ✓ Confirmed
                  </span>
                </Badge>
              ) : confirmationTask.completed_confirmations > 0 ? (
                <Badge variant="confirmed" className="shadow-sm">
                  <span className="flex items-center gap-1">
                    Confirmed {confirmationTask.completed_confirmations}/{confirmationTask.required_confirmations}
                  </span>
                </Badge>
              ) : (
                <Badge variant="pending" className="shadow-sm">
                  <span className="flex items-center gap-1">
                    Pending Confirmation
                  </span>
                </Badge>
              )}
            </>
          )}
          
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
          {isConfirmed && !confirmationTask && (
            <Badge variant="confirmed" className="shadow-sm">
              <span className="flex items-center gap-1">
                ✓ Confirmed
              </span>
            </Badge>
          )}
          {isRescheduled && !appointment.original_appointment_id && !appointment.rescheduled_to_appointment_id && (
            <Badge variant="rescheduled" className="shadow-sm">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Rescheduled
                {appointment.retarget_date && (
                  <span className="ml-1">
                    for {format(parseISO(appointment.retarget_date), "MMM d")}
                  </span>
                )}
              </span>
            </Badge>
          )}
          {/* Closer Reassignment Warning - On-brand styling */}
          {hasCloserReassignment && (
            <Badge variant="outline" className="border-warning bg-warning/10 text-warning-foreground shadow-sm">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Reassigned: {originalCloserName} → {appointment.closer_name}
              </span>
            </Badge>
          )}
          {/* Rebooking Conflict Warning - BOTH appointments need confirmation */}
          {isRebookingConflict && (
            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm animate-pulse">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Rebooking Conflict
              </span>
            </Badge>
          )}
          {/* Rebooking Type Badges */}
          {appointment.rebooking_type === 'rebooking' && (
            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Rebook
              </span>
            </Badge>
          )}
          {appointment.rebooking_type === 'reschedule' && (
            <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Double Book
              </span>
            </Badge>
          )}
          {appointment.rebooking_type === 'returning_client' && (
            <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm">
              <span className="flex items-center gap-1">
                Returning Client
              </span>
            </Badge>
          )}
          {appointment.rebooking_type === 'win_back' && (
            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
              <span className="flex items-center gap-1">
                Win-Back
              </span>
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <h4 className="font-medium text-base mb-1 truncate">{appointment.lead_name}</h4>
            <p className="text-sm text-muted-foreground truncate">{appointment.lead_email}</p>
          </div>

          {/* Reschedule Badges */}
          {(appointment.original_appointment_id || appointment.rescheduled_to_appointment_id) && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Double Book badge (reschedule type) */}
              {appointment.rebooking_type === 'reschedule' && appointment.original_appointment_id && (
                <Badge 
                  className="bg-amber-500 text-white border-0 cursor-pointer hover:bg-amber-600 flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRescheduleHistory(true);
                  }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Double Book
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold">
                    View
                  </span>
                </Badge>
              )}
              {/* Rebook badge (rebooking type) */}
              {appointment.rebooking_type === 'rebooking' && appointment.original_appointment_id && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-purple-400/20 border-purple-400/50 text-purple-500 dark:text-purple-300 flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRescheduleHistory(true);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Rebook
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-400/30 rounded text-[10px] font-bold hover:bg-purple-400/40">
                    View
                  </span>
                </Badge>
              )}
              {/* Generic rebooked lead badge */}
              {appointment.original_appointment_id && !appointment.rebooking_type && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-purple-400/20 border-purple-400/50 text-purple-500 dark:text-purple-300 flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRescheduleHistory(true);
                  }}
                >
                  <History className="h-3 w-3" />
                  Rebooked Lead
                  {appointment.reschedule_count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-400/40 rounded-full text-[10px] font-bold">
                      {appointment.reschedule_count}x
                    </span>
                  )}
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-400/30 rounded text-[10px] font-bold hover:bg-purple-400/40">
                    View
                  </span>
                </Badge>
              )}
              {appointment.rescheduled_to_appointment_id && (
                <Badge 
                  className="bg-purple-500 text-white border-0 cursor-pointer hover:bg-purple-600 flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRescheduleHistory(true);
                  }}
                >
                  <ArrowRight className="h-3 w-3" />
                  Lead Rebooked
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold">
                    View
                  </span>
                </Badge>
              )}
            </div>
          )}

          {/* Team Members - Always Show Both Fields */}
          <div className="flex items-center gap-2 flex-wrap">
            {appointment.setter_name ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 flex-1 min-w-0">
                <DealAvatar name={appointment.setter_name} className="h-7 w-7 ring-2 ring-primary/30" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-primary/70 font-semibold uppercase tracking-wider">Setter</span>
                  <span className="text-xs font-medium truncate">{appointment.setter_name}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-muted flex-1 min-w-0">
                <DealAvatar name="?" className="h-7 w-7 ring-2 ring-muted" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Setter</span>
                  <span className="text-xs text-muted-foreground italic">Unassigned</span>
                </div>
              </div>
            )}
            
            {appointment.closer_name ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg border border-accent/20 flex-1 min-w-0">
                <DealAvatar name={appointment.closer_name} className="h-7 w-7 ring-2 ring-accent/30" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-accent/70 font-semibold uppercase tracking-wider">Closer</span>
                  <span className="text-xs font-medium truncate">{appointment.closer_name}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-muted flex-1 min-w-0">
                <DealAvatar name="?" className="h-7 w-7 ring-2 ring-muted" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Closer</span>
                  <span className="text-xs text-muted-foreground italic">Unassigned</span>
                </div>
              </div>
            )}
          </div>

          {/* Double Book Warning (reschedule type) */}
          {appointment.rebooking_type === 'reschedule' && appointment.original_appointment_id && (
            <div className="text-xs p-2.5 rounded-lg border-l-4 bg-amber-500/10 border-amber-400 dark:bg-amber-500/15">
              <strong className="text-amber-700 dark:text-amber-300">DOUBLE BOOK</strong>
              <span className="text-foreground/70"> — This lead has an existing appointment. Confirm which date is correct!</span>
            </div>
          )}

          {/* Rebook Warning (rebooking type - original date passed) */}
          {appointment.rebooking_type === 'rebooking' && appointment.original_appointment_id && (
            <div className="text-xs p-2.5 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
              <strong className="text-purple-700 dark:text-purple-300">REBOOK</strong>
              <span className="text-foreground/70"> — This lead previously booked (after original date passed). Click "View" above.</span>
            </div>
          )}

          {/* Generic rebooked lead (no rebooking_type but has original) */}
          {appointment.original_appointment_id && !appointment.rebooking_type && (
            <div className="text-xs p-2.5 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
              <strong className="text-purple-700 dark:text-purple-300">REBOOKED LEAD</strong>
              <span className="text-foreground/70"> — This lead has a previous booking. Click "View" above to see history.</span>
            </div>
          )}

          {/* Original appointment that has a new booking */}
          {appointment.rescheduled_to_appointment_id && (
            <div className="text-xs p-2.5 rounded-lg border-l-4 bg-purple-500/10 border-purple-400 dark:bg-purple-500/15">
              <strong className="text-purple-700 dark:text-purple-300">LEAD REBOOKED</strong>
              <span className="text-foreground/70"> — This lead booked a new appointment.{appointment.closer_name && ` Original closer: ${appointment.closer_name}.`} Click "View" above.</span>
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs pt-2 border-t border-primary/10">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">{formatDateTimeWithTimezone(appointment.start_at_utc, "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            <div className={`flex items-center gap-1.5 font-bold ${getDaysColor(daysInStage)}`}>
              <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {daysInStage} {daysInStage === 1 ? 'day' : 'days'} in stage
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

      {showRescheduleHistory && (
        <RescheduleHistory
          open={showRescheduleHistory}
          onOpenChange={setShowRescheduleHistory}
          appointmentId={appointment.id}
        />
      )}
    </>
  );
}
