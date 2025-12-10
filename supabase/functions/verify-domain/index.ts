import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Two valid paths for custom domains
const VPS_IP = '143.198.103.189';        // Caddy VPS path (A record)
const CNAME_TARGET = 'grwthop.com';      // Cloudflare Worker path (CNAME)

async function checkDNSRecords(domain: string): Promise<{
  aRecordValid: boolean;
  aRecordValue: string | null;
  cnameValid: boolean;
  cnameValue: string | null;
  wwwARecordValid: boolean;
  wwwARecordValue: string | null;
  wwwCnameValid: boolean;
  wwwCnameValue: string | null;
}> {
  const results = {
    aRecordValid: false,
    aRecordValue: null as string | null,
    cnameValid: false,
    cnameValue: null as string | null,
    wwwARecordValid: false,
    wwwARecordValue: null as string | null,
    wwwCnameValid: false,
    wwwCnameValue: null as string | null,
  };

  try {
    // Check A record for root domain
    const rootAResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (rootAResponse.ok) {
      const rootAData = await rootAResponse.json();
      console.log(`A record response for ${domain}:`, JSON.stringify(rootAData));
      
      if (rootAData.Answer && rootAData.Answer.length > 0) {
        const aRecords = rootAData.Answer.filter((r: any) => r.type === 1); // Type 1 = A record
        for (const record of aRecords) {
          const ip = record.data;
          results.aRecordValue = ip;
          if (ip === VPS_IP) {
            results.aRecordValid = true;
            break;
          }
        }
      }
    }

    // Check CNAME record for root domain (usually won't exist for apex, but check anyway)
    const rootCnameResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=CNAME`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (rootCnameResponse.ok) {
      const rootCnameData = await rootCnameResponse.json();
      console.log(`CNAME record response for ${domain}:`, JSON.stringify(rootCnameData));
      
      if (rootCnameData.Answer && rootCnameData.Answer.length > 0) {
        const cnameRecords = rootCnameData.Answer.filter((r: any) => r.type === 5); // Type 5 = CNAME
        for (const record of cnameRecords) {
          const target = record.data.replace(/\.$/, ''); // Remove trailing dot
          results.cnameValue = target;
          if (target === CNAME_TARGET || target.endsWith('.' + CNAME_TARGET)) {
            results.cnameValid = true;
            break;
          }
        }
      }
    }

    // Check A record for www subdomain
    const wwwAResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=www.${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (wwwAResponse.ok) {
      const wwwAData = await wwwAResponse.json();
      console.log(`A record response for www.${domain}:`, JSON.stringify(wwwAData));
      
      if (wwwAData.Answer && wwwAData.Answer.length > 0) {
        const aRecords = wwwAData.Answer.filter((r: any) => r.type === 1);
        for (const record of aRecords) {
          const ip = record.data;
          results.wwwARecordValue = ip;
          if (ip === VPS_IP) {
            results.wwwARecordValid = true;
            break;
          }
        }
      }
    }

    // Check CNAME record for www subdomain
    const wwwCnameResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=www.${domain}&type=CNAME`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (wwwCnameResponse.ok) {
      const wwwCnameData = await wwwCnameResponse.json();
      console.log(`CNAME record response for www.${domain}:`, JSON.stringify(wwwCnameData));
      
      if (wwwCnameData.Answer && wwwCnameData.Answer.length > 0) {
        const cnameRecords = wwwCnameData.Answer.filter((r: any) => r.type === 5);
        for (const record of cnameRecords) {
          const target = record.data.replace(/\.$/, '');
          results.wwwCnameValue = target;
          if (target === CNAME_TARGET || target.endsWith('.' + CNAME_TARGET)) {
            results.wwwCnameValid = true;
            break;
          }
        }
      }
    }

  } catch (error) {
    console.error('DNS lookup error:', error);
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domainId, domain } = await req.json();
    
    if (!domainId || !domain) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying domain: ${domain}`);

    // Check DNS records
    const dnsResults = await checkDNSRecords(domain);
    
    console.log('DNS check results:', JSON.stringify(dnsResults));

    // Domain is verified if:
    // - Root A record points to VPS IP, OR
    // - Root CNAME points to grwthop.com (for subdomains that can use CNAME)
    const isVerified = dnsResults.aRecordValid || dnsResults.cnameValid;
    
    // www is valid if CNAME to grwthop.com OR A record to VPS IP
    const wwwValid = dnsResults.wwwCnameValid || dnsResults.wwwARecordValid;
    
    // Update database with results
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (isVerified) {
      // Domain is verified - update status
      const { error: updateError } = await supabase
        .from('funnel_domains')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          ssl_provisioned: true,
          ssl_status: 'active',
          dns_a_record_valid: dnsResults.aRecordValid || dnsResults.cnameValid,
          dns_txt_record_valid: wwwValid,
          health_status: 'healthy',
          last_health_check: new Date().toISOString(),
        })
        .eq('id', domainId);

      if (updateError) {
        console.error('Error updating domain status:', updateError);
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          verified: true,
          ssl_status: 'active',
          dnsCheck: {
            aRecordValid: dnsResults.aRecordValid,
            aRecordValue: dnsResults.aRecordValue,
            cnameValid: dnsResults.cnameValid,
            cnameValue: dnsResults.cnameValue,
            wwwARecordValid: dnsResults.wwwARecordValid,
            wwwARecordValue: dnsResults.wwwARecordValue,
            wwwCnameValid: dnsResults.wwwCnameValid,
            wwwCnameValue: dnsResults.wwwCnameValue,
            wwwValid,
          },
          message: 'Domain verified successfully! SSL is active.',
          path: dnsResults.aRecordValid ? 'vps' : 'cloudflare'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Not verified yet - return current status
      return new Response(
        JSON.stringify({
          verified: false,
          ssl_status: 'pending',
          dnsCheck: {
            aRecordValid: dnsResults.aRecordValid,
            aRecordValue: dnsResults.aRecordValue,
            cnameValid: dnsResults.cnameValid,
            cnameValue: dnsResults.cnameValue,
            wwwARecordValid: dnsResults.wwwARecordValid,
            wwwARecordValue: dnsResults.wwwARecordValue,
            wwwCnameValid: dnsResults.wwwCnameValid,
            wwwCnameValue: dnsResults.wwwCnameValue,
            wwwValid,
          },
          message: 'DNS records not yet configured correctly',
          requirements: {
            a_record: {
              host: '@',
              type: 'A',
              required: VPS_IP,
              found: dnsResults.aRecordValue,
              valid: dnsResults.aRecordValid
            },
            cname_record: {
              host: '@',
              type: 'CNAME',
              required: CNAME_TARGET,
              found: dnsResults.cnameValue,
              valid: dnsResults.cnameValid,
              note: 'Alternative to A record (for subdomains)'
            },
            www_cname: {
              host: 'www',
              type: 'CNAME',
              required: CNAME_TARGET,
              found: dnsResults.wwwCnameValue,
              valid: dnsResults.wwwCnameValid,
              note: 'Recommended for www subdomain'
            },
            www_a_record: {
              host: 'www',
              type: 'A',
              required: VPS_IP,
              found: dnsResults.wwwARecordValue,
              valid: dnsResults.wwwARecordValid,
              note: 'Alternative to CNAME for www'
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Verification failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
