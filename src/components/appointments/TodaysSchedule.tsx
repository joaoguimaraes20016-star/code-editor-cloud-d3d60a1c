import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTeamRole } from "@/hooks/useTeamRole";

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

interface TodaysScheduleProps {
  teamId: string;
  currentUserId: string;
  onCloseDeal?: (appointment: Appointment) => void;
}

export function TodaysSchedule({ teamId, currentUserId, onCloseDeal }: TodaysScheduleProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const { role } = useTeamRole(teamId);

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel('todays-schedule-changes')
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
  }, [teamId, currentUserId, role]);

  const loadAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("team_id", teamId)
        .gte("start_at_utc", today.toISOString())
        .lt("start_at_utc", tomorrow.toISOString());

      // Filter based on user's role
      if (role === 'setter') {
        query = query.eq('setter_id', currentUserId);
      } else {
        // For closers, admins, offer_owners
        query = query.eq('closer_id', currentUserId);
      }

      const { data, error } = await query.order("start_at_utc", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading today's schedule:", error);
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

      const matchesEventType =
        eventTypeFilter === "all" || appointment.event_type_name === eventTypeFilter;

      return matchesSearch && matchesEventType;
    });
  }, [appointments, searchQuery, eventTypeFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
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
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          Today's Schedule - {format(new Date(), 'MMMM d, yyyy')}
        </h3>
      </div>

      <AppointmentFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter="all"
        onStatusFilterChange={() => {}}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        eventTypes={eventTypes}
        onClearFilters={handleClearFilters}
        teamId={teamId}
      />

      {appointments.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No appointments scheduled for today. Enjoy your day off!
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
        <div className="space-y-3">
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
