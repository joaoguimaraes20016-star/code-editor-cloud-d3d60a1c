import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Users } from "lucide-react";

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
}

interface MyAppointmentsProps {
  teamId: string;
  currentUserId: string;
  onCloseDeal?: (appointment: Appointment) => void;
}

export function MyLeads({ teamId, currentUserId, onCloseDeal }: MyAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel('my-appointments-changes')
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
        .order("start_at_utc", { ascending: false });

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

      return matchesSearch && matchesStatus && matchesEventType;
    });
  }, [appointments, searchQuery, statusFilter, eventTypeFilter]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">My Appointments</h3>
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
      />

      {appointments.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No appointments scheduled yet.
          </AlertDescription>
        </Alert>
      ) : filteredAppointments.length === 0 ? (
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
