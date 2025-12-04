import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HorizontalAppointmentCard } from "./HorizontalAppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { AssignDialog } from "./AssignDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfoIcon } from "lucide-react";
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { DateRangePreset } from "@/components/DateRangeFilter";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  start_at_utc: string;
  status: string;
  setter_name: string | null;
  closer_name: string | null;
  event_type_name: string | null;
  setter_notes: string | null;
  cc_collected: number | null;
  mrr_amount: number | null;
  setter_id: string | null;
  closer_id: string | null;
  reschedule_url: string | null;
}

interface UnassignedAppointmentsProps {
  teamId: string;
  onUpdate: () => void;
  dateFilter?: { from: Date | null; to: Date | null; preset: DateRangePreset };
}

export function UnassignedAppointments({ teamId, onUpdate, dateFilter }: UnassignedAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel('unassigned-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `team_id=eq.${teamId}`,
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
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .is("setter_id", null)
        .order("start_at_utc", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading unassigned appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const eventTypes = useMemo(() => {
    const types = new Set(
      appointments
        .map((a) => a.event_type_name)
        .filter((type): type is string => type !== null)
    );
    return Array.from(types);
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const matchesSearch =
        !searchQuery ||
        appointment.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appointment.lead_email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || appointment.status === statusFilter;

      const matchesEventType =
        eventTypeFilter === "all" || appointment.event_type_name === eventTypeFilter;

      return matchesSearch && matchesStatus && matchesEventType;
    });
  }, [appointments, searchQuery, statusFilter, eventTypeFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setEventTypeFilter("all");
  };

  const handleAssign = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAssignDialogOpen(true);
  };

  const handleAssignSuccess = () => {
    loadAppointments();
    onUpdate();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/20">
            <InfoIcon className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Unassigned Appointments</h3>
            <p className="text-sm text-muted-foreground">Appointments waiting to be assigned</p>
          </div>
        </div>
        {appointments.length > 0 && (
          <Badge variant="destructive" className="text-base px-4 py-1">{appointments.length}</Badge>
        )}
      </div>

      <AppointmentFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        eventTypes={eventTypes}
        onClearFilters={handleClearFilters}
        teamId={teamId}
      />

      {appointments.length === 0 ? (
        <Alert className="border-success/30 bg-success/5">
          <InfoIcon className="h-4 w-4 text-success" />
          <AlertDescription className="text-success-foreground">
            All appointments have been assigned! Great work.
          </AlertDescription>
        </Alert>
      ) : filteredAppointments.length === 0 ? (
        <Alert className="border-info/30 bg-info/5">
          <InfoIcon className="h-4 w-4 text-info" />
          <AlertDescription className="text-info-foreground">
            No appointments match your current filters.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {filteredAppointments.map((appointment) => (
            <HorizontalAppointmentCard
              key={appointment.id}
              appointment={appointment}
              showAssignButton={true}
              onAssign={() => handleAssign(appointment)}
            />
          ))}
        </div>
      )}

      {selectedAppointment && (
        <AssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          appointment={selectedAppointment}
          teamId={teamId}
          onSuccess={handleAssignSuccess}
        />
      )}
    </div>
  );
}
