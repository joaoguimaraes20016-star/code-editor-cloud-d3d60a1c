import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Hand } from "lucide-react";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  closer_name: string | null;
}

interface TeamMember {
  user_id: string;
  profiles: {
    full_name: string;
  };
}

interface NewAppointmentsProps {
  teamId: string;
}

export function NewAppointments({ teamId }: NewAppointmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedSetter, setSelectedSetter] = useState<string>("");
  const [selectedCloser, setSelectedCloser] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadTeamMembers();
    loadAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('new-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          console.log('New appointments realtime event:', payload);
          loadAppointments();
        }
      )
      .subscribe((status) => {
        console.log('New appointments subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, profiles!inner(full_name)')
        .eq('team_id', teamId);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      console.error('Error loading team members:', error);
    }
  };

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .is('setter_id', null)
        .order('start_at_utc', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading appointments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSelectedSetter("");
    setSelectedCloser("");
    setNotes("");
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedAppointment || !selectedSetter) return;

    setAssigning(true);
    try {
      const selectedSetterMember = teamMembers.find(m => m.user_id === selectedSetter);
      const selectedCloserMember = selectedCloser && selectedCloser !== "none" 
        ? teamMembers.find(m => m.user_id === selectedCloser) 
        : null;
      
      // Build update object - only include closer fields if explicitly changing
      const updateData: any = {
        setter_id: selectedSetter,
        setter_name: selectedSetterMember?.profiles.full_name || "",
        setter_notes: notes || null,
      };

      // Only update closer if one was selected (not "none")
      if (selectedCloser && selectedCloser !== "none") {
        updateData.closer_id = selectedCloser;
        updateData.closer_name = selectedCloserMember?.profiles.full_name || null;
      }
      
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      toast({
        title: 'Appointment assigned',
        description: `Assigned to setter: ${selectedSetterMember?.profiles.full_name}${selectedCloserMember ? `, closer: ${selectedCloserMember.profiles.full_name}` : ''}`,
      });

      setAssignDialogOpen(false);
      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error assigning appointment',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const formatLocalTime = (utcTime: string) => {
    return format(new Date(utcTime), 'MMM d, yyyy h:mm a');
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No unassigned appointments available
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Start Time</TableHead>
            <TableHead>Lead Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
            <TableRow key={apt.id}>
              <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
              <TableCell className="font-medium">{apt.lead_name}</TableCell>
              <TableCell>{apt.lead_email}</TableCell>
              <TableCell>
                {apt.closer_name ? (
                  <span className="text-sm">{apt.closer_name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not assigned</span>
                )}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {apt.status}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  onClick={() => handleOpenAssignDialog(apt)}
                  className="flex items-center gap-1"
                >
                  <Hand className="h-3 w-3" />
                  Assign
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Appointment</DialogTitle>
            <DialogDescription>
              Assign this appointment to a setter and add notes
            </DialogDescription>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm"><strong>Lead:</strong> {selectedAppointment.lead_name}</p>
                <p className="text-sm"><strong>Email:</strong> {selectedAppointment.lead_email}</p>
                <p className="text-sm"><strong>Time:</strong> {formatLocalTime(selectedAppointment.start_at_utc)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setter">Select Setter</Label>
                <Select value={selectedSetter} onValueChange={setSelectedSetter}>
                  <SelectTrigger id="setter">
                    <SelectValue placeholder="Choose a setter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="closer">Select Closer (Optional)</Label>
                <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                  <SelectTrigger id="closer">
                    <SelectValue placeholder="Choose a closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this appointment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedSetter || assigning}
            >
              {assigning ? "Assigning..." : "Assign Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
