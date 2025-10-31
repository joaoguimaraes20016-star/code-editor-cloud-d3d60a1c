import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMemberWithBooking {
  user_id: string;
  role: string;
  booking_code: string | null;
  profiles: {
    full_name: string;
  };
}

interface EventTypeDetails {
  uri: string;
  scheduling_url: string;
  name: string;
}

interface SetterBookingLinksProps {
  teamId: string;
  calendlyEventTypes: string[];
  calendlyAccessToken?: string | null;
  calendlyOrgUri?: string | null;
  onRefresh?: () => void;
  currentUserId?: string;
  isOwner?: boolean;
}

export function SetterBookingLinks({ teamId, calendlyEventTypes, calendlyAccessToken, calendlyOrgUri, onRefresh, currentUserId, isOwner = false }: SetterBookingLinksProps) {
  const [members, setMembers] = useState<TeamMemberWithBooking[]>([]);
  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [eventTypeDetails, setEventTypeDetails] = useState<EventTypeDetails[]>([]);
  const [fetchingEventTypes, setFetchingEventTypes] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMembers();
    if (calendlyAccessToken && calendlyOrgUri) {
      fetchEventTypeNames();
    }
  }, [teamId, calendlyAccessToken, calendlyOrgUri]);

  const fetchEventTypeNames = async () => {
    if (!calendlyAccessToken || !calendlyOrgUri) {
      console.log('Missing Calendly credentials for fetching event types');
      return;
    }

    setFetchingEventTypes(true);
    try {
      console.log('Fetching event types from Calendly API...');
      const response = await fetch(`https://api.calendly.com/event_types?organization=${encodeURIComponent(calendlyOrgUri)}&active=true`, {
        headers: {
          'Authorization': `Bearer ${calendlyAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, don't retry - let parent component handle refresh
          console.log('Token expired in SetterBookingLinks');
        }
        setFetchingEventTypes(false);
        return;
      }

      const data = await response.json();
      const details: EventTypeDetails[] = data.collection.map((et: any) => ({
        uri: et.uri,
        scheduling_url: et.scheduling_url,
        name: et.name,
      }));
      
      console.log('✓ Fetched event type details:', details);
      console.log('Database event types:', calendlyEventTypes);
      setEventTypeDetails(details);
    } catch (error) {
      console.error('Error fetching event type names:', error);
    } finally {
      setFetchingEventTypes(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, role, booking_code, profiles!inner(full_name)')
        .eq('team_id', teamId)
        .in('role', ['setter', 'closer', 'admin', 'offer_owner']);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCodeFromName = (fullName: string): string => {
    const parts = fullName.toLowerCase().trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 8);
    return `${parts[0]}_${parts[parts.length - 1].charAt(0)}`;
  };

  const handleSaveCode = async (userId: string, code: string) => {
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Booking code cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSaving(userId);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ booking_code: code.trim().toLowerCase() })
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Error',
            description: 'This booking code is already in use',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Success',
          description: 'Booking code saved',
        });
        loadMembers();
        setEditingCodes((prev) => {
          const newCodes = { ...prev };
          delete newCodes[userId];
          return newCodes;
        });
      }
    } catch (error) {
      console.error('Error saving booking code:', error);
      toast({
        title: 'Error',
        description: 'Failed to save booking code',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const getBookingLink = (eventTypeUrl: string, bookingCode: string): string => {
    return `${eventTypeUrl}?utm_source=setter_${bookingCode}`;
  };

  const getEventTypeName = (url: string): string => {
    console.log('Getting name for URL:', url);
    // Try to match by scheduling URL or API URI
    const detail = eventTypeDetails.find(et => 
      et.scheduling_url === url || et.uri === url
    );
    console.log('Found detail:', detail);
    if (detail) return detail.name;
    
    // Fallback: Extract readable name from Calendly URL
    const parts = url.split('/');
    const slug = parts[parts.length - 1]?.split('?')[0] || 'Event';
    // Convert slug to readable format (e.g., "30-min-call" -> "30 Min Call")
    const fallbackName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    console.log('Using fallback name:', fallbackName);
    return fallbackName;
  };

  const handleRefreshLinks = async () => {
    if (!calendlyAccessToken || !calendlyOrgUri) {
      toast({
        title: 'Error',
        description: 'Calendly is not connected. Please set up Calendly integration first.',
        variant: 'destructive',
      });
      return;
    }

    setRefreshing(true);
    try {
      // Fetch fresh event types from Calendly API
      const response = await fetch(`https://api.calendly.com/event_types?organization=${encodeURIComponent(calendlyOrgUri)}&active=true`, {
        headers: {
          'Authorization': `Bearer ${calendlyAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch event types from Calendly');
      }

      const data = await response.json();
      const schedulingUrls = data.collection.map((et: any) => et.scheduling_url);

      // Update the database with fresh scheduling URLs
      const { error } = await supabase
        .from('teams')
        .update({ calendly_event_types: schedulingUrls })
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Booking links refreshed successfully',
      });

      // Refresh event type names
      fetchEventTypeNames();

      // Trigger parent refresh
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error refreshing links:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh booking links. Please check your Calendly connection.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  if (loading || fetchingEventTypes) {
    return <div className="text-sm text-muted-foreground">Loading booking links...</div>;
  }

  // Convert API URIs to scheduling URLs and filter valid ones
  const validBookingUrls = calendlyEventTypes
    .map(url => {
      console.log('Processing URL:', url);
      // If it's an API URI, find the corresponding scheduling URL
      if (url.includes('api.calendly.com/event_types/')) {
        const detail = eventTypeDetails.find(et => et.uri === url);
        console.log('Found detail for API URI:', detail);
        if (!detail) {
          console.warn('No scheduling URL found for API URI:', url);
        }
        return detail?.scheduling_url || null;
      }
      // If it's already a scheduling URL, keep it
      if (url.startsWith('https://calendly.com/') && !url.includes('/event_types/')) {
        console.log('Valid scheduling URL:', url);
        return url;
      }
      console.log('URL filtered out:', url);
      return null;
    })
    .filter((url): url is string => url !== null);

  console.log('Valid booking URLs:', validBookingUrls);
  console.log('Event type details available:', eventTypeDetails.length);

  if (!validBookingUrls.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setter Booking Links</CardTitle>
          <CardDescription>
            Click "Refresh Links" to fetch your Calendly booking pages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshLinks}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Links'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Filter members based on role - owners see all, setters see only themselves
  const filteredMembers = isOwner 
    ? members 
    : members.filter(m => m.user_id === currentUserId);

  if (!filteredMembers.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setter Booking Links</CardTitle>
          <CardDescription>
            No booking links available for you
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Setter Booking Links</CardTitle>
            <CardDescription>
              Create personalized booking links that automatically assign appointments to specific team members
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshLinks}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Links'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredMembers.map((member) => {
          const currentCode = editingCodes[member.user_id] ?? member.booking_code ?? '';
          const hasBookingCode = !!member.booking_code;

          return (
            <div key={member.user_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{member.profiles.full_name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {member.role}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Booking Code</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., john_s"
                    value={currentCode}
                    onChange={(e) =>
                      setEditingCodes((prev) => ({
                        ...prev,
                        [member.user_id]: e.target.value,
                      }))
                    }
                    className="flex-1"
                    disabled={!isOwner && member.user_id !== currentUserId}
                  />
                  {(isOwner || member.user_id === currentUserId) && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleSaveCode(member.user_id, currentCode)}
                        disabled={saving === member.user_id || currentCode === member.booking_code}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      {!member.booking_code && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const generated = generateCodeFromName(member.profiles.full_name);
                            setEditingCodes((prev) => ({
                              ...prev,
                              [member.user_id]: generated,
                            }));
                          }}
                        >
                          Auto-generate
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {hasBookingCode && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Personalized Booking Links ({validBookingUrls.length} event {validBookingUrls.length === 1 ? 'type' : 'types'})
                  </label>
                  
                  {validBookingUrls.map((eventTypeUrl, index) => {
                    const bookingLink = getBookingLink(eventTypeUrl, member.booking_code!);
                    const eventName = getEventTypeName(eventTypeUrl);
                    
                    return (
                      <div key={index} className="border rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {eventName}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(bookingLink, `${eventName} booking link`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(bookingLink, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={bookingLink}
                          readOnly
                          className="font-mono text-xs"
                        />
                      </div>
                    );
                  })}
                  
                  <p className="text-xs text-muted-foreground">
                    Appointments booked through these links will automatically assign to{' '}
                    {member.profiles.full_name}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
