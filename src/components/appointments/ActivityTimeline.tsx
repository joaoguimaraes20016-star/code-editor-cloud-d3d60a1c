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
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const { error } = await supabase.from('activity_logs').insert({
        team_id: teamId,
        appointment_id: appointmentId,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Unknown',
        action_type: 'Note Added',
        note: newNote
      });

      if (error) throw error;

      setNewNote('');
      toast.success('Note added');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setLoading(false);
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
