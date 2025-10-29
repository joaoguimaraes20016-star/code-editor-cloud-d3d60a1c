import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, CalendarClock, CheckCircle2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RescheduleWithLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleUrl: string;
  appointmentName: string;
  appointmentId: string;
  onConfirm: (reason: string, notes?: string) => Promise<void>;
}

type DialogState = 'initial' | 'sending' | 'awaiting_client' | 'rescheduled';

export function RescheduleWithLinkDialog({
  open,
  onOpenChange,
  rescheduleUrl,
  appointmentName,
  appointmentId,
  onConfirm,
}: RescheduleWithLinkDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>('initial');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(rescheduleUrl);
      setCopied(true);
      toast.success("Reschedule link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  // Listen for appointment status changes
  useEffect(() => {
    if (!open || !appointmentId) return;

    const channel = supabase
      .channel(`appointment-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `id=eq.${appointmentId}`
        },
        (payload) => {
          if (payload.new.status === 'RESCHEDULED') {
            setDialogState('rescheduled');
            toast.success("Client rescheduled successfully!");
            
            // Close after showing success
            setTimeout(() => {
              onOpenChange(false);
              setReason("");
              setNotes("");
              setDialogState('initial');
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, appointmentId, onOpenChange]);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for reschedule");
      return;
    }
    
    setDialogState('sending');
    try {
      await onConfirm(reason, notes || undefined);
      setDialogState('awaiting_client');
      toast.success("Link sent! Waiting for client to reschedule...");
    } catch (error) {
      console.error("Error sending reschedule request:", error);
      toast.error("Failed to send reschedule request");
      setDialogState('initial');
    }
  };

  const handleClose = () => {
    if (dialogState === 'awaiting_client') {
      toast.info("Task is still awaiting client reschedule");
      return;
    }
    onOpenChange(false);
    setReason("");
    setNotes("");
    setDialogState('initial');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => {
        if (dialogState === 'awaiting_client') {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogState === 'awaiting_client' ? (
              <>
                <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                <span className="text-amber-600">Waiting for Client</span>
              </>
            ) : dialogState === 'rescheduled' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-green-600">Successfully Rescheduled!</span>
              </>
            ) : (
              <>
                <CalendarClock className="h-5 w-5 text-amber-600" />
                Send Reschedule Link
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {dialogState === 'rescheduled' ? (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✓ {appointmentName} has rescheduled their appointment successfully!
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                A new confirmation task has been created for the new date.
              </p>
            </div>
          ) : dialogState === 'awaiting_client' ? (
            <>
              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Waiting for {appointmentName} to reschedule
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  The dialog will automatically close when they complete the reschedule.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Calendly Reschedule Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={rescheduleUrl} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(rescheduleUrl, '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Rescheduling appointment with <span className="font-medium">{appointmentName}</span>
              </p>

              {/* Calendly Reschedule Link */}
              <div className="space-y-2">
                <Label>Calendly Reschedule Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={rescheduleUrl} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(rescheduleUrl, '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with the client so they can reschedule their appointment
                </p>
              </div>

              {/* Reason for Reschedule */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-destructive">
                  Reason for Reschedule *
                </Label>
                <Input
                  id="reason"
                  placeholder="Client requested different time, scheduling conflict..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={dialogState === 'sending'}
                  required
                />
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional context or instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={dialogState === 'sending'}
                  rows={3}
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  After you mark this as "Awaiting Reschedule", this dialog will stay open until the client completes their reschedule via Calendly.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {dialogState === 'initial' || dialogState === 'sending' ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={dialogState === 'sending'}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={dialogState === 'sending'}>
                {dialogState === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Mark as Awaiting Reschedule"
                )}
              </Button>
            </>
          ) : dialogState === 'awaiting_client' ? (
            <Button variant="outline" onClick={() => toast.info("Waiting for client to reschedule")}>
              <Clock className="h-4 w-4 mr-2" />
              Close When Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
