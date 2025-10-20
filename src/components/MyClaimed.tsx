import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MessageSquare, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { CloseDealDialog } from "@/components/CloseDealDialog";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: 'NEW' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED';
  setter_notes: string | null;
  setter_id: string | null;
  setter_name: string | null;
}

interface MyClaimedProps {
  teamId: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function MyClaimed({ teamId, closerCommissionPct, setterCommissionPct }: MyClaimedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [closeDealOpen, setCloseDealOpen] = useState(false);
  const [closeDealAppointment, setCloseDealAppointment] = useState<Appointment | null>(null);

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
      setAppointments((data || []) as Appointment[]);
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

  const handleStatusChange = async (id: string, newStatus: 'NEW' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Appointment status changed to ${newStatus}`,
      });

      // Update local state
      setAppointments(prev =>
        prev.map(apt => apt.id === id ? { ...apt, status: newStatus as Appointment['status'] } : apt)
      );
    } catch (error: any) {
      toast({
        title: 'Error updating status',
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

  return isMobile ? (
    // Mobile Card View
    <div className="space-y-3">
      {appointments.map((apt) => (
        <Card key={apt.id} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{apt.lead_name}</h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{apt.lead_email}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{formatLocalTime(apt.start_at_utc)}</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select 
                value={apt.status} 
                onValueChange={(value: 'NEW' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => handleStatusChange(apt.id, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  <SelectItem value="RESCHEDULED">RESCHEDULED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Textarea
                value={editingNotes[apt.id] !== undefined ? editingNotes[apt.id] : (apt.setter_notes || '')}
                onChange={(e) => handleNotesChange(apt.id, e.target.value)}
                onBlur={() => handleNotesBlur(apt.id)}
                placeholder="Add notes..."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
          
          <CardFooter className="p-3 pt-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setCloseDealAppointment(apt);
                setCloseDealOpen(true);
              }}
              className="w-full h-10 text-sm"
            >
              Close Deal
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  ) : (
    // Desktop Table View
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Start Time</TableHead>
            <TableHead>Lead Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Setter Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
            <TableRow key={apt.id}>
              <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
              <TableCell className="font-medium">{apt.lead_name}</TableCell>
              <TableCell>{apt.lead_email}</TableCell>
              <TableCell>
                <Select 
                  value={apt.status} 
                  onValueChange={(value: 'NEW' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'CLOSED') => handleStatusChange(apt.id, value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    <SelectItem value="RESCHEDULED">RESCHEDULED</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    value={editingNotes[apt.id] !== undefined ? editingNotes[apt.id] : (apt.setter_notes || '')}
                    onChange={(e) => handleNotesChange(apt.id, e.target.value)}
                    onBlur={() => handleNotesBlur(apt.id)}
                    placeholder="Add notes..."
                    className="max-w-md"
                  />
                  {apt.setter_notes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96">
                        <div className="space-y-2">
                          <h4 className="font-medium">Setter Notes</h4>
                          <Textarea
                            value={editingNotes[apt.id] !== undefined ? editingNotes[apt.id] : apt.setter_notes}
                            onChange={(e) => handleNotesChange(apt.id, e.target.value)}
                            onBlur={() => handleNotesBlur(apt.id)}
                            className="min-h-[120px]"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setCloseDealAppointment(apt);
                    setCloseDealOpen(true);
                  }}
                  className="flex items-center gap-1"
                >
                  Close Deal
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CloseDealDialog
        appointment={closeDealAppointment}
        teamId={teamId}
        open={closeDealOpen}
        onOpenChange={setCloseDealOpen}
        onSuccess={loadAppointments}
        closerCommissionPct={closerCommissionPct}
        setterCommissionPct={setterCommissionPct}
      />
    </div>
  );
}
