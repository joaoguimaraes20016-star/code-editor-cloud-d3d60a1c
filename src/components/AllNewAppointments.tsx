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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
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
import { HorizontalAppointmentCard } from "@/components/appointments/HorizontalAppointmentCard";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string | null;
  status: string;
  closer_name: string | null;
  event_type_uri: string | null;
  event_type_name: string | null;
  setter_id: string | null;
  setter_name: string | null;
  setter_notes: string | null;
  cc_collected: number | null;
  mrr_amount: number | null;
  reschedule_url: string | null;
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
  userRole?: string;
  currentUserId?: string;
  showAllAssigned?: boolean;
  showAllAppointments?: boolean;
}

export function AllNewAppointments({ teamId, closerCommissionPct, setterCommissionPct, userRole, currentUserId, showAllAssigned, showAllAppointments }: AllNewAppointmentsProps) {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadTeamData();
    loadTeamMembers();
    loadAppointments();

    // Set up realtime subscription with unique channel name
    const channel = supabase
      .channel(`all-new-appointments-${teamId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          // Remove deleted appointment from local state
          setAppointments(prev => prev.filter(apt => apt.id !== payload.old.id));
          setTotalCount(prev => Math.max(0, prev - 1));
          setSelectedAppointments(prev => {
            const next = new Set(prev);
            next.delete(payload.old.id);
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          // Only reload if on first page for new appointments
          if (currentPage === 1) {
            loadAppointments();
          } else {
            setTotalCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          // Update specific appointment in local state
          setAppointments(prev => 
            prev.map(apt => apt.id === payload.new.id ? payload.new as Appointment : apt)
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user, currentPage]);

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
      setLoading(true);
      
      // Get team's event type filter
      const { data: teamFilterData } = await supabase
        .from('teams')
        .select('calendly_event_types')
        .eq('id', teamId)
        .single();

      const savedEventTypes = teamFilterData?.calendly_event_types || [];
      
      // Build query based on role
      let countQuery = supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .in('status', ['NEW', 'CONFIRMED']);

      let dataQuery = supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .in('status', ['NEW', 'CONFIRMED']);

      // If closer role, show only appointments assigned to this closer
      if (userRole === 'closer' && currentUserId) {
        countQuery = countQuery.eq('closer_id', currentUserId);
        dataQuery = dataQuery.eq('closer_id', currentUserId);
      } 
      // Show ALL appointments (both assigned and unassigned)
      else if (showAllAppointments) {
        // No filter on setter_id - show everything
      }
      // Admin view: Show all assigned appointments (has setter_id)
      else if (showAllAssigned) {
        countQuery = countQuery.not('setter_id', 'is', null);
        dataQuery = dataQuery.not('setter_id', 'is', null);
      }
      // Default: Show unassigned appointments (setter_id IS null)
      else {
        countQuery = countQuery.is('setter_id', null);
        dataQuery = dataQuery.is('setter_id', null);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Get paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await dataQuery
        .order('start_at_utc', { ascending: true })
        .range(from, to);

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
        
        // Update total count to reflect filtered results
        setTotalCount(filteredData.length);
      } else {
        setTotalCount(count || 0);
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

  const handleOpenCloseDeal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCloseDealOpen(true);
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
    <div className="space-y-6">
      {selectedAppointments.size > 0 && (
        <Card className="bg-gradient-to-r from-destructive/10 to-destructive/5 border-destructive/20">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="text-sm font-medium">
              {selectedAppointments.size} appointment{selectedAppointments.size > 1 ? 's' : ''} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedAppointments(new Set())}
            >
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by lead, email, setter, closer, or event type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          
          <div className="flex gap-2 items-center flex-shrink-0">
            <Select value={dateFilter} onValueChange={(value) => {
              setDateFilter(value);
              if (value === "custom") {
                if (isMobile) {
                  setDateDrawerOpen(true);
                }
              }
            }}>
              <SelectTrigger className="w-full sm:w-[140px] h-10">
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
              showManualAdd={false}
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
      </Card>

      {filteredAppointments.length === 0 ? (
        <Card className="border-info/20 bg-info/5">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No appointments found</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-3 animate-fade-in">
          {filteredAppointments.map((apt) => (
            <Card key={apt.id} className="overflow-hidden card-hover group">
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="relative z-10 p-4 space-y-3">
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
        <div className="space-y-3 animate-fade-in">
          {filteredAppointments.map((apt) => (
            <HorizontalAppointmentCard
              key={apt.id}
              appointment={apt}
              showReassignButton={apt.setter_id !== null}
              showCloseDealButton={true}
              onReassign={() => handleOpenAssignDialog(apt)}
              onCloseDeal={() => handleOpenCloseDeal(apt)}
            />
          ))}
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

      {/* Pagination */}
      {totalCount > pageSize && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
              .filter(page => {
                const totalPages = Math.ceil(totalCount / pageSize);
                return page === 1 || 
                       page === totalPages || 
                       (page >= currentPage - 1 && page <= currentPage + 1);
              })
              .map((page, index, array) => (
                <PaginationItem key={page}>
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <PaginationEllipsis />
                  )}
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))
            }
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                className={currentPage >= Math.ceil(totalCount / pageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
