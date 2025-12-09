import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, Plus, Copy, CheckCircle, ExternalLink, Trash2, Link2, ArrowRight, Server
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Domain {
  id: string;
  domain: string;
  status: string;
  verification_token: string;
  verified_at: string | null;
  ssl_provisioned: boolean;
  created_at: string;
}

interface Funnel {
  id: string;
  name: string;
  slug: string;
  domain_id: string | null;
}

interface DomainsSectionProps {
  teamId: string;
}

// The hosting domain for funnels - this is where the Cloudflare Worker runs
const HOSTING_DOMAIN = 'grwthop.com';
const SUPABASE_PROJECT_ID = 'inbvluddkutyfhsxfqco';

export function DomainsSection({ teamId }: DomainsSectionProps) {
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showHostingSetupDialog, setShowHostingSetupDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [selectedDomainForLink, setSelectedDomainForLink] = useState<Domain | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');

  // Fetch domains
  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ['funnel-domains', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_domains')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Domain[];
    },
  });

  // Fetch funnels for linking
  const { data: funnels = [] } = useQuery({
    queryKey: ['funnels-for-domains', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('id, name, slug, domain_id')
        .eq('team_id', teamId);
      
      if (error) throw error;
      return data as Funnel[];
    },
  });

  // Add domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const { data, error } = await supabase
        .from('funnel_domains')
        .insert({
          team_id: teamId,
          domain: domain.toLowerCase().trim(),
          status: 'verified',
          verified_at: new Date().toISOString(),
          ssl_provisioned: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
      setShowConnectDialog(false);
      setNewDomain('');
      setSelectedDomainForLink(data);
      setSelectedFunnelId('');
      setShowLinkDialog(true);
      toast({ title: 'Domain added! Now select a funnel to connect.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add domain', description: error.message, variant: 'destructive' });
    },
  });

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase
        .from('funnel_domains')
        .delete()
        .eq('id', domainId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
      toast({ title: 'Domain removed' });
    },
  });

  // Link funnel to domain mutation
  const linkFunnelMutation = useMutation({
    mutationFn: async ({ funnelId, domainId }: { funnelId: string; domainId: string }) => {
      const { error } = await supabase
        .from('funnels')
        .update({ domain_id: domainId })
        .eq('id', funnelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels-for-domains', teamId] });
      queryClient.invalidateQueries({ queryKey: ['funnel'] });
      setShowLinkDialog(false);
      if (selectedDomainForLink) {
        setSelectedDomain(selectedDomainForLink);
        setShowSetupDialog(true);
      }
      setSelectedDomainForLink(null);
      setSelectedFunnelId('');
      toast({ title: 'Funnel linked! Follow the DNS setup instructions.' });
    },
  });

  const handleContinue = () => {
    if (!newDomain.trim()) {
      toast({ title: 'Please enter a domain', variant: 'destructive' });
      return;
    }
    
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const cleanDomain = newDomain.replace(/^www\./, '').toLowerCase().trim();
    if (!domainRegex.test(cleanDomain)) {
      toast({ title: 'Please enter a valid domain', variant: 'destructive' });
      return;
    }

    addDomainMutation.mutate(cleanDomain);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  const getFunnelForDomain = (domainId: string) => {
    return funnels.find(f => f.domain_id === domainId);
  };

  const workerScript = `// Cloudflare Worker - Deploy this once on ${HOSTING_DOMAIN}
// Go to Workers & Pages in Cloudflare dashboard

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const domain = url.hostname;
    
    // Call the serve-funnel edge function
    const response = await fetch(
      'https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/serve-funnel',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      }
    );
    
    const html = await response.text();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
};`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Domains</h1>
          <p className="text-muted-foreground mt-1">
            Connect custom domains to your funnels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowHostingSetupDialog(true)}
          >
            <Server className="h-4 w-4 mr-2" />
            Hosting Setup
          </Button>
          <Button onClick={() => setShowConnectDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Server className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-400">Custom Domain Hosting via {HOSTING_DOMAIN}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your custom domains CNAME to {HOSTING_DOMAIN}, which serves your funnels automatically.
              Click "Hosting Setup" to configure the one-time Cloudflare Worker.
            </p>
          </div>
        </div>
      </div>

      {/* Domain List */}
      {domainsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading domains...</div>
      ) : domains.length > 0 ? (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="divide-y">
            {domains.map((domain) => {
              const linkedFunnel = getFunnelForDomain(domain.id);
              return (
                <div key={domain.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Globe className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        <Badge 
                          variant="outline"
                          className="text-xs border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Ready
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {linkedFunnel ? (
                          <p className="text-sm text-muted-foreground">
                            <ArrowRight className="h-3 w-3 inline mr-1" />
                            Serves <span className="font-medium">{linkedFunnel.name}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-amber-600">
                            Not linked to any funnel
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedDomainForLink(domain);
                        setSelectedFunnelId(linkedFunnel?.id || '');
                        setShowLinkDialog(true);
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-1.5" />
                      {linkedFunnel ? 'Change' : 'Link Funnel'}
                    </Button>
                    {linkedFunnel && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDomain(domain);
                          setShowSetupDialog(true);
                        }}
                      >
                        DNS Setup
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteDomainMutation.mutate(domain.id)} 
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl bg-card">
          <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No domains connected</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect a custom domain to publish your funnels on your own branded URLs
          </p>
          <Button onClick={() => setShowConnectDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      )}

      {/* Add Domain Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Globe className="h-5 w-5 text-emerald-500" />
              </div>
              <DialogTitle>Add your domain</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Domain URL</label>
              <Input
                placeholder="yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleContinue} 
              disabled={addDomainMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {addDomainMutation.isPending ? 'Adding...' : 'Continue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Funnel Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Link2 className="h-5 w-5 text-emerald-500" />
              </div>
              <DialogTitle>Link Funnel to Domain</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Select which funnel to show on <span className="font-medium text-foreground">{selectedDomainForLink?.domain}</span>
              </p>
              <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a funnel" />
                </SelectTrigger>
                <SelectContent>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedDomainForLink && selectedFunnelId) {
                  linkFunnelMutation.mutate({ 
                    funnelId: selectedFunnelId, 
                    domainId: selectedDomainForLink.id 
                  });
                }
              }}
              disabled={!selectedFunnelId || linkFunnelMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {linkFunnelMutation.isPending ? 'Linking...' : 'Link Funnel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DNS Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>DNS Setup for {selectedDomain?.domain}</DialogTitle>
            <DialogDescription>
              Point your domain to {HOSTING_DOMAIN} to serve your funnel
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">1</div>
                <h4 className="font-medium">Add CNAME Record</h4>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  In your domain's DNS settings, add this CNAME record:
                </p>
                <div className="bg-muted rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-mono">CNAME</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">@</span>
                      <span className="text-xs text-muted-foreground">(or your subdomain)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Target:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{HOSTING_DOMAIN}</span>
                      <button onClick={() => copyToClipboard(HOSTING_DOMAIN)} className="hover:text-foreground text-muted-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-600">
                  Note: If your registrar doesn't support CNAME on root domain, use an ALIAS or ANAME record, or add a subdomain like "go.{selectedDomain?.domain}"
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">2</div>
                <h4 className="font-medium">Enable Cloudflare Proxy (if using Cloudflare)</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                Make sure the orange cloud (Proxied) is enabled so Cloudflare handles SSL.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">3</div>
                <h4 className="font-medium">Wait for propagation</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                DNS changes can take up to 24 hours. Once propagated, your funnel will be live at <strong>https://{selectedDomain?.domain}</strong>
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => window.open(`https://${selectedDomain?.domain}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Test Domain
            </Button>
            <Button onClick={() => setShowSetupDialog(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-Time Hosting Setup Dialog */}
      <Dialog open={showHostingSetupDialog} onOpenChange={setShowHostingSetupDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>One-Time Hosting Setup for {HOSTING_DOMAIN}</DialogTitle>
            <DialogDescription>
              Set this up once to enable custom domain hosting for all your funnels
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-sm text-amber-600">
                <strong>You only need to do this once.</strong> After setup, all custom domains that CNAME to {HOSTING_DOMAIN} will automatically serve the linked funnel.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">1</div>
                <h4 className="font-medium">Go to Cloudflare Dashboard</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                Open <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">dash.cloudflare.com</a> → Select {HOSTING_DOMAIN} → Workers & Pages
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">2</div>
                <h4 className="font-medium">Create a new Worker</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                Click "Create" → "Create Worker" → Name it "funnel-proxy" → Click "Deploy"
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">3</div>
                <h4 className="font-medium">Replace the worker code</h4>
              </div>
              <div className="ml-8">
                <p className="text-sm text-muted-foreground mb-2">
                  Click "Edit Code", delete everything, and paste this:
                </p>
                <div className="relative">
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto font-mono">
                    {workerScript}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(workerScript)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Save and Deploy"
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">4</div>
                <h4 className="font-medium">Add a Route (catch-all)</h4>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Go to "Triggers" tab → "Add route" with:
                </p>
                <div className="bg-muted rounded-md p-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Route:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">*/*</span>
                      <button onClick={() => copyToClipboard('*/*')} className="hover:text-foreground text-muted-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Zone:</span>
                    <span className="font-mono">{HOSTING_DOMAIN}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This catches all requests to any domain pointing to {HOSTING_DOMAIN}
                </p>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-emerald-600 mb-2">That's it!</p>
              <p className="text-sm text-muted-foreground">
                Now any domain that CNAMEs to <strong>{HOSTING_DOMAIN}</strong> will automatically serve the linked funnel. Just add domains above and follow the DNS setup.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowHostingSetupDialog(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
