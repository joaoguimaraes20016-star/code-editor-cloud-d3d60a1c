import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, Plus, Copy, CheckCircle, ExternalLink, Trash2, Link2, ArrowRight, 
  AlertCircle, Loader2, XCircle, Clock, RefreshCw, ShieldCheck
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
  ssl_status: string | null;
  health_status: string | null;
  dns_a_record_valid: boolean | null;
  dns_txt_record_valid: boolean | null;
  cloudflare_hostname_id: string | null;
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

interface VerificationResult {
  verified: boolean;
  aRecordValid: boolean;
  cnameValid?: boolean;
  wwwCnameValid?: boolean;
  wwwARecordValid?: boolean;
  message?: string;
  path?: 'vps' | 'cloudflare';
}

// DNS targets
const VPS_IP = '159.223.210.203';        // Caddy VPS path (A record)
const CNAME_TARGET = 'grwthop.com';      // Cloudflare Worker path (CNAME)

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  pending: {
    label: 'Pending DNS',
    color: 'border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    icon: <Clock className="h-3 w-3 mr-1" />,
    description: 'Configure your DNS settings'
  },
  verifying: {
    label: 'Verifying',
    color: 'border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
    description: 'Checking DNS records...'
  },
  verified: {
    label: 'Active',
    color: 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    description: 'Domain is live and serving your funnel'
  },
  active: {
    label: 'Active',
    color: 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    description: 'Domain is live and serving your funnel'
  },
  offline: {
    label: 'Offline',
    color: 'border-red-500/50 text-red-600 bg-red-50 dark:bg-red-500/10',
    icon: <XCircle className="h-3 w-3 mr-1" />,
    description: 'DNS issues detected'
  },
  failed: {
    label: 'Failed',
    color: 'border-red-500/50 text-red-600 bg-red-50 dark:bg-red-500/10',
    icon: <AlertCircle className="h-3 w-3 mr-1" />,
    description: 'Verification failed'
  }
};

export function DomainsSection({ teamId }: DomainsSectionProps) {
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [selectedDomainForLink, setSelectedDomainForLink] = useState<Domain | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [dnsCheckResult, setDnsCheckResult] = useState<VerificationResult | null>(null);

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

  // Add domain mutation - simplified without Cloudflare
  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const cleanDomain = domain.toLowerCase().trim();
      
      const { data, error } = await supabase
        .from('funnel_domains')
        .insert({
          team_id: teamId,
          domain: cleanDomain,
          status: 'pending',
          ssl_provisioned: false,
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
    mutationFn: async (domain: Domain) => {
      const { error } = await supabase
        .from('funnel_domains')
        .delete()
        .eq('id', domain.id);
      
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

  // Verify domain via edge function
  const verifyDomain = useCallback(async (domain: Domain) => {
    setVerifyingDomainId(domain.id);
    setDnsCheckResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-domain', {
        body: {
          domainId: domain.id,
          domain: domain.domain,
        }
      });

      if (error) throw error;

      setDnsCheckResult({
        verified: data.verified,
        aRecordValid: data.dnsCheck?.aRecordValid || false,
        cnameValid: data.dnsCheck?.cnameValid || false,
        wwwCnameValid: data.dnsCheck?.wwwCnameValid || false,
        wwwARecordValid: data.dnsCheck?.wwwARecordValid || false,
        message: data.message,
        path: data.path
      });

      // Refresh domains list
      queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });

      if (data.verified) {
        toast({ title: 'Domain verified and active!' });
      } else {
        toast({ 
          title: 'DNS not ready yet', 
          description: `Add an A record pointing to ${VPS_IP} or CNAME to ${CNAME_TARGET}`,
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast({ 
        title: 'Verification failed', 
        description: 'Could not check domain status. Please try again.',
        variant: 'destructive' 
      });
    } finally {
      setVerifyingDomainId(null);
    }
  }, [queryClient, teamId]);

  // Auto-poll for pending domains when setup dialog is open
  useEffect(() => {
    if (!showSetupDialog || !selectedDomain) return;
    if (selectedDomain.status === 'verified') return;

    const pollInterval = setInterval(async () => {
      // Verify domain
      const { data } = await supabase.functions.invoke('verify-domain', {
        body: {
          domainId: selectedDomain.id,
          domain: selectedDomain.domain,
        }
      });

      if (data?.verified) {
        // Re-fetch domain from DB
        const { data: domainData } = await supabase
          .from('funnel_domains')
          .select('*')
          .eq('id', selectedDomain.id)
          .single();

        if (domainData) {
          setSelectedDomain(domainData as Domain);
          queryClient.invalidateQueries({ queryKey: ['funnel-domains', teamId] });
          toast({ title: 'Domain is now active!' });
        }
      }
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(pollInterval);
  }, [showSetupDialog, selectedDomain, queryClient, teamId]);

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

  const getStatusConfig = (domain: Domain) => {
    let effectiveStatus = domain.status || 'pending';
    
    if (domain.status === 'verified' && domain.ssl_provisioned) {
      effectiveStatus = 'active';
    }
    
    if (domain.health_status === 'offline' && domain.verified_at) {
      effectiveStatus = 'offline';
    }

    return STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
  };

  const isVerifying = (domainId: string) => verifyingDomainId === domainId;

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
        <Button onClick={() => setShowConnectDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {/* Domain List */}
      {domainsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading domains...</div>
      ) : domains.length > 0 ? (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="divide-y">
            {domains.map((domain) => {
              const linkedFunnel = getFunnelForDomain(domain.id);
              const statusConfig = getStatusConfig(domain);
              const isPending = domain.status === 'pending';
              const isActive = domain.status === 'verified' && domain.ssl_provisioned;
              const isOffline = domain.health_status === 'offline';

              return (
                <div key={domain.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-500/10' : isPending ? 'bg-amber-500/10' : isOffline ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                      <Globe className={`h-5 w-5 ${isActive ? 'text-emerald-500' : isPending ? 'text-amber-500' : isOffline ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${statusConfig.color}`}
                        >
                          {isVerifying(domain.id) ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </>
                          )}
                        </Badge>
                        {isActive && (
                          <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            SSL
                          </Badge>
                        )}
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
                        {isPending && (
                          <span className="text-xs text-muted-foreground">
                            • {statusConfig.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Verify DNS button for pending/offline domains */}
                    {(isPending || isOffline) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => verifyDomain(domain)}
                        disabled={isVerifying(domain.id)}
                      >
                        {isVerifying(domain.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Verify DNS
                          </>
                        )}
                      </Button>
                    )}
                    
                    {/* Link funnel button */}
                    {!linkedFunnel && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDomainForLink(domain);
                          setSelectedFunnelId('');
                          setShowLinkDialog(true);
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Link Funnel
                      </Button>
                    )}

                    {/* DNS Setup button */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedDomain(domain);
                        setDnsCheckResult(null);
                        setShowSetupDialog(true);
                      }}
                    >
                      DNS Setup
                    </Button>

                    {/* Test link for active domains */}
                    {isActive && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Delete button */}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this domain?')) {
                          deleteDomainMutation.mutate(domain);
                        }
                      }}
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
        <div className="text-center py-12 bg-card border rounded-xl">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-lg mb-2">No domains connected</h3>
          <p className="text-muted-foreground mb-4">
            Add a custom domain to serve your funnels on your own URL
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
              Point your domain to our server with an A record
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Current Status */}
            {selectedDomain && (
              <div className={`rounded-lg p-4 ${
                getStatusConfig(selectedDomain).label === 'Active' 
                  ? 'bg-emerald-500/10 border border-emerald-500/20' 
                  : getStatusConfig(selectedDomain).label === 'Offline'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusConfig(selectedDomain).label === 'Active' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : getStatusConfig(selectedDomain).label === 'Offline' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {getStatusConfig(selectedDomain).label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {getStatusConfig(selectedDomain).description}
                      </p>
                    </div>
                  </div>
                  {selectedDomain.status === 'pending' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => verifyDomain(selectedDomain)}
                      disabled={isVerifying(selectedDomain.id)}
                    >
                      {isVerifying(selectedDomain.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* DNS Check Results */}
                {dnsCheckResult && (
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {dnsCheckResult.aRecordValid ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>A Record @ → {VPS_IP}</span>
                    </div>
                    {dnsCheckResult.cnameValid !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        {dnsCheckResult.cnameValid ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>CNAME @ → {CNAME_TARGET} (alternative)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      {(dnsCheckResult.wwwCnameValid || dnsCheckResult.wwwARecordValid) ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>www → {dnsCheckResult.wwwCnameValid ? CNAME_TARGET : VPS_IP}</span>
                    </div>
                    {dnsCheckResult.verified && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span>SSL Certificate (Auto)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">1</div>
                <h4 className="font-medium">Go to your DNS provider</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                Log in to where you registered your domain (Cloudflare, GoDaddy, Namecheap, etc.)
              </p>
            </div>

            {/* Step 2 - DNS Records Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">2</div>
                <h4 className="font-medium">Add DNS Records</h4>
              </div>
              
              {/* DNS Records Table */}
              <div className="ml-8 bg-muted rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted-foreground/10">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Name/Host</th>
                      <th className="text-left px-4 py-2 font-medium">Value/Points To</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Root domain A record */}
                    <tr className="border-t border-muted-foreground/10">
                      <td className="px-4 py-3">
                        <Badge variant="outline">A</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">@</td>
                      <td className="px-4 py-3 font-mono text-xs">{VPS_IP}</td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(VPS_IP)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                    {/* www subdomain CNAME record */}
                    <tr className="border-t border-muted-foreground/10">
                      <td className="px-4 py-3">
                        <Badge variant="outline">CNAME</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">www</td>
                      <td className="px-4 py-3 font-mono text-xs">{CNAME_TARGET}</td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(CNAME_TARGET)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="ml-8 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <strong>Root domain (@):</strong> A record pointing to {VPS_IP}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>www subdomain:</strong> CNAME pointing to {CNAME_TARGET} (or A record to {VPS_IP})
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">3</div>
                <h4 className="font-medium">Wait for DNS propagation</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-8">
                DNS changes can take up to 24-48 hours to propagate worldwide. We'll automatically check and provision SSL once ready.
              </p>
            </div>

            {/* Verify Button */}
            {selectedDomain && selectedDomain.status === 'pending' && (
              <div className="pt-4 border-t">
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => verifyDomain(selectedDomain)}
                  disabled={isVerifying(selectedDomain.id)}
                >
                  {isVerifying(selectedDomain.id) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking DNS...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verify DNS Configuration
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
