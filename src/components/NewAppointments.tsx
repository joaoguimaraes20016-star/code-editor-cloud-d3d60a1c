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
import { Hand, Search, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

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

  const getFilteredByDate = (appointments: Appointment[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case "today":
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= today;
        });
      case "7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= sevenDaysAgo;
        });
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= thirtyDaysAgo;
        });
      case "custom":
        if (!customDateRange.from) return appointments;
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          const from = customDateRange.from!;
          const to = customDateRange.to || new Date();
          return aptDate >= from && aptDate <= to;
        });
      default:
        return appointments;
    }
  };

  const filteredAppointments = appointments
    .filter(apt => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        apt.lead_name.toLowerCase().includes(query) ||
        apt.lead_email.toLowerCase().includes(query) ||
        apt.closer_name?.toLowerCase().includes(query)
      );
    })
    .filter(apt => getFilteredByDate(appointments).includes(apt));

  if (appointments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No unassigned appointments available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by lead name, email, or closer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Tabs value={dateFilter} onValueChange={setDateFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="7days">7 Days</TabsTrigger>
              <TabsTrigger value="30days">30 Days</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !customDateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "LLL dd, y")} -{" "}
                        {format(customDateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(customDateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: customDateRange.from,
                    to: customDateRange.to,
                  }}
                  onSelect={(range) =>
                    setCustomDateRange({
                      from: range?.from,
                      to: range?.to,
                    })
                  }
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      
      {filteredAppointments.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">
          No appointments match your search
        </div>
      ) : (
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
          {filteredAppointments.map((apt) => (
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
        </div>
      )}

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
