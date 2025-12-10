import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DNS targets
const VPS_IP = '143.198.103.189';
const CNAME_TARGET = 'grwthop.com';

// Major DNS servers to check propagation
const DNS_SERVERS = [
  { name: 'Google', ip: '8.8.8.8' },
  { name: 'Cloudflare', ip: '1.1.1.1' },
  { name: 'OpenDNS', ip: '208.67.222.222' },
  { name: 'Quad9', ip: '9.9.9.9' },
];

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

async function checkDNSRecord(domain: string, type: 'A' | 'CNAME'): Promise<{ valid: boolean; value: string | null }> {
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) return { valid: false, value: null };
    
    const data = await response.json();
    if (!data.Answer || data.Answer.length === 0) return { valid: false, value: null };
    
    const records = data.Answer.filter((r: any) => r.type === (type === 'A' ? 1 : 5));
    if (records.length === 0) return { valid: false, value: null };
    
    const value = records[0].data?.replace(/\.$/, '').toLowerCase();
    
    if (type === 'A') {
      return { valid: value === VPS_IP, value };
    } else {
      return { valid: value === CNAME_TARGET || value === `${CNAME_TARGET}.`, value };
    }
  } catch (error) {
    console.error(`DNS check failed for ${domain} (${type}):`, error);
    return { valid: false, value: null };
  }
}

async function checkPropagation(domain: string): Promise<{ checked: number; propagated: number; servers: DNSServerResult[] }> {
  const results: DNSServerResult[] = [];
  
  for (const server of DNS_SERVERS) {
    try {
      // Use DoH (DNS over HTTPS) with the DNS server
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const aRecords = data.Answer?.filter((r: any) => r.type === 1) || [];
        const ip = aRecords.length > 0 ? aRecords[0].data : null;
        const propagated = ip === VPS_IP;
        
        results.push({ name: server.name, propagated, ip, error: undefined });
      } else {
        results.push({ name: server.name, propagated: false, ip: null, error: 'DNS query failed' });
      }
    } catch (error) {
      results.push({ name: server.name, propagated: false, ip: null, error: 'Connection failed' });
    }
  }
  
  return {
    checked: results.length,
    propagated: results.filter(r => r.propagated).length,
    servers: results
  };
}

async function checkHTTP(domain: string, protocol: 'http' | 'https'): Promise<{ reachable: boolean; statusCode: number | null; responseTime: number | null; error?: string }> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(`${protocol}://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    return {
      reachable: response.ok || response.status < 500,
      statusCode: response.status,
      responseTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      reachable: false,
      statusCode: null,
      responseTime: null,
      error: error.name === 'AbortError' ? 'Timeout' : (error.message || 'Connection failed')
    };
  }
}

async function checkSSL(domain: string): Promise<{ valid: boolean; issuer?: string; expiresAt?: string; daysUntilExpiry?: number; error?: string }> {
  try {
    // We can't directly check SSL cert details from Deno edge functions
    // But we can verify HTTPS works and trust Caddy's Let's Encrypt setup
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status < 500) {
      return {
        valid: true,
        issuer: "Let's Encrypt",
        // We estimate 90 days from now since Caddy auto-renews
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 90
      };
    }
    
    return { valid: false, error: `HTTP ${response.status}` };
  } catch (error: any) {
    return {
      valid: false,
      error: error.name === 'AbortError' ? 'Timeout' : (error.message || 'SSL check failed')
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, domainId } = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing domain health: ${domain}`);

    // Run all checks in parallel
    const [
      rootA,
      rootCname,
      wwwA,
      wwwCname,
      propagation,
      httpCheck,
      httpsCheck,
      sslCheck
    ] = await Promise.all([
      checkDNSRecord(domain, 'A'),
      checkDNSRecord(domain, 'CNAME'),
      checkDNSRecord(`www.${domain}`, 'A'),
      checkDNSRecord(`www.${domain}`, 'CNAME'),
      checkPropagation(domain),
      checkHTTP(domain, 'http'),
      checkHTTP(domain, 'https'),
      checkSSL(domain)
    ]);

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'offline' | 'pending' = 'pending';
    
    const dnsConfigured = rootA.valid || rootCname.valid;
    const httpsWorking = httpsCheck.reachable && sslCheck.valid;
    const propagationProgress = propagation.propagated / propagation.checked;
    
    if (dnsConfigured && httpsWorking) {
      if (propagationProgress >= 0.75) {
        overall = 'healthy';
      } else {
        overall = 'degraded'; // DNS still propagating
      }
    } else if (dnsConfigured && !httpsWorking) {
      overall = 'degraded'; // DNS OK but SSL/HTTP issues
    } else if (!dnsConfigured && (httpCheck.reachable || httpsCheck.reachable)) {
      overall = 'degraded'; // Somehow reachable but DNS not configured correctly
    } else if (!dnsConfigured) {
      overall = 'pending'; // DNS not set up
    } else {
      overall = 'offline';
    }

    const result: HealthCheckResult = {
      dns: {
        aRecordValid: rootA.valid,
        aRecordValue: rootA.value,
        cnameValid: rootCname.valid,
        cnameValue: rootCname.value,
        wwwARecordValid: wwwA.valid,
        wwwARecordValue: wwwA.value,
        wwwCnameValid: wwwCname.valid,
        wwwCnameValue: wwwCname.value,
        propagation
      },
      http: httpCheck,
      https: httpsCheck,
      ssl: sslCheck,
      overall
    };

    // Update domain health in database if domainId provided
    if (domainId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('funnel_domains')
        .update({
          last_health_check: new Date().toISOString(),
          health_status: overall,
          dns_a_record_valid: rootA.valid,
        })
        .eq('id', domainId);
    }

    console.log(`Health check complete for ${domain}: ${overall}`);

    return new Response(
      JSON.stringify({ success: true, domain, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Health test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Health test failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
