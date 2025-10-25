import { Button } from "@/components/ui/button";
import { 
  CalendarCheck, 
  CalendarX, 
  Calendar, 
  MessageCircle, 
  Target,
  CheckCircle2,
  XCircle,
  Archive
} from "lucide-react";

interface StageActionMenuProps {
  appointmentId: string;
  pipelineStage: string | null;
  onConfirm?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onNoShow?: (id: string) => void;
  onRebook?: (id: string) => void;
  onRetarget?: (id: string) => void;
  onDisqualify?: (id: string) => void;
  onMoveToClosed?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function StageActionMenu({ 
  appointmentId, 
  pipelineStage,
  onConfirm,
  onReschedule,
  onNoShow,
  onRebook,
  onRetarget,
  onDisqualify,
  onMoveToClosed,
  onArchive
}: StageActionMenuProps) {
  
  // Appointment Booked actions
  if (pipelineStage === 'booked' || !pipelineStage) {
    return (
      <div className="flex gap-2 flex-wrap">
        {onConfirm && (
          <Button size="sm" onClick={() => onConfirm(appointmentId)}>
            <CalendarCheck className="h-4 w-4 mr-1" />
            Confirm
          </Button>
        )}
        {onReschedule && (
          <Button size="sm" variant="outline" onClick={() => onReschedule(appointmentId)}>
            <Calendar className="h-4 w-4 mr-1" />
            Reschedule
          </Button>
        )}
        {onNoShow && (
          <Button size="sm" variant="outline" onClick={() => onNoShow(appointmentId)}>
            <CalendarX className="h-4 w-4 mr-1" />
            No-Show
          </Button>
        )}
      </div>
    );
  }

  // No-Show actions
  if (pipelineStage === 'no_show') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onRebook && (
          <Button size="sm" onClick={() => onRebook(appointmentId)}>
            <Calendar className="h-4 w-4 mr-1" />
            Rebook
          </Button>
        )}
        {onRetarget && (
          <Button size="sm" variant="outline" onClick={() => onRetarget(appointmentId)}>
            <Target className="h-4 w-4 mr-1" />
            Retarget
          </Button>
        )}
        {onDisqualify && (
          <Button size="sm" variant="outline" onClick={() => onDisqualify(appointmentId)}>
            <XCircle className="h-4 w-4 mr-1" />
            Disqualify
          </Button>
        )}
      </div>
    );
  }

  // Canceled actions
  if (pipelineStage === 'canceled') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onRebook && (
          <Button size="sm" onClick={() => onRebook(appointmentId)}>
            <Calendar className="h-4 w-4 mr-1" />
            Rebook
          </Button>
        )}
        {onRetarget && (
          <Button size="sm" variant="outline" onClick={() => onRetarget(appointmentId)}>
            <Target className="h-4 w-4 mr-1" />
            Retarget
          </Button>
        )}
        {onDisqualify && (
          <Button size="sm" variant="outline" onClick={() => onDisqualify(appointmentId)}>
            <XCircle className="h-4 w-4 mr-1" />
            Disqualify
          </Button>
        )}
      </div>
    );
  }

  // Confirmed/Rescheduled actions
  if (pipelineStage === 'confirmed' || pipelineStage === 'rescheduled') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onNoShow && (
          <Button size="sm" variant="outline" onClick={() => onNoShow(appointmentId)}>
            <CalendarX className="h-4 w-4 mr-1" />
            No-Show
          </Button>
        )}
      </div>
    );
  }

  // Deposit Collected actions
  if (pipelineStage === 'deposit') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onMoveToClosed && (
          <Button size="sm" onClick={() => onMoveToClosed(appointmentId)}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Move to Closed
          </Button>
        )}
      </div>
    );
  }

  // Closed actions
  if (pipelineStage === 'won') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onArchive && (
          <Button size="sm" variant="outline" onClick={() => onArchive(appointmentId)}>
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>
        )}
      </div>
    );
  }

  // Disqualified actions
  if (pipelineStage === 'disqualified') {
    return (
      <div className="flex gap-2 flex-wrap">
        {onRetarget && (
          <Button size="sm" onClick={() => onRetarget(appointmentId)}>
            <Target className="h-4 w-4 mr-1" />
            Retarget
          </Button>
        )}
      </div>
    );
  }

  // Default actions for unknown stages
  return (
    <div className="flex gap-2 flex-wrap">
      {onReschedule && (
        <Button size="sm" variant="outline" onClick={() => onReschedule(appointmentId)}>
          <Calendar className="h-4 w-4 mr-1" />
          Reschedule
        </Button>
      )}
    </div>
  );
}
