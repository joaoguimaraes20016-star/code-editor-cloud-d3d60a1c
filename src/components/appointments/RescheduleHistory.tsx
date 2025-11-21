import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarIcon, ArrowRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DealAvatar } from "./DealAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTimeWithTimezone } from "@/lib/utils";

interface RescheduleHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
}

interface AppointmentHistory {
  id: string;
  lead_name: string;
  start_at_utc: string;
  setter_name: string | null;
  closer_name: string | null;
  status: string | null;
  pipeline_stage: string | null;
  reschedule_count: number;
  created_at: string;
  original_appointment_id: string | null;
  rescheduled_to_appointment_id: string | null;
}

export function RescheduleHistory({ open, onOpenChange, appointmentId }: RescheduleHistoryProps) {
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && appointmentId) {
      loadRescheduleChain();
    }
  }, [open, appointmentId]);

  const loadRescheduleChain = async () => {
    setLoading(true);
    try {
      // First, find the root of the chain by following original_appointment_id backwards
      let currentId = appointmentId;
      let rootId = appointmentId;
      
      while (currentId) {
        const { data, error } = await supabase
          .from('appointments')
          .select('original_appointment_id')
          .eq('id', currentId)
          .single();
        
        if (error || !data?.original_appointment_id) break;
        rootId = data.original_appointment_id;
        currentId = data.original_appointment_id;
      }

      // Now follow the chain forward from the root
      const chain: AppointmentHistory[] = [];
      currentId = rootId;

      while (currentId) {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id,
            lead_name,
            start_at_utc,
            setter_name,
            closer_name,
            status,
            pipeline_stage,
            reschedule_count,
            created_at,
            original_appointment_id,
            rescheduled_to_appointment_id
          `)
          .eq('id', currentId)
          .single();

        if (error || !data) break;
        
        chain.push(data);
        currentId = data.rescheduled_to_appointment_id;
      }

      setHistory(chain);
    } catch (error) {
      console.error('Error loading reschedule history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {history.map((appt, index) => (
                <div key={appt.id} className="relative">
                  <div className={`p-4 rounded-lg border ${
                    appt.id === appointmentId 
                      ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20' 
                      : 'bg-card border-border'
                  }`}>
                    {/* Header with version badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          {index === 0 ? "Original" : "New Date"}
                        </Badge>
                        {appt.id === appointmentId && (
                          <Badge variant="outline">Current View</Badge>
                        )}
                      </div>
                      {appt.pipeline_stage && (
                        <Badge variant={appt.pipeline_stage === 'rescheduled' ? "warning" : "info"}>
                          {appt.pipeline_stage}
                        </Badge>
                      )}
                    </div>

                    {/* Appointment date and time */}
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {formatDateTimeWithTimezone(appt.start_at_utc, "PPP 'at' p")}
                      </span>
                    </div>

                    {/* Team members */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {appt.setter_name && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20">
                          <DealAvatar name={appt.setter_name} className="h-6 w-6" />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-primary/70 font-semibold uppercase">Setter</span>
                            <span className="text-xs font-medium">{appt.setter_name}</span>
                          </div>
                        </div>
                      )}
                      {appt.closer_name && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-md border border-accent/20">
                          <DealAvatar name={appt.closer_name} className="h-6 w-6" />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-accent/70 font-semibold uppercase">Closer</span>
                            <span className="text-xs font-medium">{appt.closer_name}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Created date */}
                    <div className="mt-3 text-xs text-muted-foreground">
                      Created {formatDateTimeWithTimezone(appt.created_at, "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>

                  {/* Arrow connector to next version */}
                  {index < history.length - 1 && (
                    <div className="flex items-center justify-center py-2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {history.length === 1 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No reschedules found for this appointment.</p>
                </div>
              )}

              {history.length > 1 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Total Reschedules:</span> {history.length - 1}
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
