import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, Clock, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ActivityLog {
  id: string;
  actor_name: string;
  action_type: string;
  note: string | null;
  created_at: string;
}

interface ActivityTimelineProps {
  appointmentId: string;
  teamId: string;
  onClose: () => void;
}

export function ActivityTimeline({ appointmentId, teamId, onClose }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<ActivityLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadActivities();

    const channel = supabase
      .channel(`activity-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `appointment_id=eq.${appointmentId}`
        },
        () => loadActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

 const loadActivities = async () => {
  try {
    if (!appointmentId) return;

    console.info('[ActivityTimeline][dev] Fetching activity timeline', {
      table: 'events',
      appointmentIdPresent: Boolean(appointmentId),
    });

    // 1) Get the appointment so we know which lead/session to load events for
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('lead_id, session_id')
      .eq('id', appointmentId)
      .single();

    if (apptError) {
      console.error('[ActivityTimeline][dev] Error loading appointment context', {
        code: (apptError as any).code,
        message: (apptError as any).message,
        details: (apptError as any).details,
        hint: (apptError as any).hint,
      });
      throw apptError;
    }

    // 2) Build the events query (canonical timeline)
    let query = supabase
      .from('events')
      .select('*')
      .order('occurred_at', { ascending: false });

    const usingLeadId = Boolean(appointment?.lead_id);
    const usingSessionId = !usingLeadId && Boolean(appointment?.session_id);

    if (usingLeadId && appointment?.lead_id) {
      query = query.eq('lead_id', appointment.lead_id);
    } else if (usingSessionId && appointment?.session_id) {
      query = query.eq('session_id', appointment.session_id);
    }

    console.info('[ActivityTimeline][dev] Executing events query', {
      table: 'events',
      usingLeadId,
      usingSessionId,
    });

    const { data, error } = await query;
    if (error) {
      console.error('[ActivityTimeline][dev] Error loading events', {
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }

    const rowCount = Array.isArray(data) ? data.length : 0;
    console.info('[ActivityTimeline][dev] Events query result', { rowCount });
    if (rowCount === 0) {
      console.info(
        '[ActivityTimeline][dev] Empty result from events. Possible causes: RLS blocking this user, wrong Supabase project, or filters not matching any rows.'
      );
    }

    const mapped: ActivityLog[] = (data || []).map((e: any) => {
  const payload = e?.payload ?? {};

  const actorName =
    payload.actor_name ||
    payload.user_name ||
    payload.actor ||
    'System';

  const note =
    payload.note ||
    payload.message ||
    payload.reason ||
    null;

  return {
    id: e.id,
    actor_name: String(actorName),
    action_type: String(e.event_type),
    note: note ? String(note) : null,
    created_at: e.created_at,
  };
});

setActivities(mapped);

  } catch (error: any) {
    console.error('[ActivityTimeline][dev] Error loading activities', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
  }
};


 const handleAddNote = async () => {
  if (!newNote.trim()) return;

  try {
    if (!appointmentId) return;

    // 1) Load appointment context
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('lead_id, session_id')
      .eq('id', appointmentId)
      .single();

    if (apptError) throw apptError;

    const leadId = appointment?.lead_id ?? null;
    const sessionId = appointment?.session_id ?? null;

    if (!leadId) {
      throw new Error('Missing lead_id for this appointment (cannot attach note to funnel context)');
    }

    // 2) Load funnel/step context from lead (required by record-funnel-event)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('funnel_id, step_id')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    const funnelId = lead?.funnel_id ?? null;
    const stepId = lead?.step_id ?? null;

    if (!funnelId || !stepId) {
      throw new Error('Missing funnel_id/step_id on lead (required by record-funnel-event)');
    }

    // 3) Dedupe key (unique per click)
    const dedupeKey = `note_added:${appointmentId}:${Date.now()}`;

    const payload = {
      note: newNote.trim(),
      appointment_id: appointmentId,
      lead_id: leadId,
      session_id: sessionId,
      funnel_id: funnelId,
      step_id: stepId,
      client_event_id:
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    const { error } = await supabase.functions.invoke('record-funnel-event', {
      body: {
        event_type: 'note_added',
        dedupe_key: dedupeKey,
        funnel_id: funnelId,
        step_id: stepId,
        payload,
      },
    });

    if (error) throw error;

    setNewNote('');
    await loadActivities();
  } catch (error) {
    console.error('Error adding note:', error);
  }
};


  const handleDeleteClick = (activity: ActivityLog) => {
    setActivityToDelete(activity);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activityToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', activityToDelete.id);

      if (error) throw error;

      toast.success('Activity deleted');
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'Confirmed': 'bg-green-100 text-green-700 border-green-200',
      'No-Show': 'bg-orange-100 text-orange-700 border-orange-200',
      'Rescheduled': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Canceled': 'bg-gray-100 text-gray-700 border-gray-200',
      'Deposit Collected': 'bg-teal-100 text-teal-700 border-teal-200',
      'Closed': 'bg-blue-100 text-blue-700 border-blue-200',
      'Disqualified': 'bg-red-100 text-red-700 border-red-200',
      'Note Added': 'bg-purple-100 text-purple-700 border-purple-200',
      'Task Claimed': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    };
    return colors[action] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <Card className="fixed right-4 top-20 w-96 shadow-lg z-50 max-h-[calc(100vh-6rem)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Activity Timeline</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={handleAddNote} 
            disabled={loading || !newNote.trim()}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet
              </p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="border-l-2 border-muted pl-4 pb-3 relative group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Badge variant="outline" className={getActionColor(activity.action_type)}>
                      {activity.action_type}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteClick(activity)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <User className="h-3 w-3" />
                    {activity.actor_name}
                  </div>
                  {activity.note && (
                    <p className="text-sm mt-1 bg-muted/50 p-2 rounded">
                      {activity.note}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
