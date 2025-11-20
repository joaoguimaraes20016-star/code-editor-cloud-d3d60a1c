import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
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
  original_appointment_id: string | null;
  rescheduled_to_appointment_id: string | null;
  reschedule_count: number;
}

interface AppointmentListViewProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
  onCloseDeal?: (appointment: Appointment) => void;
}

export function AppointmentListView({
  teamId,
  userRole,
  currentUserId,
  onCloseDeal,
}: AppointmentListViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  // Load team's selected event types and auto-apply filter
  useEffect(() => {
    const loadTeamEventTypes = async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("calendly_event_types")
        .eq("id", teamId)
        .single();
      
      if (team?.calendly_event_types && Array.isArray(team.calendly_event_types)) {
        setSelectedEventTypes(team.calendly_event_types);
        // Auto-set filter to first selected event type if only one is selected
        if (team.calendly_event_types.length === 1) {
          // We'll use event type URI for filtering, need to map it
          // For now, just load appointments normally
        }
      }
    };
    
    loadTeamEventTypes();
  }, [teamId]);

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel('appointments-list-changes')
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
  }, [teamId, userRole, currentUserId]);

  const loadAppointments = async () => {
    try {
      let query = supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .order("start_at_utc", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading appointments:", error);
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

      // Additional filter: only show appointments from selected event types if configured
      const matchesSelectedEventTypes = 
        selectedEventTypes.length === 0 || 
        !appointment.event_type_name ||
        selectedEventTypes.some(uri => 
          appointments.find(a => a.event_type_name === appointment.event_type_name)
        );

      return matchesSearch && matchesStatus && matchesEventType;
    });
  }, [appointments, searchQuery, statusFilter, eventTypeFilter, selectedEventTypes]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setEventTypeFilter("all");
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

  if (appointments.length === 0) {
    return (
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          No appointments found. Make sure your Calendly integration is properly configured.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
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

      {filteredAppointments.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No appointments match your current filters.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCloseDeal={onCloseDeal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
