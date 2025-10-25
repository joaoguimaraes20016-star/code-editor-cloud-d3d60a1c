import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Target, MessageCircle, Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
  status: string;
  setter_id: string | null;
  setter_name: string | null;
  pipeline_stage: string | null;
  retarget_date: string | null;
  retarget_reason: string | null;
  setter_notes: string | null;
}

interface RetargetTabProps {
  teamId: string;
}

export function RetargetTab({ teamId }: RetargetTabProps) {
  const [dueToday, setDueToday] = useState<Appointment[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApt, setSelectedApt] = useState<string | null>(null);
  const [retargetDate, setRetargetDate] = useState('');
  const [retargetReason, setRetargetReason] = useState('');
  const [rebookDialog, setRebookDialog] = useState<{ open: boolean; appointmentId: string; appointmentName: string } | null>(null);
  const [rebookDateTime, setRebookDateTime] = useState<Date>();

  useEffect(() => {
    loadRetargetQueue();

    const channel = supabase
      .channel('retarget-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => loadRetargetQueue()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadRetargetQueue = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('retarget_date', 'is', null)
        .order('retarget_date', { ascending: true });

      if (error) throw error;

      const due = data?.filter(apt => apt.retarget_date && apt.retarget_date <= today) || [];
      const later = data?.filter(apt => apt.retarget_date && apt.retarget_date > today) || [];

      setDueToday(due);
      setUpcoming(later);
    } catch (error) {
      console.error('Error loading retarget queue:', error);
      toast.error('Failed to load retarget queue');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          retarget_date: null,
          retarget_reason: null
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Removed from retarget queue');
      loadRetargetQueue();
    } catch (error) {
      console.error('Error dismissing retarget:', error);
      toast.error('Failed to dismiss');
    }
  };

  const handleRebook = (appointmentId: string, appointmentName: string) => {
    setRebookDialog({ open: true, appointmentId, appointmentName });
    setRebookDateTime(undefined);
  };

  const handleRebookConfirm = async () => {
    if (!rebookDialog || !rebookDateTime) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'RESCHEDULED',
          pipeline_stage: 'rescheduled',
          start_at_utc: rebookDateTime.toISOString(),
          retarget_date: null,
          retarget_reason: null
        })
        .eq('id', rebookDialog.appointmentId);

      if (error) throw error;

      toast.success('Rebooked successfully');
      setRebookDialog(null);
      setRebookDateTime(undefined);
      loadRetargetQueue();
    } catch (error) {
      console.error('Error rebooking:', error);
      toast.error('Failed to rebook');
    }
  };

  const handleFollowedUp = async (appointmentId: string) => {
    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from('appointments')
        .update({ 
          setter_notes: `[FOLLOWED_UP:${timestamp}] Followed up from retarget queue`
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Marked as followed up');
      loadRetargetQueue();
    } catch (error) {
      console.error('Error marking followed up:', error);
      toast.error('Failed to mark as followed up');
    }
  };

  const handleMarkForRetarget = async () => {
    if (!selectedApt || !retargetDate) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          retarget_date: retargetDate,
          retarget_reason: retargetReason || null
        })
        .eq('id', selectedApt);

      if (error) throw error;

      toast.success('Marked for retarget');
      setSelectedApt(null);
      setRetargetDate('');
      setRetargetReason('');
      loadRetargetQueue();
    } catch (error) {
      console.error('Error marking for retarget:', error);
      toast.error('Failed to mark for retarget');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const AppointmentCard = ({ apt, isDue }: { apt: Appointment; isDue: boolean }) => {
    const isCloseDue = apt.retarget_reason?.toLowerCase().includes('close due');
    const isFollowedUp = apt.setter_notes?.includes('[FOLLOWED_UP:');
    
    return (
      <Card key={apt.id} className={cn("bg-background", isFollowedUp && "border-green-200 dark:border-green-900")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <p className="font-semibold">{apt.lead_name}</p>
              <p className="text-sm text-muted-foreground">{apt.lead_email}</p>
              {apt.retarget_reason && (
                <p className="text-sm border-l-2 pl-3 text-muted-foreground">
                  {apt.retarget_reason}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {apt.pipeline_stage || 'No Stage'}
                </Badge>
                {apt.retarget_date && (
                  <Badge variant={isDue ? 'destructive' : 'secondary'} className="text-xs">
                    {isDue ? 'Due Today' : `Due ${formatDate(apt.retarget_date)}`}
                  </Badge>
                )}
                {isFollowedUp && (
                  <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                    ✓ Followed Up
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isCloseDue ? (
              <Button 
                size="sm"
                onClick={() => handleFollowedUp(apt.id)}
                disabled={isFollowedUp}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Close Deal
              </Button>
            ) : (
              <Button 
                size="sm"
                onClick={() => handleRebook(apt.id, apt.lead_name)}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                Rebook
              </Button>
            )}
            <Button 
              size="sm" 
              variant={isFollowedUp ? "default" : "outline"}
              onClick={() => handleFollowedUp(apt.id)}
              disabled={isFollowedUp}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {isFollowedUp ? 'Followed Up ✓' : 'Mark Followed Up'}
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => handleDismiss(apt.id)}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Retarget Queue</h2>
        </div>
      </div>

      {/* Due Today Section */}
      <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-600" />
            Due Today
            <Badge variant="destructive" className="ml-auto">
              {dueToday.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dueToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retargets due today</p>
          ) : (
            dueToday.map((apt) => <AppointmentCard key={apt.id} apt={apt} isDue={true} />)
          )}
        </CardContent>
      </Card>

      {/* Upcoming Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Upcoming
            <Badge variant="secondary" className="ml-auto">
              {upcoming.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming retargets</p>
          ) : (
            upcoming.map((apt) => <AppointmentCard key={apt.id} apt={apt} isDue={false} />)
          )}
        </CardContent>
      </Card>

      {/* Rebook Dialog */}
      {rebookDialog && (
        <Dialog open={rebookDialog.open} onOpenChange={(open) => !open && setRebookDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rebook Appointment</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Setting new appointment date/time for <span className="font-semibold">{rebookDialog.appointmentName}</span>
              </p>
              
              <div className="space-y-2">
                <Label>Select New Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rebookDateTime ? format(rebookDateTime, "PPP 'at' p") : "Pick a date and time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rebookDateTime}
                      onSelect={(date) => {
                        if (date) {
                          // If no time set yet, default to 9 AM
                          const newDate = rebookDateTime ? new Date(date) : new Date(date.setHours(9, 0, 0, 0));
                          if (rebookDateTime) {
                            newDate.setHours(rebookDateTime.getHours(), rebookDateTime.getMinutes());
                          }
                          setRebookDateTime(newDate);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {rebookDateTime && (
                      <div className="p-3 border-t">
                        <Label className="text-xs">Time</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="time"
                            value={rebookDateTime ? format(rebookDateTime, "HH:mm") : ""}
                            onChange={(e) => {
                              if (rebookDateTime && e.target.value) {
                                const [hours, minutes] = e.target.value.split(':');
                                const newDate = new Date(rebookDateTime);
                                newDate.setHours(parseInt(hours), parseInt(minutes));
                                setRebookDateTime(newDate);
                              }
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRebookDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleRebookConfirm} disabled={!rebookDateTime}>
                Confirm Rebook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
