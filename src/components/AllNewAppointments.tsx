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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Search, CalendarIcon, Trash2, Clock, Mail, User, Hand } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { EventTypeFilter } from "@/components/EventTypeFilter";
import { CloseDealDialog } from "@/components/CloseDealDialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  closer_name: string | null;
  event_type_uri: string | null;
  event_type_name: string | null;
  setter_id: string | null;
  setter_name: string | null;
}

interface TeamMember {
  user_id: string;
  profiles: {
    full_name: string;
  };
}

interface AllNewAppointmentsProps {
  teamId: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function AllNewAppointments({ teamId, closerCommissionPct, setterCommissionPct }: AllNewAppointmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignAppointment, setAssignAppointment] = useState<Appointment | null>(null);
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<{ calendly_access_token: string | null; calendly_organization_uri: string | null } | null>(null);
  const [closeDealOpen, setCloseDealOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadTeamData();
    loadTeamMembers();
    loadAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('all-new-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          console.log('All new appointments realtime event:', payload);
          loadAppointments();
        }
      )
      .subscribe((status) => {
        console.log('All new appointments subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user]);

  const loadTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('calendly_access_token, calendly_organization_uri')
        .eq('id', teamId)
        .maybeSingle();

      if (error) throw error;
      setTeamData(data);
    } catch (error: any) {
      console.error('Error loading team data:', error);
    }
  };

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
        .in('status', ['NEW', 'CONFIRMED'])
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

  const handleOpenDeleteDialog = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleOpenAssignDialog = (appointment: Appointment) => {
    setAssignAppointment(appointment);
    setSelectedSetter("");
    setSelectedCloser("");
    setNotes("");
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!assignAppointment || !selectedSetter) return;

    setAssigning(true);
    try {
      const selectedSetterMember = teamMembers.find(m => m.user_id === selectedSetter);
      const selectedCloserMember = selectedCloser && selectedCloser !== "none" 
        ? teamMembers.find(m => m.user_id === selectedCloser) 
        : null;
      
      const updateData: any = {
        setter_id: selectedSetter,
        setter_name: selectedSetterMember?.profiles.full_name || "",
        setter_notes: notes || null,
      };

      if (selectedCloser && selectedCloser !== "none") {
        updateData.closer_id = selectedCloser;
        updateData.closer_name = selectedCloserMember?.profiles.full_name || null;
      }
      
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', assignAppointment.id);

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

  const handleDelete = async () => {
    const idsToDelete = appointmentToDelete 
      ? [appointmentToDelete.id] 
      : Array.from(selectedAppointments);

    if (idsToDelete.length === 0) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast({
        title: 'Appointments deleted',
        description: `Deleted ${idsToDelete.length} appointment${idsToDelete.length > 1 ? 's' : ''}`,
      });

      setDeleteDialogOpen(false);
      setSelectedAppointments(new Set());
      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error deleting appointments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleAppointmentSelection = (id: string) => {
    const newSelected = new Set(selectedAppointments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAppointments(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedAppointments.size === filteredAppointments.length) {
      setSelectedAppointments(new Set());
    } else {
      setSelectedAppointments(new Set(filteredAppointments.map(apt => apt.id)));
    }
  };

  const handleBulkDelete = () => {
    setAppointmentToDelete(null);
    setDeleteDialogOpen(true);
  };

  const handleOpenCloseDeal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCloseDealOpen(true);
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
      case "last7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= sevenDaysAgo && aptDate <= now;
        });
      case "last30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= thirtyDaysAgo && aptDate <= now;
        });
      case "next7days":
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= now && aptDate <= sevenDaysFromNow;
        });
      case "next30days":
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        return appointments.filter(apt => {
          const aptDate = new Date(apt.start_at_utc);
          return aptDate >= now && aptDate <= thirtyDaysFromNow;
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

  const filteredAppointments = getFilteredByDate(appointments)
    .filter(apt => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        apt.lead_name.toLowerCase().includes(query) ||
        apt.lead_email.toLowerCase().includes(query) ||
        apt.closer_name?.toLowerCase().includes(query) ||
        apt.setter_name?.toLowerCase().includes(query) ||
        apt.event_type_name?.toLowerCase().includes(query)
      );
    })
    .filter(apt => {
      if (!eventTypeFilter) return true;
      return apt.event_type_uri === eventTypeFilter;
    });

  return (
    <div className="space-y-4">
      {selectedAppointments.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedAppointments.size} appointment{selectedAppointments.size > 1 ? 's' : ''} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedAppointments(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by lead, email, setter, closer, or event type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <Select value={dateFilter} onValueChange={(value) => {
              setDateFilter(value);
              if (value === "custom") {
                if (isMobile) {
                  setDateDrawerOpen(true);
                }
              }
            }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="next7days">Next 7 Days</SelectItem>
                <SelectItem value="next30days">Next 30 Days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
              
            <EventTypeFilter
              teamId={teamId}
              onFilterChange={setEventTypeFilter}
              calendlyAccessToken={teamData?.calendly_access_token}
              calendlyOrgUri={teamData?.calendly_organization_uri}
            />
          </div>
        </div>
        
        {dateFilter === "custom" && !isMobile && (
          <div>
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
          </div>
        )}

        {dateFilter === "custom" && isMobile && (
          <Drawer open={dateDrawerOpen} onOpenChange={setDateDrawerOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Select Date Range</DrawerTitle>
                <DrawerDescription>
                  Choose a custom date range to filter appointments
                </DrawerDescription>
              </DrawerHeader>
              <div className="w-full px-2 pb-4">
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
                  numberOfMonths={1}
                  className={cn("p-3")}
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No appointments found
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredAppointments.map((apt) => (
            <Card key={apt.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedAppointments.has(apt.id)}
                      onCheckedChange={() => toggleAppointmentSelection(apt.id)}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatLocalTime(apt.start_at_utc)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{apt.lead_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{apt.lead_email}</span>
                  </div>
                  {apt.event_type_name && (
                    <div className="text-xs text-muted-foreground">
                      Event: {apt.event_type_name}
                    </div>
                  )}
                  {apt.setter_name && (
                    <div className="text-xs">
                      <span className="font-medium">Setter:</span> {apt.setter_name}
                    </div>
                  )}
                  {apt.closer_name && (
                    <div className="text-xs">
                      <span className="font-medium">Closer:</span> {apt.closer_name}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenAssignDialog(apt)}
                    className="flex items-center gap-1"
                  >
                    <Hand className="h-3 w-3" />
                    {apt.setter_id ? "Reassign" : "Assign"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleOpenCloseDeal(apt)}
                    className="flex items-center gap-1 flex-1"
                  >
                    Close Deal
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleOpenDeleteDialog(apt)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedAppointments.size === filteredAppointments.length && filteredAppointments.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Setter</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAppointments.has(apt.id)}
                      onCheckedChange={() => toggleAppointmentSelection(apt.id)}
                    />
                  </TableCell>
                  <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
                  <TableCell>{apt.lead_name}</TableCell>
                  <TableCell>{apt.lead_email}</TableCell>
                  <TableCell className="text-sm">{apt.event_type_name || 'N/A'}</TableCell>
                  <TableCell>{apt.setter_name || 'Unassigned'}</TableCell>
                  <TableCell>{apt.closer_name || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenAssignDialog(apt)}
                      >
                        <Hand className="h-3 w-3 mr-1" />
                        {apt.setter_id ? "Reassign" : "Assign"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenCloseDeal(apt)}
                      >
                        Close Deal
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDeleteDialog(apt)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment{selectedAppointments.size > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {appointmentToDelete ? 'this appointment' : `${selectedAppointments.size} appointments`}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog/Drawer */}
      {isMobile ? (
        <Drawer open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Assign Appointment</DrawerTitle>
              <DrawerDescription>
                Assign this appointment to a setter and closer
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="px-4 pb-4 space-y-4 overflow-y-auto">
              {assignAppointment && (
                <>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm font-medium">{assignAppointment.lead_name}</p>
                      <p className="text-xs text-muted-foreground">{assignAppointment.lead_email}</p>
                      <p className="text-xs text-muted-foreground">{formatLocalTime(assignAppointment.start_at_utc)}</p>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="setter-mobile" className="text-sm">Setter</Label>
                    <Select value={selectedSetter} onValueChange={setSelectedSetter}>
                      <SelectTrigger id="setter-mobile" className="h-11">
                        <SelectValue placeholder="Select setter..." />
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
                    <Label htmlFor="closer-mobile" className="text-sm">Closer (Optional)</Label>
                    <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                      <SelectTrigger id="closer-mobile" className="h-11">
                        <SelectValue placeholder="Select closer (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Closer</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.profiles.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes-mobile" className="text-sm">Notes (Optional)</Label>
                    <Textarea
                      id="notes-mobile"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this appointment..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <DrawerFooter className="px-4 pt-4">
              <Button onClick={handleAssign} disabled={assigning || !selectedSetter} className="h-11 text-base">
                {assigning ? "Assigning..." : "Assign Appointment"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="h-11 text-base">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Appointment</DialogTitle>
              <DialogDescription>
                Assign this appointment to a setter and closer
              </DialogDescription>
            </DialogHeader>
            
            {assignAppointment && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-sm"><strong>Lead:</strong> {assignAppointment.lead_name}</p>
                  <p className="text-sm"><strong>Email:</strong> {assignAppointment.lead_email}</p>
                  <p className="text-sm"><strong>Time:</strong> {formatLocalTime(assignAppointment.start_at_utc)}</p>
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
      )}

      <CloseDealDialog
        appointment={selectedAppointment}
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
