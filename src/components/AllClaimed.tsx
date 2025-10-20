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
import { Trash2, Clock, Mail, User } from "lucide-react";
import { CloseDealDialog } from "@/components/CloseDealDialog";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  setter_name: string | null;
  setter_notes: string | null;
  setter_id: string | null;
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

  useEffect(() => {
    loadAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('all-claimed-changes')
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
  }, [teamId]);

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('setter_id', 'is', null)
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
      </div>
    );
  }
