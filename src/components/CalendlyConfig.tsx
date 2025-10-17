import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, AlertCircle, CheckCircle2, Unplug } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CalendlyConfigProps {
  teamId: string;
  currentAccessToken?: string | null;
  currentOrgUri?: string | null;
  currentWebhookId?: string | null;
  onUpdate: () => void;
}

export function CalendlyConfig({ 
  teamId, 
  currentAccessToken, 
  currentOrgUri,
  currentWebhookId,
  onUpdate 
}: CalendlyConfigProps) {
  const [accessToken, setAccessToken] = useState("");
  const [organizationUri, setOrganizationUri] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [fetchingOrgUri, setFetchingOrgUri] = useState(false);
  const { toast } = useToast();

  const isConnected = Boolean(currentAccessToken && currentOrgUri && currentWebhookId);

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

      if (data.error) {
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
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Calendly integration",
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

      if (!response.ok) {
        throw new Error('Failed to fetch organization URI. Please check your access token.');
      }

      const data = await response.json();
      const orgUri = data.resource.current_organization;
      
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
    if (!currentAccessToken || !currentWebhookId) return;

    setDisconnecting(true);
    try {
      // Delete webhook from Calendly
      const webhookResponse = await fetch(currentWebhookId, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
        },
      });

      if (!webhookResponse.ok) {
        console.warn('Failed to delete webhook from Calendly');
      }

      // Clear from database
      const { error } = await supabase
        .from("teams")
        .update({ 
          calendly_access_token: null,
          calendly_organization_uri: null,
          calendly_webhook_id: null,
        })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: "Calendly integration has been disconnected",
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
