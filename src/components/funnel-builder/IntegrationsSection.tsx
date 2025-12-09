import { useState } from 'react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Integration {
  id: string;
  name: string;
  type: 'ghl' | 'zapier' | 'webhook';
  icon: React.ReactNode;
  description: string;
  connected: boolean;
  url?: string;
}

interface IntegrationsSectionProps {
  teamId: string;
}

export function IntegrationsSection({ teamId }: IntegrationsSectionProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'ghl',
      name: 'GoHighLevel',
      type: 'ghl',
      icon: <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">GHL</div>,
      description: 'Send leads directly to your GHL CRM and trigger automations',
      connected: false,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      type: 'zapier',
      icon: <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"><Zap className="h-4 w-4 text-white" /></div>,
      description: 'Connect to 5,000+ apps with Zapier webhooks',
      connected: false,
    },
  ]);

  const [customWebhooks, setCustomWebhooks] = useState<{id: string; name: string; url: string; active: boolean}[]>([]);
  const [showGHLDialog, setShowGHLDialog] = useState(false);
  const [showZapierDialog, setShowZapierDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  
  const [ghlWebhookUrl, setGhlWebhookUrl] = useState('');
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const connectGHL = () => {
    if (!ghlWebhookUrl.trim()) {
      toast({ title: 'Please enter your GHL webhook URL', variant: 'destructive' });
      return;
    }
    
    setIntegrations(prev => prev.map(i => 
      i.id === 'ghl' ? { ...i, connected: true, url: ghlWebhookUrl } : i
    ));
    setShowGHLDialog(false);
    toast({ title: 'GoHighLevel connected', description: 'Leads will now sync to your GHL account' });
  };

  const connectZapier = () => {
    if (!zapierWebhookUrl.trim()) {
      toast({ title: 'Please enter your Zapier webhook URL', variant: 'destructive' });
      return;
    }
    
    setIntegrations(prev => prev.map(i => 
      i.id === 'zapier' ? { ...i, connected: true, url: zapierWebhookUrl } : i
    ));
    setShowZapierDialog(false);
    toast({ title: 'Zapier connected', description: 'Your Zap will trigger on new leads' });
  };

  const addCustomWebhook = () => {
    if (!newWebhookUrl.trim()) {
      toast({ title: 'Please enter a webhook URL', variant: 'destructive' });
      return;
    }
    
    setCustomWebhooks(prev => [...prev, {
      id: crypto.randomUUID(),
      name: newWebhookName || `Webhook ${prev.length + 1}`,
      url: newWebhookUrl,
      active: true
    }]);
    setShowWebhookDialog(false);
    setNewWebhookName('');
    setNewWebhookUrl('');
    toast({ title: 'Webhook added' });
  };

  const testWebhook = async (url: string) => {
    setIsTesting(true);
    try {
      // Send a test payload
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test webhook from Lovable',
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

  const disconnectIntegration = (id: string) => {
    setIntegrations(prev => prev.map(i => 
      i.id === id ? { ...i, connected: false, url: undefined } : i
    ));
    toast({ title: 'Integration disconnected' });
  };

  const removeWebhook = (id: string) => {
    setCustomWebhooks(prev => prev.filter(w => w.id !== id));
    toast({ title: 'Webhook removed' });
  };

  const toggleWebhook = (id: string) => {
    setCustomWebhooks(prev => prev.map(w => 
      w.id === id ? { ...w, active: !w.active } : w
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect your funnels to external services and CRMs
          </p>
        </div>
      </div>

      {/* Native Integrations */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">CRM & Automation</h2>
        <div className="grid gap-3">
          {integrations.map((integration) => (
            <div 
              key={integration.id}
              className="bg-card border rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                {integration.icon}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{integration.name}</h3>
                    {integration.connected && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/50 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              
              {integration.connected ? (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => testWebhook(integration.url!)}
                    disabled={isTesting}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Test
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => disconnectIntegration(integration.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => {
                    if (integration.type === 'ghl') setShowGHLDialog(true);
                    if (integration.type === 'zapier') setShowZapierDialog(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Connect
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Webhooks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Custom Webhooks</h2>
          <Button variant="outline" size="sm" onClick={() => setShowWebhookDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Webhook
          </Button>
        </div>
        
        {customWebhooks.length > 0 ? (
          <div className="bg-card border rounded-xl divide-y">
            {customWebhooks.map((webhook) => (
              <div key={webhook.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Webhook className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      {!webhook.active && (
                        <Badge variant="outline" className="text-xs">Paused</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                      {webhook.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={webhook.active} 
                    onCheckedChange={() => toggleWebhook(webhook.id)} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => testWebhook(webhook.url)}
                    disabled={isTesting}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeWebhook(webhook.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border rounded-xl bg-muted/30">
            <Webhook className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No custom webhooks configured</p>
            <p className="text-xs text-muted-foreground mt-1">Add a webhook to receive lead data at your own endpoint</p>
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Coming Soon</h2>
        <div className="grid gap-3 opacity-60">
          {[
            { name: 'Twilio', description: 'SMS and voice automation', icon: '📱' },
            { name: 'Slack', description: 'Team notifications', icon: '💬' },
            { name: 'Mailchimp', description: 'Email marketing', icon: '📧' },
            { name: 'HubSpot', description: 'CRM integration', icon: '🔶' },
          ].map((item) => (
            <div key={item.name} className="bg-card border rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-lg">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          ))}
        </div>
      </div>

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
            <Button onClick={connectGHL} className="bg-blue-600 hover:bg-blue-700">
              Connect GHL
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
            <Button onClick={connectZapier} className="bg-orange-600 hover:bg-orange-700">
              Connect Zapier
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
            <Button onClick={addCustomWebhook} className="bg-purple-600 hover:bg-purple-700">
              Add Webhook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
