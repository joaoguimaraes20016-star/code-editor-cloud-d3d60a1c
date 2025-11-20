import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react';
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
  pooling_type?: string | null;
}

interface SetterBookingLinksProps {
  teamId: string;
  calendlyEventTypes: string[];
  availableEventTypes?: EventTypeDetails[];
  calendlyAccessToken?: string | null;
  calendlyOrgUri?: string | null;
  onRefresh?: () => void;
  currentUserId?: string;
  isOwner?: boolean;
}

export function SetterBookingLinks({ teamId, calendlyEventTypes, availableEventTypes = [], calendlyAccessToken, calendlyOrgUri, onRefresh, currentUserId, isOwner = false }: SetterBookingLinksProps) {
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
    // If availableEventTypes is provided from parent, use it
    if (availableEventTypes.length > 0) {
      setEventTypeDetails(availableEventTypes);
    } else if (calendlyAccessToken && calendlyOrgUri && !fetchingEventTypes) {
      // Otherwise fetch event types
      const timer = setTimeout(() => {
        fetchEventTypeNames();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [teamId, calendlyAccessToken, calendlyOrgUri, availableEventTypes]);

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
        pooling_type: et.pooling_type,
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
      
      const members = data || [];
      setMembers(members);
      
      // Auto-generate and save booking codes for members without them
      // If user is not admin/owner, only generate for themselves
      let membersWithoutCodes = members.filter(m => !m.booking_code);
      
      // If not admin/owner, only auto-generate for current user
      if (!isOwner && currentUserId) {
        membersWithoutCodes = membersWithoutCodes.filter(m => m.user_id === currentUserId);
      }
      
      if (membersWithoutCodes.length > 0) {
        await autoGenerateAndSaveCodes(membersWithoutCodes);
      }
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

  const autoGenerateAndSaveCodes = async (membersWithoutCodes: TeamMemberWithBooking[]) => {
    console.log('🔄 Auto-generating booking codes for:', membersWithoutCodes.length, 'members');
    const isCurrentUserOnly = membersWithoutCodes.length === 1 && membersWithoutCodes[0].user_id === currentUserId;
    
    for (const member of membersWithoutCodes) {
      const generatedCode = generateCodeFromName(member.profiles.full_name);
      console.log(`📝 Attempting to generate code "${generatedCode}" for ${member.profiles.full_name}`);
      
      try {
        // Check if code already exists
        const { data: existing, error: checkError } = await supabase
          .from('team_members')
          .select('booking_code')
          .eq('team_id', teamId)
          .eq('booking_code', generatedCode)
          .maybeSingle();
        
        if (checkError) {
          console.error('❌ Error checking existing code:', checkError);
          // Only show error for current user or if admin
          if (isCurrentUserOnly || isOwner) {
            toast({
              title: 'Database Error',
              description: `Failed to check for existing codes: ${checkError.message}`,
              variant: 'destructive',
            });
          }
          throw checkError;
        }
        
        let finalCode = generatedCode;
        
        // If code exists, append a number
        if (existing) {
          console.log(`⚠️ Code "${generatedCode}" already exists, finding unique variant...`);
          let counter = 1;
          let uniqueCode = `${generatedCode}${counter}`;
          
          while (counter < 100) {
            const { data: check, error: uniqueCheckError } = await supabase
              .from('team_members')
              .select('booking_code')
              .eq('team_id', teamId)
              .eq('booking_code', uniqueCode)
              .maybeSingle();
            
            if (uniqueCheckError) {
              console.error('❌ Error checking unique code:', uniqueCheckError);
              throw uniqueCheckError;
            }
            
            if (!check) {
              finalCode = uniqueCode;
              console.log(`✓ Found unique code: ${finalCode}`);
              break;
            }
            counter++;
            uniqueCode = `${generatedCode}${counter}`;
          }
        }
        
        // Save the code with verification
        console.log(`💾 Saving booking code "${finalCode}" to database...`);
        const { data: savedData, error: saveError } = await supabase
          .from('team_members')
          .update({ booking_code: finalCode })
          .eq('team_id', teamId)
          .eq('user_id', member.user_id)
          .select('booking_code');
        
        if (saveError) {
          console.error('❌ Database save FAILED:', saveError);
          // Only show error for current user or if admin
          if (isCurrentUserOnly || isOwner) {
            toast({
              title: 'Failed to save booking code',
              description: `Could not save code for ${member.profiles.full_name}: ${saveError.message}`,
              variant: 'destructive',
            });
          }
          throw saveError;
        }
        
        if (!savedData || savedData.length === 0) {
          console.error('❌ Save returned empty data - likely a permissions issue');
          // Only show error for current user or if admin
          if (isCurrentUserOnly || isOwner) {
            toast({
              title: 'Permission Error',
              description: `Could not set up booking code for ${member.profiles.full_name}. Error: insufficient permissions`,
              variant: 'destructive',
            });
          }
          throw new Error('No data returned from save - permissions issue');
        }
        
        console.log('✅ Successfully saved code:', savedData[0].booking_code);
        // Only show success toast for current user or if explicitly requested
        if (isCurrentUserOnly) {
          toast({
            title: 'Success',
            description: `Booking code "${finalCode}" created for you!`,
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to auto-generate code for ${member.profiles.full_name}:`, error);
        // Only show error for current user or if admin
        if (isCurrentUserOnly || isOwner) {
          toast({
            title: 'Setup Failed',
            description: `Could not set up booking code for ${member.profiles.full_name}. ${error instanceof Error ? `Error: ${error.message}` : ''}`,
            variant: 'destructive',
          });
        }
      }
    }
    
    // Reload members to show updated codes
    await loadMembers();
  };

  const generateCodeFromName = (fullName: string): string => {
    const parts = fullName.toLowerCase().trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 8);
    return `${parts[0]}_${parts[parts.length - 1].charAt(0)}`;
  };

  const handleSaveCode = async (userId: string, code: string) => {
    if (!code.trim()) {
      toast({
        title: 'Invalid code',
        description: 'Booking code cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSaving(userId);
    console.log(`💾 Manually saving code "${code}" for user ${userId}`);

    try {
      const { data: savedData, error } = await supabase
        .from('team_members')
        .update({ booking_code: code.trim().toLowerCase() })
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .select('booking_code');

      if (error) {
        console.error('❌ Manual save failed:', error);
        if (error.code === '23505') {
          toast({
            title: 'Code already in use',
            description: 'This booking code is already taken. Please choose another.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Save failed',
            description: error.message,
            variant: 'destructive',
          });
        }
        throw error;
      }
      
      if (!savedData || savedData.length === 0) {
        throw new Error('No data returned - possible permission issue');
      }

      console.log('✅ Manual save successful:', savedData);
      toast({
        title: 'Code saved',
        description: `Your booking code "${code}" is now active`,
      });

      // Reload to verify
      await loadMembers();
      
      setEditingCodes((prev) => {
        const newCodes = { ...prev };
        delete newCodes[userId];
        return newCodes;
      });
    } catch (error: any) {
      console.error('Error saving code:', error);
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

  // Convert API URIs to scheduling URLs and filter to ONLY admin-selected event types
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
    .filter((url): url is string => url !== null)
    .filter(url => {
      // Double-check: Only include URLs that correspond to admin-selected event types
      // This ensures we only show event types that are in calendlyEventTypes
      return calendlyEventTypes.some(savedType => {
        if (savedType === url) return true;
        // Check if the saved type is an API URI that matches this scheduling URL
        const detail = eventTypeDetails.find(et => et.uri === savedType);
        return detail?.scheduling_url === url;
      });
    });

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

  // Separate Round Robin events from individual events
  const roundRobinEvents = validBookingUrls
    .map(url => {
      const detail = eventTypeDetails.find(et => et.scheduling_url === url);
      return detail;
    })
    .filter((detail): detail is EventTypeDetails => 
      detail !== undefined && 
      (detail.pooling_type === 'round_robin_max_availability' || detail.pooling_type === 'round_robin_equal_priority')
    );

  const individualEventUrls = validBookingUrls.filter(url => {
    const detail = eventTypeDetails.find(et => et.scheduling_url === url);
    return !detail || (!detail.pooling_type || detail.pooling_type === 'null');
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Booking Links</CardTitle>
            <CardDescription>
              Team booking links for appointments
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
      <CardContent className="space-y-6">
        {/* Round Robin Events Section */}
        {roundRobinEvents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Round Robin Events (Shared Links)</h3>
            </div>
            {roundRobinEvents.map((eventType) => (
              <div key={eventType.uri} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{eventType.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    Round Robin
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Input
                    value={eventType.scheduling_url}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(eventType.scheduling_url, eventType.name)}
                      className="flex-1"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(eventType.scheduling_url, '_blank')}
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is a shared booking link. Calendly will automatically assign leads to team members in rotation.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Individual Event Links Section */}
        {individualEventUrls.length > 0 && (
          <div className="space-y-3">
            {roundRobinEvents.length > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">Individual Booking Links</h3>
              </div>
            )}
            {filteredMembers.map((member) => {
              const currentCode = editingCodes[member.user_id] ?? member.booking_code ?? '';
              const hasBookingCode = !!(member.booking_code);
              const isGenerating = loading && !member.booking_code;

              return (
                <div key={member.user_id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.profiles.full_name}</p>
                      <Badge variant="secondary" className="mt-1">
                        {member.role === 'offer_owner' ? 'Offer Owner' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Booking Code</label>
                    <Input
                      placeholder="e.g., john_s"
                      value={currentCode}
                      onChange={(e) =>
                        setEditingCodes((prev) => ({
                          ...prev,
                          [member.user_id]: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        const newCode = e.target.value.trim();
                        if (newCode && newCode !== member.booking_code) {
                          handleSaveCode(member.user_id, newCode);
                        }
                      }}
                      className="flex-1"
                      disabled={!isOwner && member.user_id !== currentUserId}
                    />
                    <p className="text-xs text-muted-foreground">
                      {member.booking_code ? 
                        'Edit and press Enter or click away to update' : 
                        'Generating personalized code...'
                      }
                    </p>
                    
                    {/* Status indicator */}
                    <div className="mt-1">
                      {member.booking_code ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          <span>Code active - your links are ready</span>
                        </div>
                      ) : isGenerating ? (
                        <div className="flex items-center gap-1 text-xs text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Generating your unique code...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          <span>No code - links won't work yet</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Manual generate button if code is still null */}
                    {!member.booking_code && (isOwner || member.user_id === currentUserId) && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          console.log('🔧 Manual generation triggered for:', member.profiles.full_name);
                          await autoGenerateAndSaveCodes([member]);
                        }}
                        disabled={loading}
                        className="mt-2"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate My Code Now
                      </Button>
                    )}
                  </div>

                  {hasBookingCode && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Personalized Booking Links ({individualEventUrls.length} event {individualEventUrls.length === 1 ? 'type' : 'types'})
                      </label>
                      
                      {individualEventUrls.map((eventTypeUrl, index) => {
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
