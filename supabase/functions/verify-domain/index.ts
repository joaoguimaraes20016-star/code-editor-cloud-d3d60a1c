import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DNS targets - A records point to Caddy VPS
const VPS_IP = '143.198.103.189';

async function checkDNSRecords(domain: string): Promise<{
  rootAValid: boolean;
  rootAValue: string | null;
  wwwAValid: boolean;
  wwwAValue: string | null;
}> {
  const results = {
    rootAValid: false,
    rootAValue: null as string | null,
    wwwAValid: false,
    wwwAValue: null as string | null,
  };

  try {
    // Check A record for root domain (@)
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
          results.rootAValue = ip;
          if (ip === VPS_IP) {
            results.rootAValid = true;
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
          results.wwwAValue = ip;
          if (ip === VPS_IP) {
            results.wwwAValid = true;
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

    // BOTH root (@) AND www MUST be valid for full verification
    const isFullyVerified = dnsResults.rootAValid && dnsResults.wwwAValid;
    const isPartiallyVerified = dnsResults.rootAValid || dnsResults.wwwAValid;
    
    // Determine status
    let status = 'pending';
    if (isFullyVerified) {
      status = 'verified';
    } else if (isPartiallyVerified) {
      status = 'partial';
    }
    
    // Update database with results
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (isFullyVerified) {
      // Both records valid - domain is fully verified
      const { error: updateError } = await supabase
        .from('funnel_domains')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          ssl_provisioned: true,
          ssl_status: 'active',
          dns_a_record_valid: dnsResults.rootAValid,
          dns_www_valid: dnsResults.wwwAValid,
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
          status: 'verified',
          ssl_status: 'active',
          dnsCheck: {
            rootAValid: dnsResults.rootAValid,
            rootAValue: dnsResults.rootAValue,
            wwwAValid: dnsResults.wwwAValid,
            wwwAValue: dnsResults.wwwAValue,
          },
          message: 'Domain verified! Both @ and www records are configured correctly. SSL is active.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (isPartiallyVerified) {
      // Partial - one record valid, one missing
      const { error: updateError } = await supabase
        .from('funnel_domains')
        .update({
          status: 'partial',
          dns_a_record_valid: dnsResults.rootAValid,
          dns_www_valid: dnsResults.wwwAValid,
          last_health_check: new Date().toISOString(),
        })
        .eq('id', domainId);

      if (updateError) {
        console.error('Error updating domain status:', updateError);
      }

      const missingRecord = !dnsResults.rootAValid ? '@' : 'www';
      
      return new Response(
        JSON.stringify({
          verified: false,
          status: 'partial',
          ssl_status: 'pending',
          dnsCheck: {
            rootAValid: dnsResults.rootAValid,
            rootAValue: dnsResults.rootAValue,
            wwwAValid: dnsResults.wwwAValid,
            wwwAValue: dnsResults.wwwAValue,
          },
          message: `Almost there! Add the ${missingRecord} A record pointing to ${VPS_IP}`,
          missing: missingRecord,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Neither record valid
      return new Response(
        JSON.stringify({
          verified: false,
          status: 'pending',
          ssl_status: 'pending',
          dnsCheck: {
            rootAValid: dnsResults.rootAValid,
            rootAValue: dnsResults.rootAValue,
            wwwAValid: dnsResults.wwwAValid,
            wwwAValue: dnsResults.wwwAValue,
          },
          message: 'DNS records not yet configured. Add both A records to complete setup.',
          requirements: {
            root_a_record: {
              host: '@',
              type: 'A',
              required: VPS_IP,
              found: dnsResults.rootAValue,
              valid: dnsResults.rootAValid
            },
            www_a_record: {
              host: 'www',
              type: 'A',
              required: VPS_IP,
              found: dnsResults.wwwAValue,
              valid: dnsResults.wwwAValid
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
