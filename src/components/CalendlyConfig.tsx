import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, AlertCircle, CheckCircle2, Unplug, Settings, ChevronDown, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CalendlyConfigProps {
  teamId: string;
  currentAccessToken?: string | null;
  currentOrgUri?: string | null;
  currentWebhookId?: string | null;
  currentEventTypes?: string[] | null;
  onUpdate: () => void;
}

interface EventType {
  uri: string;
  name: string;
  active: boolean;
  scheduling_url: string;
  profile?: {
    name: string;
    owner: string;
  };
  pooling_type?: string | null;
  type?: string;
}

export function CalendlyConfig({ 
  teamId, 
  currentAccessToken, 
  currentOrgUri,
  currentWebhookId,
  currentEventTypes,
  onUpdate 
}: CalendlyConfigProps) {
  const [accessToken, setAccessToken] = useState("");
  const [organizationUri, setOrganizationUri] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [fetchingOrgUri, setFetchingOrgUri] = useState(false);
  const [availableEventTypes, setAvailableEventTypes] = useState<EventType[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(currentEventTypes || []);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [savingEventTypes, setSavingEventTypes] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [isManualFetchOpen, setIsManualFetchOpen] = useState(false);
  const [isFetchingManual, setIsFetchingManual] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isConnected = Boolean(currentAccessToken && currentOrgUri && currentWebhookId);
  const [tokenValidationFailed, setTokenValidationFailed] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('calendly_oauth_success');
    const oauthError = params.get('calendly_oauth_error');
    const closePopup = params.get('close_popup');

    // If this is a popup that should close itself
    if (closePopup === 'true' && window.opener) {
      window.opener.postMessage({ type: 'calendly-oauth-success' }, '*');
      window.close();
      return;
    }

    if (oauthSuccess === 'true') {
      toast({
        title: "🎉 Connected Successfully!",
        description: "Calendly has been connected to your team. Appointments will now sync automatically.",
        duration: 5000,
      });
      
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      
      setTimeout(() => {
        onUpdate();
      }, 100);
    } else if (oauthError) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(oauthError),
        variant: "destructive",
        duration: 7000,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Listen for popup messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'calendly-oauth-success') {
        toast({
          title: "🎉 Connected Successfully!",
          description: "Calendly connected! Your appointments will now sync automatically.",
          duration: 5000,
        });
        onUpdate();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast, onUpdate]);

  useEffect(() => {
    if (isConnected && currentAccessToken && currentOrgUri && !tokenValidationFailed) {
      fetchEventTypes();
    }
  }, [isConnected, currentAccessToken, currentOrgUri, tokenValidationFailed]);

  useEffect(() => {
    setSelectedEventTypes(currentEventTypes || []);
  }, [currentEventTypes]);

  const fetchEventTypes = async () => {
    if (!currentAccessToken || !currentOrgUri) return;

    setLoadingEventTypes(true);
    try {
      const response = await fetch(`https://api.calendly.com/event_types?organization=${encodeURIComponent(currentOrgUri)}`, {
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Silently handle errors - don't show toasts
      if (!response.ok) {
        console.warn('Failed to fetch Calendly event types:', response.status);
        if (response.status === 401) {
          setTokenValidationFailed(true);
        }
        return;
      }

      const data = await response.json();
      
      // Additional check for Calendly error format
      if (data.title === 'Unauthenticated') {
        console.warn('Calendly authentication failed');
        setTokenValidationFailed(true);
        return;
      }
      
      const eventTypes = data.collection.map((et: any) => ({
        uri: et.uri,
        name: et.name,
        active: et.active,
        scheduling_url: et.scheduling_url,
        profile: et.profile,
        pooling_type: et.pooling_type,
        type: et.type,
      }));
      
      setAvailableEventTypes(eventTypes);
      setTokenValidationFailed(false);
    } catch (error: any) {
      // Silently log errors without showing toast
      console.error('Error fetching event types:', error);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  const handleEventTypeToggle = async (eventTypeUri: string) => {
    const newSelection = selectedEventTypes.includes(eventTypeUri)
      ? selectedEventTypes.filter(uri => uri !== eventTypeUri)
      : [...selectedEventTypes, eventTypeUri];
    
    setSelectedEventTypes(newSelection);
    
    // Auto-save the selection
    try {
      const { error } = await supabase
        .from("teams")
        .update({ calendly_event_types: newSelection })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Event type filters updated",
      });
      
      onUpdate();
    } catch (error: any) {
      // Revert on error
      setSelectedEventTypes(selectedEventTypes);
      
      // Don't show Calendly API errors
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update event type filters';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleManualSave = async () => {
    setSavingEventTypes(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ calendly_event_types: selectedEventTypes })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Event type filters updated",
      });
      
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEventTypes(false);
    }
  };

  const handleOAuthConnect = async () => {
    setConnecting(true);
    
    // Open popup SYNCHRONOUSLY first to avoid blocker
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      'about:blank',
      'calendly-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site and try again.",
        variant: "destructive",
      });
      setConnecting(false);
      return;
    }

    try {
      // Fetch OAuth URL
      const { data, error } = await supabase.functions.invoke("calendly-oauth-start", {
        body: { teamId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log('Calendly URL:', data.authUrl);

      // Directly set location - no HTML writing
      popup.location = data.authUrl;

      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnecting(false);
        }
      }, 500);

    } catch (error: any) {
      console.error('OAuth error:', error);
      if (popup && !popup.closed) {
        popup.close();
      }
      toast({
        title: "Error",
        description: error.message || "Failed to start OAuth flow",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (!accessToken || !organizationUri) {
      toast({
        title: "Missing Information",
        description: "Please provide both access token and organization URI",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-calendly", {
        body: { 
          teamId, 
          accessToken, 
          organizationUri 
        },
      });

      if (error) throw error;

      // Check if the response contains a Calendly API error
      if (data?.title === 'Unauthenticated' || data?.message?.includes('access token is invalid')) {
        throw new Error('Invalid Calendly access token. Please check your credentials.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Calendly integration connected! Appointments will now sync in real-time.",
      });
      
      setAccessToken("");
      setOrganizationUri("");
      onUpdate();
    } catch (error: any) {
      console.error('Connection error:', error);
      
      // Don't show the raw Calendly error
      let errorMessage = error.message || "Failed to connect Calendly integration";
      if (errorMessage.includes('Unauthenticated') || errorMessage.includes('access token is invalid')) {
        errorMessage = 'Invalid Calendly access token. Please verify your credentials and try again.';
      }
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleFetchOrgUri = async () => {
    if (!accessToken) {
      toast({
        title: "Missing Token",
        description: "Please enter your Personal Access Token first",
        variant: "destructive",
      });
      return;
    }

    setFetchingOrgUri(true);
    try {
      const response = await fetch('https://api.calendly.com/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      // Check for Calendly API errors
      if (!response.ok || data.title === 'Unauthenticated') {
        throw new Error('Invalid access token. Please check your Calendly Personal Access Token.');
      }

      const orgUri = data.resource?.current_organization;
      
      if (orgUri) {
        setOrganizationUri(orgUri);
        toast({
          title: "Success",
          description: "Organization URI fetched successfully!",
        });
      } else {
        throw new Error('Organization URI not found in response');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast({
        title: "Fetch Failed",
        description: error.message || "Failed to fetch organization URI",
        variant: "destructive",
      });
    } finally {
      setFetchingOrgUri(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Use edge function to revoke token and clear the connection
      const { data, error } = await supabase.functions.invoke("reset-calendly", {
        body: { teamId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Disconnected",
        description: "Calendly has been disconnected. To connect a different account, sign out of Calendly first.",
        duration: 7000,
      });
      
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFetchByUrl = async () => {
    if (!currentAccessToken || !manualUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Calendly URL",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingManual(true);
    try {
      // Fetch all event types from the API
      const response = await fetch(
        `https://api.calendly.com/event_types?organization=${encodeURIComponent(currentOrgUri!)}`,
        {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        toast({
          title: "Error",
          description: "Failed to fetch event types from Calendly",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      const matchedEventType = data.collection.find((et: any) => 
        et.scheduling_url.toLowerCase().includes(manualUrl.toLowerCase()) ||
        manualUrl.toLowerCase().includes(et.slug)
      );

      if (matchedEventType) {
        const eventTypeDetail: EventType = {
          uri: matchedEventType.uri,
          scheduling_url: matchedEventType.scheduling_url,
          name: matchedEventType.name,
          active: matchedEventType.active,
          profile: matchedEventType.profile,
          pooling_type: matchedEventType.pooling_type,
          type: matchedEventType.type,
        };

        // Check if the exact same event type (by URI or scheduling URL) already exists
        const exists = availableEventTypes.some(et => 
          et.uri === eventTypeDetail.uri || 
          et.scheduling_url === eventTypeDetail.scheduling_url
        );
        
        if (!exists) {
          // Add new event type and automatically select it
          setAvailableEventTypes(prev => [...prev, eventTypeDetail]);
          setSelectedEventTypes(prev => [...prev, eventTypeDetail.scheduling_url]);
          toast({
            title: "Success",
            description: `Added and selected: ${eventTypeDetail.name}`,
          });
        } else {
          // If it exists but isn't selected, select it
          if (!selectedEventTypes.includes(eventTypeDetail.scheduling_url)) {
            setSelectedEventTypes(prev => [...prev, eventTypeDetail.scheduling_url]);
            toast({
              title: "Event type selected",
              description: `${eventTypeDetail.name} is now selected`,
            });
          } else {
            toast({
              title: "Already added",
              description: "This exact event type URL is already in your list and selected",
            });
          }
        }
        
        setManualUrl("");
        setIsManualFetchOpen(false);
      } else {
        toast({
          title: "Not found",
          description: "Could not find a matching event type for that URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching event type:', error);
      toast({
        title: "Error",
        description: "Failed to fetch event type",
        variant: "destructive",
      });
    } finally {
      setIsFetchingManual(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Calendly Integration
        </CardTitle>
        <CardDescription>
          Connect your Calendly account to automatically sync appointments in real-time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Calendly is connected and syncing appointments in real-time
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connect your Calendly account to enable automatic appointment syncing
            </AlertDescription>
          </Alert>
        )}

        {!isConnected && (
          <>
            <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm space-y-2">
                <div>
                  <strong>Want to connect a different Calendly account?</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Open Calendly in a new tab</li>
                  <li>Click your profile → Sign out</li>
                  <li>Come back here and click "Connect with Calendly"</li>
                  <li>Login with the account you want to use</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button 
                onClick={handleOAuthConnect} 
                disabled={connecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
              <Calendar className="w-4 h-4 mr-2" />
              {connecting ? "Connecting..." : "Connect with Calendly"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              A popup will open to connect your Calendly account
            </p>
          </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or use manual setup
                </span>
              </div>
            </div>

            {/* Manual Token Setup */}
            <div className="space-y-2">
              <Label htmlFor="access-token">Personal Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="Enter your Calendly access token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Get your token from: <strong>Calendly → Settings → Integrations → API & Webhooks</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-uri">Organization URI</Label>
              <div className="flex gap-2">
                <Input
                  id="org-uri"
                  type="text"
                  placeholder="https://api.calendly.com/organizations/XXXXXXXX"
                  value={organizationUri}
                  onChange={(e) => setOrganizationUri(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchOrgUri}
                  disabled={fetchingOrgUri || !accessToken}
                >
                  {fetchingOrgUri ? "Fetching..." : "Auto-Fetch"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Click "Auto-Fetch" to automatically retrieve your Organization URI
              </p>
            </div>

            <Button 
              onClick={handleConnect} 
              disabled={connecting || !accessToken || !organizationUri}
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {connecting ? "Connecting..." : "Connect Calendly"}
            </Button>
          </>
        )}

        {isConnected && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Organization</span>
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {currentOrgUri}
                </span>
              </div>
            </div>

            {tokenValidationFailed ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">⚠️ Calendly Token Issue</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your access token appears to be invalid or expired. Please disconnect and reconnect with a fresh token.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <Label className="text-sm font-medium">Event Type Filters</Label>
                </div>
                
                {loadingEventTypes ? (
                  <p className="text-sm text-muted-foreground">Loading event types...</p>
                ) : availableEventTypes.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select which Calendly event types should create appointments:
                  </p>
                  
                  {/* Always use card view on small screens */}
                  <div className="space-y-4 md:space-y-0">
                    {availableEventTypes.map((eventType) => {
                      const isRoundRobin = eventType.pooling_type === 'round_robin';
                      const isTeam = eventType.pooling_type === 'collective';
                      const ownerName = eventType.profile?.name || 'Unknown';
                      const typeLabel = isRoundRobin ? 'Round Robin' : isTeam ? 'Team Event' : 'Individual';
                      
                      return (
                        <div key={eventType.uri} className="md:hidden">
                          <Card 
                            className={`cursor-pointer transition-all min-h-[68px] ${
                              selectedEventTypes.includes(eventType.scheduling_url)
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => handleEventTypeToggle(eventType.scheduling_url)}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center space-x-4">
                                <Checkbox
                                  checked={selectedEventTypes.includes(eventType.scheduling_url)}
                                  onCheckedChange={() => handleEventTypeToggle(eventType.scheduling_url)}
                                  className="h-7 w-7 border-2"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold leading-relaxed">
                                      {eventType.name}
                                    </span>
                                    {(isRoundRobin || isTeam) && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                        {typeLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {ownerName}
                                    {!eventType.active && ' • Inactive'}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Desktop List View */}
                  <div className="hidden md:block">
                    <div className="space-y-3 max-h-48 overflow-y-auto p-3 border rounded-md">
                      {availableEventTypes.map((eventType) => {
                        const isRoundRobin = eventType.pooling_type === 'round_robin';
                        const isTeam = eventType.pooling_type === 'collective';
                        const ownerName = eventType.profile?.name || 'Unknown';
                        const typeLabel = isRoundRobin ? 'Round Robin' : isTeam ? 'Team Event' : 'Individual';
                        
                        return (
                          <div key={eventType.uri} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50">
                            <Checkbox
                              id={eventType.uri}
                              checked={selectedEventTypes.includes(eventType.scheduling_url)}
                              onCheckedChange={() => handleEventTypeToggle(eventType.scheduling_url)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={eventType.uri}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {eventType.name}
                                </label>
                                {(isRoundRobin || isTeam) && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                    {typeLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {ownerName}
                                {!eventType.active && ' • Inactive'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleManualSave}
                    disabled={savingEventTypes}
                    variant="outline"
                    className="w-full min-h-[56px] text-base font-bold"
                  >
                    {savingEventTypes ? "Saving..." : "Save Event Type Filters"}
                  </Button>
                  
                  {/* Manual URL Fetch Section */}
                  <Collapsible open={isManualFetchOpen} onOpenChange={setIsManualFetchOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sm">
                        <Plus className="h-4 w-4" />
                        Don't see your event type? Add it manually
                        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isManualFetchOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-3">
                      <p className="text-xs text-muted-foreground">
                        If your Round Robin or Team event doesn't appear above, paste its Calendly URL below:
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://calendly.com/..."
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleFetchByUrl} 
                          disabled={isFetchingManual || !manualUrl.trim()}
                          size="sm"
                        >
                          {isFetchingManual ? "Fetching..." : "Add"}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {selectedEventTypes.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium">
                      ⚠️ No event types selected. All appointments will be synced.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No event types found</p>
              )}
            </div>
            )}

            <Button 
              onClick={handleDisconnect} 
              disabled={disconnecting}
              variant="destructive"
              className="w-full"
            >
              <Unplug className="w-4 h-4 mr-2" />
              {disconnecting ? "Disconnecting..." : "Disconnect Calendly"}
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Appointments sync instantly when booked in Calendly</li>
            <li>Cancellations and reschedules update automatically</li>
            <li>Team members are matched by email address</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
