import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plug, Plus, CheckCircle, AlertCircle, ExternalLink, 
  Trash2, Settings2, Zap, Webhook, Send, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

  const testWebhook = async (url: string) => {
    setIsTesting(true);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test webhook from GRWTH OP',
          data: {
            name: 'Test Lead',
            email: 'test@example.com',
            phone: '+1234567890'
          }
        })
      });
      toast({ title: 'Test sent', description: 'Check your webhook endpoint for the test payload' });
    } catch (error) {
      toast({ title: 'Test failed', description: 'Could not reach the webhook URL', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  // All available integrations as cards
  const allIntegrations = [
    {
      id: 'ghl',
      name: 'GoHighLevel',
      type: 'ghl',
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">GHL</div>,
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
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"><Zap className="h-5 w-5 text-white" /></div>,
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
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">C</div>,
      description: 'Send funnel data to Close CRM for sales automation',
      connected: false,
      available: false,
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      type: 'hubspot',
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">H</div>,
      description: 'Sync contacts and leads to HubSpot CRM',
      connected: false,
      available: false,
    },
    {
      id: 'activecampaign',
      name: 'ActiveCampaign',
      type: 'activecampaign',
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">AC</div>,
      description: 'Send lead data from funnels to ActiveCampaign',
      connected: false,
      available: false,
    },
    {
      id: 'make',
      name: 'Make',
      type: 'make',
      icon: <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">M</div>,
      description: 'Send funnel data to Make and connect 1000+ apps',
      connected: false,
      available: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      type: 'slack',
      icon: <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-2xl">💬</div>,
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

      {/* GHL Dialog */}
      <Dialog open={showGHLDialog} onOpenChange={setShowGHLDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">GHL</div>
              <div>
                <DialogTitle>Connect GoHighLevel</DialogTitle>
                <p className="text-sm text-muted-foreground">Enter your GHL webhook URL</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="https://services.leadconnectorhq.com/hooks/..."
                value={ghlWebhookUrl}
                onChange={(e) => setGhlWebhookUrl(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Find this in GHL → Automation → Workflows → Webhook trigger
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowGHLDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={connectGHL} 
              disabled={connectMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connectMutation.isPending ? 'Connecting...' : 'Connect GHL'}
            </Button>
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
                <p className="text-sm text-muted-foreground">Enter your Zapier webhook URL</p>
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
                <p className="text-sm text-muted-foreground">Receive lead data at your endpoint</p>
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
