import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, Phone, Calendar, XCircle } from "lucide-react";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConfirmationAttempt {
  timestamp: string;
  confirmed_by: string;
  notes: string;
  sequence: number;
}

interface Task {
  id: string;
  completed_confirmations: number;
  required_confirmations: number;
  confirmation_attempts: ConfirmationAttempt[];
  due_at: string | null;
  is_overdue: boolean;
  confirmation_sequence: number;
  task_type?: string;
  appointment_id: string;
}

interface ConfirmationProgressTrackerProps {
  task: Task;
  onUpdate?: () => void;
}

export function ConfirmationProgressTracker({ task, onUpdate }: ConfirmationProgressTrackerProps) {
  const { completed_confirmations, required_confirmations, confirmation_attempts, due_at, is_overdue, task_type } = task;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const getUrgencyStatus = () => {
    if (is_overdue) return { 
      color: "destructive" as const, 
      label: "OVERDUE", 
      pulse: true 
    };
    
    if (!due_at) return { 
      color: "secondary" as const, 
      label: "Scheduled", 
      pulse: false 
    };
    
    const now = new Date();
    const dueTime = new Date(due_at);
    const hoursUntil = (dueTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntil < 0) return { 
      color: "destructive" as const, 
      label: "DUE NOW", 
      pulse: true 
    };
    if (hoursUntil < 0.17) return { 
      color: "destructive" as const, 
      label: "< 10min", 
      pulse: true 
    };
    if (hoursUntil < 1) return { 
      color: "default" as const, 
      label: "< 1hr", 
      pulse: true 
    };
    if (hoursUntil < 24) return { 
      color: "default" as const, 
      label: "< 24hrs", 
      pulse: true 
    };
    return { 
      color: "secondary" as const, 
      label: "Scheduled", 
      pulse: false 
    };
  };
  
  const urgency = getUrgencyStatus();
  const percentage = (completed_confirmations / required_confirmations) * 100;
  
  const handleConfirm = async () => {
    setLoading(true);
    try {
      const newConfirmationCount = completed_confirmations + 1;
      const newAttempts = [
        ...(confirmation_attempts || []),
        {
          timestamp: new Date().toISOString(),
          confirmed_by: "Current User",
          notes: "Confirmed via UI",
          sequence: newConfirmationCount
        }
      ];

      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          completed_confirmations: newConfirmationCount,
          confirmation_attempts: newAttempts as any,
          status: newConfirmationCount >= required_confirmations ? 'completed' : 'pending'
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({ title: "Confirmed", description: "Confirmation recorded successfully" });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleNoAnswer = async () => {
    setLoading(true);
    try {
      const newAttempts = [
        ...(confirmation_attempts || []),
        {
          timestamp: new Date().toISOString(),
          confirmed_by: "Current User",
          notes: "No Answer",
          sequence: 0
        }
      ];

      const { error } = await supabase
        .from('confirmation_tasks')
        .update({
          confirmation_attempts: newAttempts as any,
          status: 'no_answer'
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({ title: "Marked as No Answer" });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    toast({ title: "Reschedule", description: "Reschedule dialog coming soon" });
  };

  const getTaskTypeBadge = () => {
    if (task_type === 'call_confirmation') return { label: "Call Confirmation", variant: "default" };
    if (task_type === 'follow_up') return { label: "Follow Up", variant: "secondary" };
    if (task_type === 'reschedule') return { label: "Reschedule", variant: "default" };
    return { label: "Task", variant: "secondary" };
  };

  const taskTypeBadge = getTaskTypeBadge();
  
  return (
    <div className="space-y-3">
      {/* Task Type Badge */}
      <div className="flex items-center justify-between">
        <Badge variant={taskTypeBadge.variant as any} className="text-xs">
          <Phone className="h-3 w-3 mr-1" />
          {taskTypeBadge.label}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            {completed_confirmations}/{required_confirmations} confirmations
          </span>
          <Badge 
            variant={urgency.color}
            className={cn(urgency.pulse && "animate-pulse")}
          >
            {urgency.label}
          </Badge>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          size="sm" 
          onClick={handleConfirm}
          disabled={loading || completed_confirmations >= required_confirmations}
          className="gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          Confirm
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleNoAnswer}
          disabled={loading}
          className="gap-1"
        >
          <XCircle className="h-3 w-3" />
          No Answer
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleReschedule}
          disabled={loading}
          className="gap-1"
        >
          <Calendar className="h-3 w-3" />
          Reschedule
        </Button>
      </div>

      {/* Time until due */}
      {due_at && !is_overdue && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Next due: {formatDistanceToNow(new Date(due_at), { addSuffix: true })}</span>
        </div>
      )}
      
      {/* Confirmation History (expandable) */}
      {confirmation_attempts && confirmation_attempts.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="history" className="border-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                View {confirmation_attempts.length} Confirmation{confirmation_attempts.length > 1 ? 's' : ''}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {confirmation_attempts.map((attempt, idx) => (
                  <div key={idx} className="flex justify-between text-xs border-l-2 border-green-500 pl-3 py-1">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        ✓ Confirmation {attempt.sequence || idx + 1}
                      </div>
                      {attempt.notes && (
                        <div className="text-muted-foreground italic mt-1">
                          "{attempt.notes}"
                        </div>
                      )}
                    </div>
                    <div className="text-muted-foreground text-right ml-2">
                      {formatDateTimeWithTimezone(attempt.timestamp, 'MMM d, h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}