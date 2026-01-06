import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plug, Plus, CheckCircle, AlertCircle, ExternalLink, 
  Trash2, Settings2, Zap, Webhook, Send, ChevronRight,
  Copy, ArrowRight, Check, CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Import real logo assets
import zapierLogo from '@/assets/integrations/zapier.svg';
import hubspotLogo from '@/assets/integrations/hubspot.svg';
import slackLogo from '@/assets/integrations/slack.svg';

interface Integration {
  id: string;
  team_id: string;
  integration_type: string;
  config: Record<string, any>;
  is_connected: boolean;
  connected_at: string | null;
}

interface IntegrationsSectionProps {
  teamId: string;
}

export function IntegrationsSection({ teamId }: IntegrationsSectionProps) {
  const queryClient = useQueryClient();
  const [showGHLDialog, setShowGHLDialog] = useState(false);
  const [showZapierDialog, setShowZapierDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  
  const [ghlWebhookUrl, setGhlWebhookUrl] = useState('');
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Fetch integrations
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['team-integrations', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_integrations')
        .select('*')
        .eq('team_id', teamId);
      
      if (error) throw error;
      return data as Integration[];
    },
  });

  // Get specific integration
  const getIntegration = (type: string) => integrations.find(i => i.integration_type === type);
  const ghlIntegration = getIntegration('ghl');
  const zapierIntegration = getIntegration('zapier');
  const customWebhooks = integrations.filter(i => i.integration_type === 'custom_webhook');

  // Connect integration mutation
  const connectMutation = useMutation({
    mutationFn: async ({ type, config }: { type: string; config: Record<string, any> }) => {
      const existing = getIntegration(type);
      
      if (existing) {
        const { error } = await supabase
          .from('team_integrations')
          .update({
            config,
            is_connected: true,
            connected_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_integrations')
          .insert({
            team_id: teamId,
            integration_type: type,
            config,
            is_connected: true,
            connected_at: new Date().toISOString(),
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-integrations', teamId] });
    },
  });

  // Disconnect integration mutation
  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from('team_integrations')
        .update({ is_connected: false })
        .eq('id', integrationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-integrations', teamId] });
      toast({ title: 'Integration disconnected' });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from('team_integrations')
        .delete()
        .eq('id', integrationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-integrations', teamId] });
      toast({ title: 'Webhook removed' });
    },
  });

  // Toggle webhook active state
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const webhook = integrations.find(i => i.id === id);
      if (!webhook) return;
      
      const { error } = await supabase
        .from('team_integrations')
        .update({ 
          config: { ...webhook.config, active } 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-integrations', teamId] });
    },
  });

  const connectGHL = () => {
    if (!ghlWebhookUrl.trim()) {
      toast({ title: 'Please enter your GHL webhook URL', variant: 'destructive' });
      return;
    }
    
    connectMutation.mutate(
      { type: 'ghl', config: { webhook_url: ghlWebhookUrl } },
      {
        onSuccess: () => {
          setShowGHLDialog(false);
          setGhlWebhookUrl('');
          toast({ title: 'GoHighLevel connected', description: 'Leads will now sync to your GHL account' });
        },
      }
    );
  };

  const connectZapier = () => {
    if (!zapierWebhookUrl.trim()) {
      toast({ title: 'Please enter your Zapier webhook URL', variant: 'destructive' });
      return;
    }
    
    connectMutation.mutate(
      { type: 'zapier', config: { webhook_url: zapierWebhookUrl } },
      {
        onSuccess: () => {
          setShowZapierDialog(false);
          setZapierWebhookUrl('');
          toast({ title: 'Zapier connected', description: 'Your Zap will trigger on new leads' });
        },
      }
    );
  };

  const addCustomWebhook = () => {
    if (!newWebhookUrl.trim()) {
      toast({ title: 'Please enter a webhook URL', variant: 'destructive' });
      return;
    }
    
    connectMutation.mutate(
      { 
        type: 'custom_webhook', 
        config: { 
          name: newWebhookName || `Webhook ${customWebhooks.length + 1}`,
          webhook_url: newWebhookUrl,
          active: true,
        } 
      },
      {
        onSuccess: () => {
          setShowWebhookDialog(false);
          setNewWebhookName('');
          setNewWebhookUrl('');
          toast({ title: 'Webhook added' });
        },
      }
    );
  };

  const testWebhook = async (url: string, funnelName?: string) => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-ghl-webhook', {
        body: { webhook_url: url, funnel_name: funnelName }
      });
      
      if (error) throw error;
      
      toast({ 
        title: 'Test sent successfully!', 
        description: 'Check GHL and click "Check for new requests" to see the mapping' 
      });
    } catch (error) {
      console.error('Test webhook error:', error);
      toast({ 
        title: 'Test failed', 
        description: error instanceof Error ? error.message : 'Could not reach the webhook URL', 
        variant: 'destructive' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Brand icons - using real logos where available
  const GHLIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#0B1628]">
      <svg viewBox="0 0 48 48" className="w-9 h-9">
        {/* HighLevel 3 arrows logo */}
        <polygon points="12,36 12,22 18,14 24,22 24,36" fill="#D4A74A"/>
        <polygon points="18,14 12,22 24,22" fill="#D4A74A"/>
        <polygon points="18,36 18,26 24,20 30,26 30,36" fill="#4A9FD9"/>
        <polygon points="24,20 18,26 30,26" fill="#4A9FD9"/>
        <polygon points="24,36 24,20 30,12 36,20 36,36" fill="#5FBF5F"/>
        <polygon points="30,12 24,20 36,20" fill="#5FBF5F"/>
      </svg>
    </div>
  );

  const ZapierIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#FF4A00]">
      <span className="text-white font-semibold text-[10px] tracking-tight">zapier</span>
    </div>
  );

  const CloseIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#262B38]">
      <svg viewBox="0 0 40 40" className="w-7 h-7">
        <circle cx="20" cy="20" r="12" stroke="white" strokeWidth="2.5" fill="none"/>
        <path d="M15 15l10 10M25 15l-10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );

  const HubSpotIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#FF7A59] p-2">
      <img src={hubspotLogo} alt="HubSpot" className="w-full h-full" />
    </div>
  );

  const ActiveCampaignIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#004CFF]">
      <svg viewBox="0 0 40 40" className="w-7 h-7">
        <path d="M10 22l8 8 14-18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );

  const MakeIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#6D00CC]">
      <svg viewBox="0 0 40 40" className="w-7 h-7">
        <circle cx="14" cy="20" r="5" stroke="white" strokeWidth="2" fill="none"/>
        <circle cx="26" cy="20" r="5" stroke="white" strokeWidth="2" fill="none"/>
        <line x1="19" y1="20" x2="21" y2="20" stroke="white" strokeWidth="2"/>
      </svg>
    </div>
  );

  const SlackIcon = () => (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white p-2">
      <img src={slackLogo} alt="Slack" className="w-full h-full" />
    </div>
  );

  // All available integrations as cards
  const allIntegrations = [
    {
      id: 'ghl',
      name: 'GoHighLevel',
      type: 'ghl',
      icon: <GHLIcon />,
      description: 'Send leads directly to your GHL CRM and trigger automations',
      connected: ghlIntegration?.is_connected || false,
      url: ghlIntegration?.config?.webhook_url,
      integration: ghlIntegration,
      available: true,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      type: 'zapier',
      icon: <ZapierIcon />,
      description: 'Connect to 5,000+ apps with Zapier webhooks',
      connected: zapierIntegration?.is_connected || false,
      url: zapierIntegration?.config?.webhook_url,
      integration: zapierIntegration,
      available: true,
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      type: 'webhook',
      icon: <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Webhook className="h-5 w-5 text-foreground" /></div>,
      description: 'Connect events within your Funnel to a URL',
      connected: customWebhooks.length > 0,
      available: true,
    },
    {
      id: 'close',
      name: 'Close CRM',
      type: 'close',
      icon: <CloseIcon />,
      description: 'Send funnel data to Close CRM for sales automation',
      connected: false,
      available: false,
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      type: 'hubspot',
      icon: <HubSpotIcon />,
      description: 'Sync contacts and leads to HubSpot CRM',
      connected: false,
      available: false,
    },
    {
      id: 'activecampaign',
      name: 'ActiveCampaign',
      type: 'activecampaign',
      icon: <ActiveCampaignIcon />,
      description: 'Send lead data from funnels to ActiveCampaign',
      connected: false,
      available: false,
    },
    {
      id: 'make',
      name: 'Make',
      type: 'make',
      icon: <MakeIcon />,
      description: 'Send funnel data to Make and connect 1000+ apps',
      connected: false,
      available: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      type: 'slack',
      icon: <SlackIcon />,
      description: 'Get notified in Slack when leads are captured',
      connected: false,
      available: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Apps</h1>
        <p className="text-muted-foreground mt-1">
          Connect your funnels to external services and CRMs
        </p>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allIntegrations.map((integration) => (
          <div 
            key={integration.id}
            className={cn(
              "bg-card border rounded-xl p-5 hover:shadow-md transition-all relative group",
              !integration.available && "opacity-60"
            )}
          >
            {/* Toggle/Menu in top right */}
            {integration.available && integration.connected && (
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <Switch 
                  checked={integration.connected}
                  onCheckedChange={() => {
                    if (integration.integration) {
                      disconnectMutation.mutate(integration.integration.id);
                    }
                  }}
                />
              </div>
            )}
            
            <div className="space-y-3">
              {integration.icon}
              
              <div>
                <h3 className="font-semibold text-foreground">{integration.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {integration.description}
                </p>
              </div>
              
              {integration.available ? (
                integration.connected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (integration.type === 'ghl') {
                        setGhlWebhookUrl(ghlIntegration?.config?.webhook_url || '');
                        setShowGHLDialog(true);
                      }
                      if (integration.type === 'zapier') {
                        setZapierWebhookUrl(zapierIntegration?.config?.webhook_url || '');
                        setShowZapierDialog(true);
                      }
                      if (integration.type === 'webhook') {
                        setShowWebhookDialog(true);
                      }
                    }}
                  >
                    Connect
                  </Button>
                )
              ) : (
                <Badge variant="outline" className="mt-2">Coming Soon</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active Custom Webhooks */}
      {customWebhooks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Active Webhooks</h2>
          <div className="bg-card border rounded-xl divide-y">
            {customWebhooks.map((webhook) => (
              <div key={webhook.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Webhook className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.config?.name || 'Webhook'}</span>
                      {!webhook.config?.active && (
                        <Badge variant="outline" className="text-xs">Paused</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                      {webhook.config?.webhook_url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={webhook.config?.active !== false} 
                    onCheckedChange={(checked) => toggleWebhookMutation.mutate({ id: webhook.id, active: checked })} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => testWebhook(webhook.config?.webhook_url)}
                    disabled={isTesting}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GHL Dialog - Enhanced */}
      <Dialog open={showGHLDialog} onOpenChange={setShowGHLDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <GHLIcon />
              <div>
                <DialogTitle className="text-xl">Connect GoHighLevel</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Set up your GHL webhook in 5 simple steps
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-6">
              {/* Step-by-Step Setup Guide */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">How to Set Up</h3>
                
                <div className="space-y-3">
                  {[
                    { step: 1, title: 'Open GoHighLevel', desc: 'Go to your GHL account and navigate to Automation → Workflows' },
                    { step: 2, title: 'Create or Edit a Workflow', desc: 'Click "+ Create Workflow" or open an existing workflow you want to trigger' },
                    { step: 3, title: 'Add New Trigger', desc: 'Click "Add New Trigger" in your workflow builder' },
                    { step: 4, title: 'Select Inbound Webhook', desc: 'Search and select "Inbound Webhook" as your trigger type' },
                    { step: 5, title: 'Copy the Webhook URL', desc: 'Copy the URL that GHL generates (starts with https://services.leadconnectorhq.com/hooks/...)' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                        {step}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="font-medium text-foreground">{title}</p>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Webhook URL Input */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <label className="text-sm font-semibold text-foreground">
                  Paste Your Webhook URL <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                  value={ghlWebhookUrl}
                  onChange={(e) => setGhlWebhookUrl(e.target.value)}
                  className="font-mono text-sm bg-background"
                />
              </div>

              {/* Field Mapping Reference */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Field Mapping Reference</h3>
                  <Badge variant="outline" className="text-xs">For GHL Custom Values</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Use these field references in GHL to map incoming data to your CRM fields:
                </p>

                <div className="bg-card border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr,auto,1fr] text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 border-b">
                    <span>Our Data</span>
                    <span></span>
                    <span>GHL Field</span>
                  </div>
                  <div className="divide-y">
                    {[
                      { field: 'name', ghl: 'Full Name', desc: 'Lead\'s full name' },
                      { field: 'email', ghl: 'Email', desc: 'Lead\'s email address' },
                      { field: 'phone', ghl: 'Phone', desc: 'Lead\'s phone number' },
                      { field: 'funnel_name', ghl: 'Source / Tags', desc: 'Which funnel they came from' },
                      { field: 'custom_fields.*', ghl: 'Custom Fields', desc: 'All funnel question answers' },
                      { field: 'opt_in', ghl: 'Tags', desc: 'Opt-in consent (true/false)' },
                      { field: 'calendly_event_time', ghl: 'Appointment Date', desc: 'If Calendly booking was made' },
                      { field: 'utm_source', ghl: 'UTM Source', desc: 'Traffic source tracking' },
                      { field: 'utm_medium', ghl: 'UTM Medium', desc: 'Marketing medium' },
                      { field: 'utm_campaign', ghl: 'UTM Campaign', desc: 'Campaign name' },
                    ].map(({ field, ghl, desc }) => (
                      <div key={field} className="grid grid-cols-[1fr,auto,1fr] items-center px-4 py-2.5 text-sm group hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{field}</code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${field}}}`);
                              toast({ title: 'Copied!', description: `{{${field}}} copied to clipboard` });
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground mx-2" />
                        <div>
                          <span className="font-medium text-foreground">{ghl}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Payload */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Sample Payload</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const samplePayload = JSON.stringify({
                          name: "John Doe",
                          email: "john@example.com",
                          phone: "+1234567890",
                          funnel_name: "Lead Magnet Funnel",
                          opt_in: true,
                          custom_fields: {
                            budget: "$5,000 - $10,000",
                            timeline: "Within 30 days"
                          },
                          utm_source: "facebook",
                          calendly_booked: true,
                          calendly_event_time: "2024-01-15T10:00:00Z"
                        }, null, 2);
                        navigator.clipboard.writeText(samplePayload);
                        toast({ title: 'Sample payload copied!' });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Sample
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground font-mono bg-background/50 rounded p-3 overflow-x-auto">
{`{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "funnel_name": "Lead Magnet Funnel",
  "custom_fields": { "budget": "$5k-$10k" },
  "opt_in": true,
  "calendly_event_time": "2024-01-15T10:00:00Z"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center gap-2 p-4 border-t bg-muted/30">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (ghlWebhookUrl.trim()) {
                  testWebhook(ghlWebhookUrl);
                } else {
                  toast({ title: 'Enter a webhook URL first', variant: 'destructive' });
                }
              }}
              disabled={isTesting || !ghlWebhookUrl.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {isTesting ? 'Sending...' : 'Send Test'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowGHLDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={connectGHL} 
                disabled={connectMutation.isPending || !ghlWebhookUrl.trim()}
                className="bg-[#0B1628] hover:bg-[#0B1628]/90"
              >
                {connectMutation.isPending ? 'Connecting...' : 'Connect GHL'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zapier Dialog */}
      <Dialog open={showZapierDialog} onOpenChange={setShowZapierDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>Connect Zapier</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Enter your Zapier webhook URL
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={zapierWebhookUrl}
                onChange={(e) => setZapierWebhookUrl(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Create a Zap with "Webhooks by Zapier" as the trigger
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowZapierDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={connectZapier} 
              disabled={connectMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {connectMutation.isPending ? 'Connecting...' : 'Connect Zapier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Webhook className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <DialogTitle>Add Custom Webhook</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Receive lead data at your endpoint
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <Input
                placeholder="My Webhook"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="https://your-api.com/webhook"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addCustomWebhook}
              disabled={connectMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {connectMutation.isPending ? 'Adding...' : 'Add Webhook'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
