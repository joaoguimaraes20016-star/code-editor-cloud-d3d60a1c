import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface ConfirmationProgressTrackerProps {
  task: Task;
}

export function ConfirmationProgressTracker({ task }: ConfirmationProgressTrackerProps) {
  const { completed_confirmations, required_confirmations, confirmation_attempts, due_at, is_overdue } = task;
  
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
  
  return (
    <div className="space-y-3">
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
                      {format(new Date(attempt.timestamp), 'MMM d, h:mm a')}
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