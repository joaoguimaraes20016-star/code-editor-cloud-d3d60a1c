import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, CheckCircle, XCircle, Clock, Loader2, Globe, 
  ShieldCheck, Wifi, Server, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DNSServerResult {
  name: string;
  propagated: boolean;
  ip: string | null;
  error?: string;
}

interface HealthCheckResult {
  dns: {
    aRecordValid: boolean;
    aRecordValue: string | null;
    cnameValid: boolean;
    cnameValue: string | null;
    wwwARecordValid: boolean;
    wwwARecordValue: string | null;
    wwwCnameValid: boolean;
    wwwCnameValue: string | null;
    propagation: {
      checked: number;
      propagated: number;
      servers: DNSServerResult[];
    };
  };
  http: {
    reachable: boolean;
    statusCode: number | null;
    responseTime: number | null;
    error?: string;
  };
  https: {
    reachable: boolean;
    statusCode: number | null;
    responseTime: number | null;
    error?: string;
  };
  ssl: {
    valid: boolean;
    issuer?: string;
    expiresAt?: string;
    daysUntilExpiry?: number;
    error?: string;
  };
  overall: 'healthy' | 'degraded' | 'offline' | 'pending';
}

interface DomainHealthPanelProps {
  domain: string;
  domainId: string;
  onHealthCheckComplete?: (result: HealthCheckResult) => void;
}

const VPS_IP = '143.198.103.189';

export function DomainHealthPanel({ domain, domainId, onHealthCheckComplete }: DomainHealthPanelProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-domain-live', {
        body: { domain, domainId }
      });

      if (error) throw error;

      setHealthResult(data);
      setLastChecked(new Date());
      setIsExpanded(true);
      onHealthCheckComplete?.(data);

      if (data.overall === 'healthy') {
        toast({ title: 'Domain is healthy!' });
      } else if (data.overall === 'degraded') {
        toast({ title: 'Domain has some issues', description: 'Check the details below' });
      } else if (data.overall === 'pending') {
        toast({ title: 'DNS not configured yet', variant: 'destructive' });
      } else {
        toast({ title: 'Domain is offline', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Health check failed:', err);
      toast({ title: 'Health check failed', variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  const getOverallColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-500 bg-emerald-500/10';
      case 'degraded': return 'text-amber-500 bg-amber-500/10';
      case 'offline': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getOverallIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'offline': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Check Health Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={runHealthCheck}
          disabled={isChecking}
          className="flex-1"
        >
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 mr-2" />
              Check Health
            </>
          )}
        </Button>
        
        {healthResult && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Health Result Summary */}
      {healthResult && (
        <div className={`rounded-lg p-3 ${getOverallColor(healthResult.overall)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getOverallIcon(healthResult.overall)}
              <span className="font-medium capitalize">{healthResult.overall}</span>
            </div>
            {lastChecked && (
              <span className="text-xs opacity-70">
                Checked {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {healthResult && isExpanded && (
        <div className="space-y-3 bg-muted/50 rounded-lg p-4 text-sm">
          {/* DNS Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Globe className="h-4 w-4" />
              DNS Records
            </div>
            <div className="ml-6 space-y-1.5">
              <div className="flex items-center gap-2">
                {healthResult.dns.aRecordValid ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span>A Record: {healthResult.dns.aRecordValue || 'Not set'}</span>
                {healthResult.dns.aRecordValid && (
                  <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-600">
                    ✓ Points to {VPS_IP}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {healthResult.dns.wwwARecordValid || healthResult.dns.wwwCnameValid ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>www: {healthResult.dns.wwwARecordValue || healthResult.dns.wwwCnameValue || 'Not set'}</span>
              </div>
            </div>
          </div>

          {/* DNS Propagation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Server className="h-4 w-4" />
              DNS Propagation
            </div>
            <div className="ml-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ 
                      width: `${(healthResult.dns.propagation.propagated / healthResult.dns.propagation.checked) * 100}%` 
                    }}
                  />
                </div>
                <span className="text-xs">
                  {healthResult.dns.propagation.propagated}/{healthResult.dns.propagation.checked}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {healthResult.dns.propagation.servers.map((server) => (
                  <Badge 
                    key={server.name}
                    variant="outline"
                    className={server.propagated 
                      ? 'text-emerald-600 border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10' 
                      : 'text-muted-foreground border-muted-foreground/30'
                    }
                  >
                    {server.propagated ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                    {server.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* HTTP/HTTPS Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Wifi className="h-4 w-4" />
              Connectivity
            </div>
            <div className="ml-6 space-y-1.5">
              <div className="flex items-center gap-2">
                {healthResult.http.reachable ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span>HTTP: {healthResult.http.reachable ? `${healthResult.http.statusCode} (${healthResult.http.responseTime}ms)` : (healthResult.http.error || 'Unreachable')}</span>
              </div>
              <div className="flex items-center gap-2">
                {healthResult.https.reachable ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span>HTTPS: {healthResult.https.reachable ? `${healthResult.https.statusCode} (${healthResult.https.responseTime}ms)` : (healthResult.https.error || 'Unreachable')}</span>
              </div>
            </div>
          </div>

          {/* SSL Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              SSL Certificate
            </div>
            <div className="ml-6">
              {healthResult.ssl.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Valid • {healthResult.ssl.issuer}</span>
                  {healthResult.ssl.daysUntilExpiry && healthResult.ssl.daysUntilExpiry < 30 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                      Expires in {healthResult.ssl.daysUntilExpiry} days
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span>{healthResult.ssl.error || 'Not valid'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
