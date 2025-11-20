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
import { Calendar, AlertCircle, CheckCircle2, Unplug, Settings, ChevronDown, Plus, Download, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EventTypeFilter } from "@/components/EventTypeFilter";
import { MigrateEventTypes } from "@/components/MigrateEventTypes";

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
  const [fixingWebhook, setFixingWebhook] = useState(false);
  const [importingAppointments, setImportingAppointments] = useState(false);
  const [selectedEventTypeForSync, setSelectedEventTypeForSync] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [tokenRefreshInProgress, setTokenRefreshInProgress] = useState(false);
  const [tokenValidationFailed, setTokenValidationFailed] = useState(false);

  const isConnected = Boolean(currentAccessToken && currentOrgUri && currentWebhookId);

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
        title: "Calendly Successfully Connected",
        description: "Your Calendly account is now connected. Appointments will sync automatically.",
        duration: 5000,
      });
      
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      
      setTimeout(() => {
        onUpdate();
      }, 100);
      } else if (oauthError) {
      let errorMessage = decodeURIComponent(oauthError);
      
      // Provide helpful messages for common errors
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        errorMessage = "Your Calendly account needs admin/owner permissions to connect. Please have an organization admin connect Calendly instead.";
      } else if (errorMessage.includes('webhook')) {
        errorMessage = "Failed to setup webhook. Make sure you have organization admin permissions in Calendly.";
      }
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 10000,
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
    if (isConnected && currentAccessToken && currentOrgUri && !tokenValidationFailed && !tokenRefreshInProgress && !loadingEventTypes) {
      const timer = setTimeout(() => {
        fetchEventTypes();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isConnected, currentAccessToken, currentOrgUri]);

  useEffect(() => {
    // Clean up selectedEventTypes to only include API URIs (not scheduling_url)
    const cleanedEventTypes = (currentEventTypes || []).filter(uri => 
      uri.includes('/event_types/')
    );
    setSelectedEventTypes(cleanedEventTypes);
  }, [currentEventTypes]);

  const fetchEventTypes = async () => {
    if (!currentAccessToken || !currentOrgUri || tokenRefreshInProgress) return;

    setLoadingEventTypes(true);
    try {
      const response = await fetch(`https://api.calendly.com/event_types?organization=${encodeURIComponent(currentOrgUri)}`, {
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch Calendly event types:', response.status);
        if (response.status === 401 && !tokenRefreshInProgress) {
          setTokenRefreshInProgress(true);
          try {
            const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-calendly-token', {
              body: { teamId }
            });

            if (refreshError || refreshData?.error) {
              setTokenValidationFailed(true);
              setTokenRefreshInProgress(false);
              console.error('Token refresh failed, user needs to reconnect');
              return;
            }

            // Token refreshed - wait for parent to update props
            console.log('Token refreshed successfully');
            setLoadingEventTypes(false);
            setTokenRefreshInProgress(false);
            onUpdate();
            return;
          } catch (e) {
            setTokenValidationFailed(true);
            setTokenRefreshInProgress(false);
            console.error('Token refresh error:', e);
            return;
          }
        }
        setLoadingEventTypes(false);
        return;
      }

      const data = await response.json();
      
      if (data.title === 'Unauthenticated') {
        console.warn('Calendly authentication failed');
        setTokenValidationFailed(true);
        toast({
          title: "Token Expired",
          description: "Please disconnect and reconnect Calendly.",
          variant: "destructive",
        });
        setLoadingEventTypes(false);
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
      setTokenRefreshInProgress(false);
    } catch (error: any) {
      console.error('Error fetching event types:', error);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  const handleEventTypeToggle = async (eventTypeUri: string) => {
    // Ensure we only work with API URIs, not scheduling URLs
    if (!eventTypeUri.includes('/event_types/')) {
      console.error('Invalid event type URI format:', eventTypeUri);
      return;
    }
    
    const newSelection = selectedEventTypes.includes(eventTypeUri)
      ? selectedEventTypes.filter(uri => uri !== eventTypeUri)
      : [...selectedEventTypes, eventTypeUri];
    
    // Remove duplicates and filter out any scheduling_url format
    const uniqueSelection = Array.from(new Set(newSelection)).filter(uri => 
      uri.includes('/event_types/')
    );
    
    setSelectedEventTypes(uniqueSelection);
    
    // Auto-save the selection
    try {
      const { error } = await supabase
        .from("teams")
        .update({ calendly_event_types: uniqueSelection })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Sync Filter Updated",
        description: uniqueSelection.length === 0 
          ? "All event types will now sync" 
          : `${uniqueSelection.length} event type${uniqueSelection.length === 1 ? '' : 's'} will sync from Calendly`,
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
    
    try {
      console.log('Starting Calendly OAuth connection for team:', teamId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Please log in to continue');
      }
      
      console.log('User authenticated, calling OAuth start...');
      
      // Fetch OAuth URL - pass userId in body instead of relying on auth header
      const { data, error } = await supabase.functions.invoke("calendly-oauth-start", {
        body: { 
          teamId,
          userId: user.id 
        }
      });

      console.log('OAuth start response:', { data, error });

      if (error) {
        console.error('OAuth start error:', error);
        throw new Error(error.message || 'Failed to start OAuth flow');
      }
      
      if (data?.error) {
        console.error('OAuth start data error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.authUrl) {
        console.error('No auth URL in response:', data);
        throw new Error("No authorization URL received");
      }

      console.log('Calendly OAuth URL:', data.authUrl);

      // Try popup first
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        'calendly-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      // If popup blocked or failed, fallback to redirect
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        toast({
          title: "Opening Calendly Login",
          description: "You'll be redirected to Calendly to connect your account",
        });
        
        // Fallback to full page redirect
        setTimeout(() => {
          window.location.href = data.authUrl;
        }, 1000);
        return;
      }

      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnecting(false);
        }
      }, 500);

    } catch (error: any) {
      console.error('OAuth error:', error);
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

  const handleFixWebhook = async () => {
    setFixingWebhook(true);
    try {
      // Fix the webhook with correct configuration
      const { data: webhookData, error: webhookError } = await supabase.functions.invoke("fix-webhook", {
        body: { teamId }
      });

      if (webhookError) throw webhookError;
      if (webhookData?.error) throw new Error(webhookData.error);

      toast({
        title: "Webhook Fixed",
        description: `Webhook recreated successfully. New appointments will now sync automatically.`,
      });

      onUpdate();
    } catch (error: any) {
      console.error('Fix webhook error:', error);
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix webhook. Please try reconnecting Calendly.",
        variant: "destructive",
      });
    } finally {
      setFixingWebhook(false);
    }
  };

  const handleImportAppointments = async (eventTypeUri?: string | null) => {
    // Prevent double-clicks
    if (importingAppointments) {
      toast({
        title: "Import in Progress",
        description: "Please wait for the current import to complete",
        variant: "destructive",
      });
      return;
    }

    setImportingAppointments(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-calendly-appointments", {
        body: { 
          teamId,
          eventTypeUri: eventTypeUri || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const imported = data.imported || 0;
      const skipped = data.skipped || 0;
      
      if (imported === 0 && skipped === 0) {
        toast({
          title: "No Appointments Found",
          description: eventTypeUri 
            ? "No appointments found for the selected event type." 
            : "No appointments found in your Calendly account.",
        });
      } else if (imported === 0 && skipped > 0) {
        toast({
          title: "No New Appointments",
          description: `All ${skipped} appointments already exist - no duplicates created.`,
        });
      } else {
        toast({
          title: "Sync Complete!",
          description: `Imported ${imported} new appointment${imported !== 1 ? 's' : ''}.${skipped > 0 ? ` ${skipped} duplicates skipped.` : ''}`,
        });
      }
      
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import appointments from Calendly",
        variant: "destructive",
      });
    } finally {
      setImportingAppointments(false);
    }
  };

  // Auto-sync when connected or event type changes
  useEffect(() => {
    if (isConnected && currentAccessToken && currentOrgUri) {
      // Trigger initial sync on connection
      const hasInitialSynced = sessionStorage.getItem(`calendly-synced-${teamId}`);
      if (!hasInitialSynced) {
        console.log('Auto-syncing appointments on connection...');
        handleImportAppointments(selectedEventTypeForSync);
        sessionStorage.setItem(`calendly-synced-${teamId}`, 'true');
      }
    }
  }, [isConnected, currentAccessToken, currentOrgUri]);

  // Sync when event type filter changes
  useEffect(() => {
    if (isConnected && selectedEventTypeForSync !== null) {
      console.log('Event type changed, re-syncing...', selectedEventTypeForSync);
      handleImportAppointments(selectedEventTypeForSync);
    }
  }, [selectedEventTypeForSync]);

  const handleEventTypeFilterChange = (eventTypeUri: string | null) => {
    console.log('Event type filter changed:', eventTypeUri);
    setSelectedEventTypeForSync(eventTypeUri);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Please log in to continue');
      }
      
      // Use edge function to revoke token - pass userId in body
      const { data, error } = await supabase.functions.invoke("reset-calendly", {
        body: { 
          teamId,
          userId: user.id 
        }
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
    <div className="space-y-6">
      <MigrateEventTypes />
      
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
            <Collapsible className="border border-border rounded-lg">
              <CollapsibleTrigger className="w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">Why does it keep auto-logging me into my account when I click connect?</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="pl-8 space-y-2 text-sm text-muted-foreground">
                  <p>Calendly automatically uses whichever account you're currently logged into in your browser.</p>
                  <p className="font-medium text-foreground">To connect a different account:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Log out of your current Calendly account in your browser</li>
                    <li>Come back here and click "Connect with Calendly"</li>
                    <li>Log in with the account you want to use</li>
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>

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

            {/* Troubleshooting: Manual Token Setup */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Having trouble connecting? Try manual setup
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <Alert>
                  <AlertTitle>Manual Setup</AlertTitle>
                  <AlertDescription>
                    If OAuth isn't working, you can manually configure your Calendly connection using a Personal Access Token.
                  </AlertDescription>
                </Alert>

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
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {isConnected && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-[#006BFF] flex items-center justify-center">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="2" width="10" height="11" rx="1" stroke="white" strokeWidth="1.5"/>
                    <line x1="3" y1="5" x2="13" y2="5" stroke="white" strokeWidth="1.5"/>
                    <circle cx="6" cy="8" r="0.5" fill="white"/>
                    <circle cx="10" cy="8" r="0.5" fill="white"/>
                    <circle cx="6" cy="10.5" r="0.5" fill="white"/>
                    <circle cx="10" cy="10.5" r="0.5" fill="white"/>
                  </svg>
                </div>
                <span className="text-sm font-medium">Connected to Calendly</span>
                <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
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
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Sync Filter:</strong> Only appointments from selected event types will sync from Calendly. 
                      Unselected event types will be ignored when syncing appointments.
                    </p>
                  </div>
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
                              selectedEventTypes.includes(eventType.uri)
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => handleEventTypeToggle(eventType.uri)}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center space-x-4">
                                <Checkbox
                                  checked={selectedEventTypes.includes(eventType.uri)}
                                  onCheckedChange={() => handleEventTypeToggle(eventType.uri)}
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
                              checked={selectedEventTypes.includes(eventType.uri)}
                              onCheckedChange={() => handleEventTypeToggle(eventType.uri)}
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

            {/* Event Type Filter with Auto-Sync */}
            {isConnected && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Filter Appointments by Event Type</Label>
                <EventTypeFilter
                  teamId={teamId}
                  calendlyAccessToken={currentAccessToken}
                  calendlyOrgUri={currentOrgUri}
                  onFilterChange={handleEventTypeFilterChange}
                />
                {importingAppointments && (
                  <p className="text-xs text-primary animate-pulse">Syncing appointments...</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleFixWebhook} 
                disabled={fixingWebhook}
                variant="outline"
                className="flex-1"
              >
                <Settings className="w-4 h-4 mr-2" />
                {fixingWebhook ? "Fixing..." : "Fix Webhook"}
              </Button>

              <Button 
                onClick={handleDisconnect} 
                disabled={disconnecting}
                variant="destructive"
                className="flex-1"
              >
                <Unplug className="w-4 h-4 mr-2" />
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
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
    </div>
  );
}
