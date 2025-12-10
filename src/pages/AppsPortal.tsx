import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendlyConfig } from "@/components/CalendlyConfig";
import { Check, ExternalLink } from "lucide-react";

// Import logos
import calendlyLogo from "@/assets/integrations/calendly.svg";
import ghlLogo from "@/assets/integrations/ghl.svg";
import stripeLogo from "@/assets/integrations/stripe.svg";
import zoomLogo from "@/assets/integrations/zoom.svg";
import googleMeetLogo from "@/assets/integrations/google-meet.svg";
import zapierLogo from "@/assets/integrations/zapier.svg";
import slackLogo from "@/assets/integrations/slack.svg";
import hubspotLogo from "@/assets/integrations/hubspot.svg";

interface App {
  id: string;
  name: string;
  description: string;
  logo: string;
  category: "scheduling" | "crm" | "payments" | "communication" | "analytics";
  status: "connected" | "available" | "coming_soon";
  configurable?: boolean;
}

const apps: App[] = [
  {
    id: "calendly",
    name: "Calendly",
    description: "Scheduling and appointment booking",
    logo: calendlyLogo,
    category: "scheduling",
    status: "available",
    configurable: true,
  },
  {
    id: "ghl",
    name: "GoHighLevel",
    description: "CRM and marketing automation",
    logo: ghlLogo,
    category: "crm",
    status: "available",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5000+ apps",
    logo: zapierLogo,
    category: "communication",
    status: "available",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team messaging and notifications",
    logo: slackLogo,
    category: "communication",
    status: "coming_soon",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM and sales automation",
    logo: hubspotLogo,
    category: "crm",
    status: "coming_soon",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing",
    logo: stripeLogo,
    category: "payments",
    status: "coming_soon",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Video conferencing",
    logo: zoomLogo,
    category: "scheduling",
    status: "coming_soon",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Video meetings",
    logo: googleMeetLogo,
    category: "scheduling",
    status: "coming_soon",
  },
];

const categoryLabels: Record<string, string> = {
  scheduling: "Scheduling",
  crm: "CRM & Marketing",
  payments: "Payments",
  communication: "Communication",
  analytics: "Analytics",
};

export default function AppsPortal() {
  const { teamId } = useParams();
  const [calendlyDialogOpen, setCalendlyDialogOpen] = useState(false);

  // Fetch team integrations
  const { data: teamData, refetch } = useQuery({
    queryKey: ["team-integrations", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("calendly_access_token, calendly_webhook_id")
        .eq("id", teamId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const getAppStatus = (app: App): App["status"] => {
    if (app.id === "calendly" && teamData?.calendly_access_token) {
      return "connected";
    }
    return app.status;
  };

  const handleAppClick = (app: App) => {
    if (app.id === "calendly" && app.configurable) {
      setCalendlyDialogOpen(true);
    }
  };

  // Group apps by category
  const groupedApps = apps.reduce((acc, app) => {
    if (!acc[app.category]) acc[app.category] = [];
    acc[app.category].push(app);
    return acc;
  }, {} as Record<string, App[]>);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Apps</h1>
          <p className="text-muted-foreground mt-1">
            Connect your favorite tools and services
          </p>
        </div>

        <div className="space-y-10">
          {Object.entries(groupedApps).map(([category, categoryApps]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {categoryLabels[category]}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryApps.map((app) => {
                  const status = getAppStatus(app);
                  const isConnected = status === "connected";
                  const isComingSoon = status === "coming_soon";

                  return (
                    <Card
                      key={app.id}
                      className={`border-border/50 transition-all ${
                        isComingSoon 
                          ? "opacity-60 cursor-not-allowed" 
                          : "hover:border-primary/30 hover:shadow-md cursor-pointer"
                      }`}
                      onClick={() => !isComingSoon && handleAppClick(app)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            <img 
                              src={app.logo} 
                              alt={app.name}
                              className="h-8 w-8 object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground truncate">
                                {app.name}
                              </h3>
                              {isConnected && (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
                                  <Check className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                              {isComingSoon && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Soon
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {app.description}
                            </p>
                          </div>
                        </div>
                        {!isComingSoon && (
                          <Button
                            variant={isConnected ? "outline" : "default"}
                            size="sm"
                            className="w-full mt-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAppClick(app);
                            }}
                          >
                            {isConnected ? "Manage" : "Connect"}
                            <ExternalLink className="h-3 w-3 ml-2" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Calendly Config Dialog */}
        <Dialog open={calendlyDialogOpen} onOpenChange={setCalendlyDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <img src={calendlyLogo} alt="Calendly" className="h-6 w-6" />
                Calendly Configuration
              </DialogTitle>
            </DialogHeader>
            <CalendlyConfig teamId={teamId || ""} onUpdate={refetch} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}