import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VPS IP where Caddy is running
const VPS_IP = '159.223.210.203';

async function checkDNSRecords(domain: string): Promise<{
  aRecordValid: boolean;
  aRecordValue: string | null;
  wwwARecordValid: boolean;
  wwwARecordValue: string | null;
}> {
  const results = {
    aRecordValid: false,
    aRecordValue: null as string | null,
    wwwARecordValid: false,
    wwwARecordValue: null as string | null,
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

    // Domain is verified if root A record points to our VPS
    const isVerified = dnsResults.aRecordValid;
    
    // Update database with results
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (isVerified) {
      // Domain is verified - update status
      // SSL is handled by Caddy automatically with on-demand TLS
      const { error: updateError } = await supabase
        .from('funnel_domains')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          ssl_provisioned: true, // Caddy handles SSL automatically
          ssl_status: 'active',
          dns_a_record_valid: dnsResults.aRecordValid,
          dns_txt_record_valid: dnsResults.wwwARecordValid, // Repurposing for www check
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
            wwwARecordValid: dnsResults.wwwARecordValid,
            wwwARecordValue: dnsResults.wwwARecordValue,
          },
          message: 'Domain verified successfully! SSL will be provisioned automatically by Caddy.'
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
            wwwARecordValid: dnsResults.wwwARecordValid,
            wwwARecordValue: dnsResults.wwwARecordValue,
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
            www_a_record: {
              host: 'www',
              type: 'A',
              required: VPS_IP,
              found: dnsResults.wwwARecordValue,
              valid: dnsResults.wwwARecordValid,
              note: 'Optional - for www subdomain support'
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
