import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AppointmentFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  eventTypes: string[];
  onClearFilters: () => void;
  teamId?: string;
}

interface EventTypeWithCount {
  name: string;
  count: number;
  uri: string;
}

export function AppointmentFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  eventTypes,
  onClearFilters,
  teamId,
}: AppointmentFiltersProps) {
  const hasActiveFilters = searchQuery || statusFilter !== "all" || eventTypeFilter !== "all";
  const [eventTypesWithCount, setEventTypesWithCount] = useState<EventTypeWithCount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchEventTypesWithCounts();
    }
  }, [teamId]);

  const fetchEventTypesWithCounts = async () => {
    if (!teamId) return;
    
    setLoading(true);
    try {
      // Fetch selected event types from team settings
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('calendly_event_types, calendly_access_token, calendly_organization_uri')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      const selectedEventTypeUris = teamData?.calendly_event_types || [];
      
      // If no event types selected, use the ones passed from appointments
      if (selectedEventTypeUris.length === 0) {
        setEventTypesWithCount(eventTypes.map(name => ({ name, count: 0, uri: '' })));
        return;
      }

      // Fetch event type details from Calendly
      const accessToken = teamData?.calendly_access_token;
      const orgUri = teamData?.calendly_organization_uri;
      
      if (!accessToken || !orgUri) {
        setEventTypesWithCount(eventTypes.map(name => ({ name, count: 0, uri: '' })));
        return;
      }

      // Fetch organization members to get all event types
      const membersResponse = await fetch(
        `https://api.calendly.com/organization_memberships?organization=${encodeURIComponent(orgUri)}&count=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!membersResponse.ok) {
        setEventTypesWithCount(eventTypes.map(name => ({ name, count: 0, uri: '' })));
        return;
      }

      const membersData = await membersResponse.json();
      const members = membersData.collection || [];

      const allEventTypesMap = new Map<string, { uri: string; name: string }>();
      
      for (const member of members) {
        const userUri = member.user?.uri;
        if (!userUri) continue;

        try {
          const userEventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&count=100`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (userEventTypesResponse.ok) {
            const userEventTypesData = await userEventTypesResponse.json();
            const userEventTypes = userEventTypesData.collection || [];
            
            userEventTypes.forEach((et: any) => {
              if (selectedEventTypeUris.includes(et.uri)) {
                allEventTypesMap.set(et.uri, {
                  uri: et.uri,
                  name: et.name,
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching event types for user:', error);
        }
      }

      // Get appointment counts for each event type
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('event_type_name, event_type_uri')
        .eq('team_id', teamId);

      if (appointmentsError) throw appointmentsError;

      // Count appointments by event type
      const countByUri = new Map<string, number>();
      const countByName = new Map<string, number>();
      
      appointments?.forEach(apt => {
        if (apt.event_type_uri) {
          countByUri.set(apt.event_type_uri, (countByUri.get(apt.event_type_uri) || 0) + 1);
        }
        if (apt.event_type_name) {
          countByName.set(apt.event_type_name, (countByName.get(apt.event_type_name) || 0) + 1);
        }
      });

      // Build the final list with counts
      const eventTypesWithCounts: EventTypeWithCount[] = Array.from(allEventTypesMap.values()).map(et => ({
        name: et.name,
        uri: et.uri,
        count: countByUri.get(et.uri) || countByName.get(et.name) || 0,
      }));

      setEventTypesWithCount(eventTypesWithCounts);
    } catch (error) {
      console.error('Error fetching event types with counts:', error);
      // Fallback to using eventTypes prop
      setEventTypesWithCount(eventTypes.map(name => ({ name, count: 0, uri: '' })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by lead name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="NEW">Pending Confirmation</SelectItem>
          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
          <SelectItem value="SHOWED">Showed</SelectItem>
          <SelectItem value="NO_SHOW">No Show</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
          <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
        </SelectContent>
      </Select>

      {(eventTypesWithCount.length > 0 || eventTypes.length > 0) && (
        <Select value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="All Event Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            {eventTypesWithCount.length > 0 ? (
              eventTypesWithCount.map((type) => (
                <SelectItem key={type.uri || type.name} value={type.name}>
                  {type.name} ({type.count})
                </SelectItem>
              ))
            ) : (
              eventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="icon" onClick={onClearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
