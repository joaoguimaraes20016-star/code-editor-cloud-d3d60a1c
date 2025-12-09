import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Globe, Plus, Copy, CheckCircle, AlertCircle, 
  ExternalLink, Trash2, RefreshCw, X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Domain {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  createdAt: string;
  funnelId?: string;
  funnelName?: string;
}

interface DomainsSectionProps {
  teamId: string;
}

export function DomainsSection({ teamId }: DomainsSectionProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showDNSDialog, setShowDNSDialog] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addWww, setAddWww] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');

  const handleContinue = () => {
    if (!newDomain.trim()) {
      toast({ title: 'Please enter a domain', variant: 'destructive' });
      return;
    }
    
    // Basic validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.replace('www.', ''))) {
      toast({ title: 'Please enter a valid domain', variant: 'destructive' });
      return;
    }

    setCurrentDomain(newDomain);
    setShowConnectDialog(false);
    setShowDNSDialog(true);
  };

  const handleVerifyRecords = () => {
    setIsVerifying(true);
    // Simulate verification - in production this would check DNS
    setTimeout(() => {
      const newDomainEntry: Domain = {
        id: crypto.randomUUID(),
        domain: currentDomain,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setDomains(prev => [...prev, newDomainEntry]);
      setShowDNSDialog(false);
      setNewDomain('');
      setCurrentDomain('');
      setIsVerifying(false);
      toast({ 
        title: 'Domain added', 
        description: 'DNS verification is in progress. This may take up to 48 hours.' 
      });
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const removeDomain = (id: string) => {
    setDomains(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Domain removed' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Domains</h1>
          <p className="text-muted-foreground mt-1">
            Connect custom domains to your funnels for a branded experience
          </p>
        </div>
        <Button onClick={() => setShowConnectDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {/* Domain List */}
      {domains.length > 0 ? (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="divide-y">
            {domains.map((domain) => (
              <div key={domain.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    domain.status === 'verified' ? "bg-emerald-500/10" : 
                    domain.status === 'failed' ? "bg-red-500/10" : "bg-amber-500/10"
                  )}>
                    <Globe className={cn(
                      "h-5 w-5",
                      domain.status === 'verified' ? "text-emerald-500" : 
                      domain.status === 'failed' ? "text-red-500" : "text-amber-500"
                    )} />
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
                    </div>
                    {domain.funnelName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Connected to {domain.funnelName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {domain.status === 'verified' && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(`https://${domain.domain}`, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => removeDomain(domain.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
                Domain URL <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="mt-1.5"
              />
            </div>
            
            <div className="flex items-start gap-2">
              <Checkbox 
                id="add-www" 
                checked={addWww} 
                onCheckedChange={(checked) => setAddWww(checked as boolean)}
              />
              <div>
                <label htmlFor="add-www" className="text-sm cursor-pointer">
                  Also add www.{newDomain || 'yourdomain.com'} and redirect traffic to {newDomain || 'yourdomain.com'}
                </label>
                <p className="text-xs text-emerald-600 mt-0.5">Recommended</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <button 
              className="text-sm text-muted-foreground hover:text-foreground underline"
              onClick={() => {
                setShowConnectDialog(false);
                setShowDNSDialog(true);
                setCurrentDomain(newDomain);
              }}
            >
              Add record manually
            </button>
            <Button onClick={handleContinue} className="bg-emerald-600 hover:bg-emerald-700">
              Continue
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
                    <span className="font-mono text-xs truncate">{currentDomain || 'yourdomain.com'}</span>
                    <button onClick={() => copyToClipboard(currentDomain)} className="hover:text-foreground text-muted-foreground">
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
                  <span className="font-mono text-xs truncate">lovable_verify={teamId?.slice(0, 8)}</span>
                  <button onClick={() => copyToClipboard(`lovable_verify=${teamId?.slice(0, 8)}`)} className="hover:text-foreground text-muted-foreground">
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
                Back
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
    </div>
  );
}
