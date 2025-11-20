import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentCard } from "./AppointmentCard";
import { HorizontalAppointmentCard } from "./HorizontalAppointmentCard";
import { AppointmentFilters } from "./AppointmentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, Users, UserX } from "lucide-react";
import { AssignDialog } from "./AssignDialog";

interface Appointment {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
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

interface MyAppointmentsProps {
  teamId: string;
  currentUserId: string;
  onCloseDeal?: (appointment: Appointment) => void;
}

export function MyLeads({ teamId, currentUserId, onCloseDeal }: MyAppointmentsProps) {
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [unassignedAppointments, setUnassignedAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [selectedForAssign, setSelectedForAssign] = useState<Appointment | null>(null);

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
      
      // First identify unassigned (no setter)
      const unassignedAppts = (data || []).filter(apt => 
        apt.setter_id === null
      );
      
      // Then get appointments assigned to current user as setter
      const myAppts = (data || []).filter(apt => 
        apt.setter_id === currentUserId
      );
      
      setMyAppointments(myAppts);
      setUnassignedAppointments(unassignedAppts);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const allAppointments = useMemo(() => 
    [...myAppointments, ...unassignedAppointments], 
    [myAppointments, unassignedAppointments]
  );

  const eventTypes = useMemo(() => {
    const types = new Set(
      allAppointments
        .map((a) => a.event_type_name)
        .filter((type): type is string => type !== null)
    );
    return Array.from(types);
  }, [allAppointments]);

  const filterAppointments = (appointments: Appointment[]) => {
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
  };

  const filteredMyAppointments = useMemo(() => 
    filterAppointments(myAppointments), 
    [myAppointments, searchQuery, statusFilter, eventTypeFilter]
  );

  const filteredUnassignedAppointments = useMemo(() => 
    filterAppointments(unassignedAppointments), 
    [unassignedAppointments, searchQuery, statusFilter, eventTypeFilter]
  );

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
    <div className="space-y-6">
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
        teamId={teamId}
      />

      {/* Unassigned Appointments Section */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserX className="h-5 w-5 text-amber-600" />
            Unassigned Appointments
            <Badge variant="secondary" className="ml-auto">
              {filteredUnassignedAppointments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unassignedAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No unassigned appointments at this time
            </p>
          ) : filteredUnassignedAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No unassigned appointments match your filters
            </p>
          ) : (
            filteredUnassignedAppointments.map((appointment) => (
              <HorizontalAppointmentCard
                key={appointment.id}
                appointment={appointment}
                onAssign={() => setSelectedForAssign(appointment)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* My Assigned Appointments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            My Assigned Appointments
            <Badge variant="secondary" className="ml-auto">
              {filteredMyAppointments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myAppointments.length === 0 ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                No appointments assigned to you yet.
              </AlertDescription>
            </Alert>
          ) : filteredMyAppointments.length === 0 ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                No appointments match your current filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMyAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onCloseDeal={onCloseDeal}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedForAssign && (
        <AssignDialog
          open={!!selectedForAssign}
          onOpenChange={(open) => !open && setSelectedForAssign(null)}
          appointment={selectedForAssign}
          teamId={teamId}
          onSuccess={() => {
            setSelectedForAssign(null);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}
