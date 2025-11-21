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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import { Hand, Search, CalendarIcon, Trash2, Clock, Mail, User } from "lucide-react";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EventTypeFilter } from "@/components/EventTypeFilter";
import { CloseDealDialog } from "@/components/CloseDealDialog";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  closer_name: string | null;
  closer_id: string | null;
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

interface NewAppointmentsProps {
  teamId: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function NewAppointments({ teamId, closerCommissionPct, setterCommissionPct }: NewAppointmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<{ calendly_access_token: string | null; calendly_organization_uri: string | null } | null>(null);
  const [closeDealOpen, setCloseDealOpen] = useState(false);
  const [closeDealAppointment, setCloseDealAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadTeamData();
    loadTeamMembers();
    loadAppointments();

    // Set up realtime subscription with unique channel name
    const channel = supabase
      .channel(`new-appointments-${teamId}-${Date.now()}`)
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
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error - retrying...');
          // Auto-retry on error
          setTimeout(() => loadAppointments(), 2000);
        }
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
      // Get team's event type filter
      const { data: teamData } = await supabase
        .from('teams')
        .select('calendly_event_types')
        .eq('id', teamId)
        .single();

      const savedEventTypes = teamData?.calendly_event_types || [];

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .order('start_at_utc', { ascending: false });

      if (error) throw error;
      
      // Filter by event types if configured
      let filteredData = data || [];
      if (savedEventTypes.length > 0) {
        filteredData = filteredData.filter(apt => {
          if (!apt.event_type_uri) return false;
          return savedEventTypes.some((savedUri: string) => 
            apt.event_type_uri === savedUri || 
            apt.event_type_uri.includes(savedUri) || 
            savedUri.includes(apt.event_type_uri)
          );
        });
      }
      
      setAppointments(filteredData);
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

  const handleOpenDeleteDialog = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    const idsToDelete = appointmentToDelete 
      ? [appointmentToDelete.id] 
      : Array.from(selectedAppointments);

    if (idsToDelete.length === 0) return;

    setDeleting(true);
    try {
      // Delete in batches of 50 to avoid URL length limits
      const batchSize = 50;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('appointments')
          .delete()
          .in('id', batch)
          .select();

        if (error) {
          console.error('Batch deletion error:', error);
          throw error;
        }

        const actuallyDeleted = data?.length || 0;
        if (actuallyDeleted === 0 && batch.length > 0) {
          throw new Error('Permission denied. Only team admins can delete appointments.');
        }

        deletedCount += actuallyDeleted;
        
        // Show progress for large deletions silently
        if (idsToDelete.length > batchSize && i > 0) {
          console.log(`Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(idsToDelete.length/batchSize)}: ${deletedCount}/${idsToDelete.length}`);
        }
      }

      toast({
        title: 'Success',
        description: `Deleted ${deletedCount} appointment${deletedCount > 1 ? 's' : ''}`,
      });

      setDeleteDialogOpen(false);
      setSelectedAppointments(new Set());
      loadAppointments();
    } catch (error: any) {
      console.error('Error deleting appointments:', error);
      toast({
        title: 'Error deleting appointments',
        description: error?.message || 'An unexpected error occurred',
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

  const formatLocalTime = (utcTime: string) => {
    const dateObj = new Date(utcTime);
    const formattedDate = format(dateObj, 'MMM d, yyyy h:mm a');
    const timezone = new Intl.DateTimeFormat('en-US', { 
      timeZoneName: 'short' 
    }).formatToParts(dateObj).find(part => part.type === 'timeZoneName')?.value || '';
    return `${formattedDate} ${timezone}`.trim();
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
    .filter(apt => apt.setter_id === null)
    .filter(apt => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        apt.lead_name.toLowerCase().includes(query) ||
        apt.lead_email.toLowerCase().includes(query) ||
        apt.closer_name?.toLowerCase().includes(query) ||
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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by lead, email, closer, or event type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={dateFilter} onValueChange={(value) => {
            setDateFilter(value);
            if (value === "custom") {
              if (isMobile) {
                setDateDrawerOpen(true);
              }
            }
          }}>
            <SelectTrigger className="w-[180px]">
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
            
          {dateFilter === "custom" && !isMobile && (
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
                    className={cn("pointer-events-auto w-full scale-95 origin-center")}
                  />
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">Done</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      </div>
      
      
      {filteredAppointments.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">
          No appointments match your search
        </div>
      ) : isMobile ? (
        // Mobile Card View
        <div className="space-y-3">
          {filteredAppointments.map((apt) => (
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
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                    {apt.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{formatLocalTime(apt.start_at_utc)}</span>
                </div>
                
                {apt.closer_name && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-primary font-medium">{apt.closer_name}</span>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="p-3 pt-0 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenAssignDialog(apt)}
                  className="flex-1 h-10 text-sm"
                >
                  <Hand className="h-3.5 w-3.5 mr-1.5" />
                  {apt.setter_id ? "Reassign" : "Assign"}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setCloseDealAppointment(apt);
                    setCloseDealOpen(true);
                  }}
                  className="flex-1 h-10 text-sm"
                >
                  Close Deal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDeleteDialog(apt)}
                  className="h-10 w-10 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
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
            <TableHead className="w-12">
              <Checkbox
                checked={selectedAppointments.size === filteredAppointments.length && filteredAppointments.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>Lead Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Status</TableHead>
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
                  aria-label={`Select ${apt.lead_name}`}
                />
              </TableCell>
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
                  <div className="flex gap-2">
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
                     variant="default"
                     onClick={() => {
                       setCloseDealAppointment(apt);
                       setCloseDealOpen(true);
                     }}
                     className="flex items-center gap-1"
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
                   </Button>
                 </div>
               </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
      )}

      {/* Use Drawer for mobile, Dialog for desktop */}
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
              {selectedAppointment && (
                <>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm font-medium">{selectedAppointment.lead_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedAppointment.lead_email}</p>
                      <p className="text-xs text-muted-foreground">{formatLocalTime(selectedAppointment.start_at_utc)}</p>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="setter-mobile" className="text-sm">Setter (You)</Label>
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
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment{appointmentToDelete ? '' : 's'}</AlertDialogTitle>
            <AlertDialogDescription>
              {appointmentToDelete ? (
                <>
                  Are you sure you want to delete this appointment for{" "}
                  <strong>{appointmentToDelete.lead_name}</strong>? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{selectedAppointments.size}</strong> selected appointment{selectedAppointments.size > 1 ? 's' : ''}? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
