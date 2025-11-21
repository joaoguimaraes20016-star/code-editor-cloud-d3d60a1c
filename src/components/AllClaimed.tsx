import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { format } from "date-fns";
import { Trash2, Clock, Mail, User, RefreshCw } from "lucide-react";
import { CloseDealDialog } from "@/components/CloseDealDialog";
import { AssignDialog } from "./appointments/AssignDialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  status: string;
  setter_name: string | null;
  setter_notes: string | null;
  setter_id: string | null;
  closer_id: string | null;
}

interface AllClaimedProps {
  teamId: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function AllClaimed({ teamId, closerCommissionPct, setterCommissionPct }: AllClaimedProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [closeDealOpen, setCloseDealOpen] = useState(false);
  const [closeDealAppointment, setCloseDealAppointment] = useState<Appointment | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignAppointment, setReassignAppointment] = useState<Appointment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadAppointments();

    // Set up realtime subscription with unique channel name
    const channel = supabase
      .channel(`all-claimed-${teamId}-${Date.now()}`)
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
          // Reload if on first page for any new appointment
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
          const updatedApt = payload.new as Appointment;
          
          // Check if appointment still has a setter assigned
          const isAssigned = updatedApt.setter_id !== null;
          
          setAppointments(prev => {
            if (isAssigned) {
              // Update if it's in the list
              return prev.map(apt => apt.id === updatedApt.id ? updatedApt : apt);
            } else {
              // Remove if it became unassigned
              return prev.filter(apt => apt.id !== updatedApt.id);
            }
          });
          
          // Update count if removed
          if (!isAssigned) {
            setTotalCount(prev => Math.max(0, prev - 1));
          }
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
  }, [teamId, currentPage]);

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
      
      // Get total count - show only appointments with ASSIGNED SETTERS
      const { count, error: countError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .not('setter_id', 'is', null);

      if (countError) throw countError;

      // Get paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('setter_id', 'is', null)
        .order('start_at_utc', { ascending: false })
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
    if (selectedAppointments.size === appointments.length) {
      setSelectedAppointments(new Set());
    } else {
      setSelectedAppointments(new Set(appointments.map(apt => apt.id)));
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

  if (appointments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No assigned appointments yet
      </div>
    );
  }

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

      {isMobile ? (
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
                    {apt.lead_phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <span className="truncate">{apt.lead_phone}</span>
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium flex-shrink-0 ${
                    apt.status === 'SHOWED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    apt.status === 'NO_SHOW' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {apt.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{formatLocalTime(apt.start_at_utc)}</span>
                </div>
                
                {apt.setter_name && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-primary font-medium">{apt.setter_name}</span>
                  </div>
                )}
                
                {apt.setter_notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{apt.setter_notes}</p>
                )}
              </CardContent>
              
              <CardFooter className="p-3 pt-0 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReassignAppointment(apt);
                    setReassignDialogOpen(true);
                  }}
                  className="flex-1 h-10 text-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reassign
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
                  variant="destructive"
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
                checked={selectedAppointments.size === appointments.length && appointments.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>Lead Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Setter</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Setter Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
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
              <TableCell>{apt.lead_phone || '-'}</TableCell>
              <TableCell>
                <span className="font-medium text-primary">{apt.setter_name}</span>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  apt.status === 'SHOWED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  apt.status === 'NO_SHOW' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {apt.status}
                </span>
               </TableCell>
               <TableCell className="max-w-xs truncate">{apt.setter_notes || '-'}</TableCell>
               <TableCell>
                 <div className="flex gap-2">
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => {
                       setReassignAppointment(apt);
                       setReassignDialogOpen(true);
                     }}
                     className="flex items-center gap-1"
                   >
                     <RefreshCw className="h-3 w-3" />
                     Reassign
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

        {reassignAppointment && (
          <AssignDialog
            open={reassignDialogOpen}
            onOpenChange={setReassignDialogOpen}
            appointment={reassignAppointment}
            teamId={teamId}
            onSuccess={() => {
              loadAppointments();
              toast({
                title: 'Appointment reassigned',
                description: 'The appointment has been reassigned successfully',
              });
            }}
          />
        )}

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
