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
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  setter_notes: string | null;
}

interface MyClaimedProps {
  teamId: string;
}

export function MyClaimed({ teamId }: MyClaimedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('my-claimed-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user]);

  const loadAppointments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .eq('setter_id', user.id)
        .order('start_at_utc', { ascending: false });

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

  const handleNotesChange = (id: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [id]: value }));
  };

  const handleNotesBlur = async (id: string) => {
    const notes = editingNotes[id];
    if (notes === undefined) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ setter_notes: notes })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Notes updated',
        description: 'Setter notes have been saved',
      });

      // Update local state
      setAppointments(prev =>
        prev.map(apt => apt.id === id ? { ...apt, setter_notes: notes } : apt)
      );
      
      // Clear editing state
      setEditingNotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error: any) {
      toast({
        title: 'Error updating notes',
        description: error.message,
        variant: 'destructive',
      });
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
        No assigned appointments yet
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
            <TableHead>Status</TableHead>
            <TableHead>Setter Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
            <TableRow key={apt.id}>
              <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
              <TableCell className="font-medium">{apt.lead_name}</TableCell>
              <TableCell>{apt.lead_email}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                  {apt.status}
                </span>
              </TableCell>
              <TableCell>
                <Input
                  value={editingNotes[apt.id] !== undefined ? editingNotes[apt.id] : (apt.setter_notes || '')}
                  onChange={(e) => handleNotesChange(apt.id, e.target.value)}
                  onBlur={() => handleNotesBlur(apt.id)}
                  placeholder="Add notes..."
                  className="max-w-md"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
