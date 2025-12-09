import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Globe, Plus, Copy, CheckCircle, AlertCircle, 
  ExternalLink, Trash2, RefreshCw, Link2, Shield, ShieldCheck,
  Activity, Wifi, WifiOff, Clock
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
  ssl_status?: string;
  health_status?: string;
  last_health_check?: string | null;
  created_at: string;
}

interface DNSCheckResult {
  verified: boolean;
  ssl_status: string;
  dns_results: {
    aRecordValid: boolean;
    txtRecordValid: boolean;
    cnameValid: boolean;
    aRecordValue: string | null;
    txtRecordValue: string | null;
    cnameValue: string | null;
  };
  requirements?: {
    a_record: { required: string; found: string | null; valid: boolean };
    txt_record: { required: string; found: string | null; valid: boolean };
  };
}

interface Funnel {
  id: string;
  name: string;
  domain_id: string | null;
}

interface DomainsSectionProps {
  teamId: string;
}

export function DomainsSection({ teamId }: DomainsSectionProps) {
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showDNSDialog, setShowDNSDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addWww, setAddWww] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<Domain | null>(null);
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
        .select('id, name, domain_id')
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
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
      setCurrentDomain(data);
      setShowConnectDialog(false);
      setShowDNSDialog(true);
      setNewDomain('');
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
      queryClient.invalidateQueries({ queryKey: ['funnel'] }); // Refresh funnel editor data
      setShowLinkDialog(false);
      setSelectedDomainForLink(null);
      setSelectedFunnelId('');
      toast({ title: 'Funnel linked to domain', description: 'Your funnel will now be accessible at the custom domain.' });
    },
  });

  // Verify domain mutation - calls edge function to check real DNS records
  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: Domain): Promise<DNSCheckResult> => {
      const { data, error } = await supabase.functions.invoke('verify-domain', {
        body: {
          domainId: domain.id,
          domain: domain.domain,
          verificationToken: domain.verification_token,
        },
      });
      
      if (error) throw error;
      return data as DNSCheckResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
      setIsVerifying(false);
      
      if (data.verified) {
        setShowDNSDialog(false);
        toast({ 
          title: 'Domain verified!', 
          description: `SSL certificate provisioned. Now link a funnel to your domain.` 
        });
        // Auto-open the link funnel dialog after verification
        if (currentDomain) {
          setSelectedDomainForLink(currentDomain);
          setSelectedFunnelId('');
          setShowLinkDialog(true);
        }
        setCurrentDomain(null);
      } else {
        // Show which records are missing
        const missing: string[] = [];
        if (!data.dns_results.aRecordValid) missing.push('A record');
        if (!data.dns_results.txtRecordValid) missing.push('TXT record');
        
        toast({ 
          title: 'DNS records not configured', 
          description: `Missing or incorrect: ${missing.join(', ')}. Changes may take up to 48 hours to propagate.`,
          variant: 'destructive'
        });
      }
    },
    onError: (error: Error) => {
      setIsVerifying(false);
      toast({ 
        title: 'Verification failed', 
        description: error.message || 'DNS changes may take up to 48 hours to propagate',
        variant: 'destructive'
      });
    },
  });

  const handleContinue = () => {
    if (!newDomain.trim()) {
      toast({ title: 'Please enter a domain', variant: 'destructive' });
      return;
    }
    
    // Updated regex to support subdomains (e.g., signup.mydomain.com, promo.site.co.uk)
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const cleanDomain = newDomain.replace(/^www\./, '').toLowerCase().trim();
    if (!domainRegex.test(cleanDomain)) {
      toast({ title: 'Please enter a valid domain or subdomain', variant: 'destructive' });
      return;
    }

    addDomainMutation.mutate(cleanDomain);
  };

  // Check domain health
  const checkHealthMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-domain-health', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
      toast({ title: 'Health check complete' });
    },
    onError: (error: Error) => {
      toast({ title: 'Health check failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleVerifyRecords = () => {
    if (!currentDomain) return;
    setIsVerifying(true);
    verifyDomainMutation.mutate(currentDomain);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const getFunnelForDomain = (domainId: string) => {
    return funnels.find(f => f.domain_id === domainId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Domains</h1>
          <p className="text-muted-foreground mt-1">
            Connect custom domains and subdomains to your funnels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => checkHealthMutation.mutate()}
            disabled={checkHealthMutation.isPending}
          >
            <Activity className={cn("h-4 w-4 mr-2", checkHealthMutation.isPending && "animate-pulse")} />
            {checkHealthMutation.isPending ? 'Checking...' : 'Check Health'}
          </Button>
          <Button onClick={() => setShowConnectDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
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
                    <div className={cn(
                      "p-2 rounded-lg",
                      domain.status === 'verified' && domain.health_status === 'healthy' ? "bg-emerald-500/10" : 
                      domain.status === 'verified' && domain.health_status === 'degraded' ? "bg-amber-500/10" :
                      domain.status === 'offline' || domain.health_status === 'offline' ? "bg-red-500/10" :
                      domain.status === 'failed' ? "bg-red-500/10" : "bg-amber-500/10"
                    )}>
                      {domain.health_status === 'offline' ? (
                        <WifiOff className="h-5 w-5 text-red-500" />
                      ) : domain.health_status === 'healthy' ? (
                        <Wifi className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Globe className={cn(
                          "h-5 w-5",
                          domain.status === 'verified' ? "text-emerald-500" : 
                          domain.status === 'failed' ? "text-red-500" : "text-amber-500"
                        )} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "text-xs",
                            domain.status === 'verified' 
                              ? "border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                              : domain.status === 'failed'
                              ? "border-red-500/50 text-red-600 bg-red-50 dark:bg-red-500/10"
                              : "border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-500/10"
                          )}
                        >
                          {domain.status === 'verified' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                          ) : domain.status === 'failed' ? (
                            <><AlertCircle className="h-3 w-3 mr-1" /> Failed</>
                          ) : (
                            <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Pending</>
                          )}
                        </Badge>
                        {/* SSL Status Badge */}
                        {domain.status === 'verified' && (
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs",
                              domain.ssl_provisioned 
                                ? "border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-500/10"
                                : "border-orange-500/50 text-orange-600 bg-orange-50 dark:bg-orange-500/10"
                            )}
                          >
                            {domain.ssl_provisioned ? (
                              <><ShieldCheck className="h-3 w-3 mr-1" /> SSL Active</>
                            ) : (
                              <><Shield className="h-3 w-3 mr-1" /> SSL Pending</>
                            )}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {linkedFunnel ? (
                          <p className="text-sm text-muted-foreground">
                            Connected to <span className="font-medium">{linkedFunnel.name}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Not connected to any funnel
                          </p>
                        )}
                        {domain.verified_at && (
                          <span className="text-xs text-muted-foreground">
                            · Verified {new Date(domain.verified_at).toLocaleDateString()}
                          </span>
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
                    {domain.status === 'verified' && (
                      <Button variant="ghost" size="sm" onClick={() => window.open(`https://${domain.domain}`, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {domain.status === 'pending' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCurrentDomain(domain);
                          setShowDNSDialog(true);
                        }}
                      >
                        View DNS
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
            Connect Domain
          </Button>
        </div>
      )}

      {/* Connect Domain Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Globe className="h-5 w-5 text-emerald-500" />
              </div>
              <DialogTitle>Connect your domain/subdomain</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                Domain or Subdomain URL <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="signup.yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Examples: yourdomain.com, signup.yourdomain.com, promo.yourdomain.com
              </p>
            </div>
            
            {/* Only show www option for root domains */}
            {newDomain && !newDomain.includes('.') || (newDomain.match(/\./g) || []).length === 1 ? (
              <div className="flex items-start gap-2">
                <Checkbox 
                  id="add-www" 
                  checked={addWww} 
                  onCheckedChange={(checked) => setAddWww(checked as boolean)}
                />
                <div>
                  <label htmlFor="add-www" className="text-sm cursor-pointer">
                    Also add www.{newDomain || 'yourdomain.com'} and redirect traffic
                  </label>
                  <p className="text-xs text-emerald-600 mt-0.5">Recommended for root domains</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end pt-4 border-t">
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

      {/* DNS Records Dialog */}
      <Dialog open={showDNSDialog} onOpenChange={setShowDNSDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set up your domain manually by adding the following records</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* A Record */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Record</p>
                <div className="px-3 py-2 bg-muted rounded-md font-mono">A</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Host</p>
                <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                  <span className="font-mono">@</span>
                  <button onClick={() => copyToClipboard('@')} className="hover:text-foreground text-muted-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Required value</p>
                <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                  <span className="font-mono text-xs">185.158.133.1</span>
                  <button onClick={() => copyToClipboard('185.158.133.1')} className="hover:text-foreground text-muted-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* CNAME Record */}
            {addWww && (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="px-3 py-2 bg-muted rounded-md font-mono">CNAME</div>
                </div>
                <div>
                  <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                    <span className="font-mono">www</span>
                    <button onClick={() => copyToClipboard('www')} className="hover:text-foreground text-muted-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                    <span className="font-mono text-xs truncate">{currentDomain?.domain || 'yourdomain.com'}</span>
                    <button onClick={() => copyToClipboard(currentDomain?.domain || '')} className="hover:text-foreground text-muted-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TXT Record */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="px-3 py-2 bg-muted rounded-md font-mono">TXT</div>
              </div>
              <div>
                <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                  <span className="font-mono">_lovable</span>
                  <button onClick={() => copyToClipboard('_lovable')} className="hover:text-foreground text-muted-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <div className="px-3 py-2 bg-muted rounded-md flex items-center justify-between">
                  <span className="font-mono text-xs truncate">lovable_verify={currentDomain?.verification_token?.slice(0, 8) || teamId?.slice(0, 8)}</span>
                  <button onClick={() => copyToClipboard(`lovable_verify=${currentDomain?.verification_token?.slice(0, 8) || teamId?.slice(0, 8)}`)} className="hover:text-foreground text-muted-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
              Watch the help video
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDNSDialog(false)}>
                Close
              </Button>
              <Button 
                onClick={handleVerifyRecords} 
                disabled={isVerifying}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify records'
                )}
              </Button>
            </div>
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
                Select a funnel to publish on <span className="font-medium text-foreground">{selectedDomainForLink?.domain}</span>
              </p>
              <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a funnel" />
                </SelectTrigger>
                <SelectContent>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.name}
                      {funnel.domain_id && funnel.domain_id !== selectedDomainForLink?.id && (
                        <span className="text-muted-foreground ml-2">(linked to another domain)</span>
                      )}
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
    </div>
  );
}
