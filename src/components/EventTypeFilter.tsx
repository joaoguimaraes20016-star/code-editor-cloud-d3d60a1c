import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

interface EventTypeDetails {
  uri: string;
  scheduling_url: string;
  name: string;
  profile?: {
    name: string;
    owner: string;
  };
  pooling_type?: string | null;
}

interface EventTypeFilterProps {
  teamId: string;
  calendlyAccessToken?: string | null;
  calendlyOrgUri?: string | null;
  onFilterChange: (eventTypeUri: string | null) => void;
  showManualAdd?: boolean;
}

export function EventTypeFilter({ 
  teamId, 
  calendlyAccessToken, 
  calendlyOrgUri, 
  onFilterChange,
  showManualAdd = true
}: EventTypeFilterProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeDetails[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [manualUrl, setManualUrl] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    // Add small delay to prevent race conditions with token refresh
    const timer = setTimeout(() => {
      loadEventTypes();
    }, 150);
    return () => clearTimeout(timer);
  }, [teamId, calendlyAccessToken, calendlyOrgUri]);

  const loadEventTypes = async () => {
    if (!calendlyAccessToken || !calendlyOrgUri) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching all event types (user-level + org-level) for dropdown...');
      
      // Step 1: Fetch organization members
      const membersResponse = await fetch(
        `https://api.calendly.com/organization_memberships?organization=${encodeURIComponent(calendlyOrgUri)}&count=100`,
        {
          headers: {
            'Authorization': `Bearer ${calendlyAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!membersResponse.ok) {
        if (membersResponse.status === 401) {
          console.log('Token expired in EventTypeFilter');
        }
        setLoading(false);
        return;
      }

      const membersData = await membersResponse.json();
      const members = membersData.collection || [];
      console.log(`Found ${members.length} organization members`);

      // Step 2: Fetch user-level event types for each member
      const allEventTypesMap = new Map<string, EventTypeDetails>();
      
      for (const member of members) {
        const userUri = member.user?.uri;
        if (!userUri) continue;

        try {
          const userEventTypesResponse = await fetch(
            `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&count=100`,
            {
              headers: {
                'Authorization': `Bearer ${calendlyAccessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (userEventTypesResponse.ok) {
            const userEventTypesData = await userEventTypesResponse.json();
            const userEventTypes = userEventTypesData.collection || [];
            
            userEventTypes.forEach((et: any) => {
              if (!allEventTypesMap.has(et.uri)) {
                allEventTypesMap.set(et.uri, {
                  uri: et.uri,
                  scheduling_url: et.scheduling_url,
                  name: et.name,
                  profile: et.profile,
                  pooling_type: et.pooling_type,
                });
              }
            });
          }
        } catch (userError) {
          console.error(`Failed to fetch user event types:`, userError);
        }
      }

      // Step 3: Fetch organization-level event types (Round Robin/Team)
      try {
        console.log('Fetching organization-level event types (Round Robin/Team)...');
        const orgEventTypesResponse = await fetch(
          `https://api.calendly.com/event_types?organization=${encodeURIComponent(calendlyOrgUri)}&count=100`,
          {
            headers: {
              'Authorization': `Bearer ${calendlyAccessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (orgEventTypesResponse.ok) {
          const orgEventTypesData = await orgEventTypesResponse.json();
          const orgEventTypes = orgEventTypesData.collection || [];
          
          orgEventTypes.forEach((et: any) => {
            if (!allEventTypesMap.has(et.uri)) {
              allEventTypesMap.set(et.uri, {
                uri: et.uri,
                scheduling_url: et.scheduling_url,
                name: et.name,
                profile: et.profile,
                pooling_type: et.pooling_type,
              });
            }
          });
          
          console.log(`Found ${orgEventTypes.length} organization-level event types`);
        }
      } catch (orgError) {
        console.error('Error fetching org-level event types:', orgError);
      }

      const allEventTypes = Array.from(allEventTypesMap.values());
      console.log(`Total event types for dropdown: ${allEventTypes.length}`);
      console.log(`Round Robin events: ${allEventTypes.filter(et => et.pooling_type === 'round_robin').length}`);
      
      setEventTypes(allEventTypes);
    } catch (error) {
      console.error('Error loading event types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (value: string) => {
    setSelectedEventType(value);
    onFilterChange(value === "all" ? null : value);
  };

  const handleFetchByUrl = async () => {
    if (!calendlyAccessToken || !manualUrl.trim()) {
      toast.error("Please enter a Calendly URL");
      return;
    }

    setIsFetching(true);
    try {
      // Extract the event slug from the URL
      const urlMatch = manualUrl.match(/calendly\.com\/([^\/]+)\/([^\/\?]+)/);
      if (!urlMatch) {
        toast.error("Invalid Calendly URL format");
        return;
      }

      // Fetch all event types and search for a match
      const response = await fetch(
        `https://api.calendly.com/event_types?organization=${encodeURIComponent(calendlyOrgUri!)}`,
        {
          headers: {
            'Authorization': `Bearer ${calendlyAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        toast.error("Failed to fetch event type");
        return;
      }

      const data = await response.json();
      const matchedEventType = data.collection.find((et: any) => 
        et.scheduling_url.toLowerCase().includes(manualUrl.toLowerCase()) ||
        manualUrl.toLowerCase().includes(et.slug)
      );

      if (matchedEventType) {
        const eventTypeDetail: EventTypeDetails = {
          uri: matchedEventType.uri,
          scheduling_url: matchedEventType.scheduling_url,
          name: matchedEventType.name,
          profile: matchedEventType.profile,
          pooling_type: matchedEventType.pooling_type,
        };

        // Check if it already exists
        const exists = eventTypes.some(et => et.uri === eventTypeDetail.uri);
        if (!exists) {
          setEventTypes(prev => [...prev, eventTypeDetail]);
          toast.success(`Added: ${eventTypeDetail.name}`);
        } else {
          toast.info("This event type is already in the list");
        }
        
        setManualUrl("");
        setIsOpen(false);
      } else {
        toast.error("Could not find a matching event type");
      }
    } catch (error) {
      console.error('Error fetching event type:', error);
      toast.error("Failed to fetch event type");
    } finally {
      setIsFetching(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 w-full sm:w-[200px]">
      <Select value={selectedEventType} onValueChange={handleFilterChange}>
        <SelectTrigger className="w-full bg-background h-10">
          <SelectValue placeholder="All Event Types" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="all">All Event Types</SelectItem>
          {eventTypes.map((et) => {
            const isRoundRobin = et.pooling_type === 'round_robin';
            const isTeam = et.pooling_type === 'collective';
            const typeLabel = isRoundRobin ? ' (Round Robin)' : isTeam ? ' (Team)' : '';
            
            return (
              <SelectItem key={et.uri} value={et.uri}>
                {et.name}{typeLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {showManualAdd && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" />
              Don't see your event type?
              <ChevronDown className={`ml-auto h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Paste your Calendly event URL to manually fetch it:
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://calendly.com/..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button 
                onClick={handleFetchByUrl} 
                disabled={isFetching || !manualUrl.trim()}
                size="sm"
              >
                {isFetching ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
