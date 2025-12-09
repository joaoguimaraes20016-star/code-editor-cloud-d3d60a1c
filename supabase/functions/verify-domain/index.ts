import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Our expected IP for A records
const EXPECTED_IP = '185.158.133.1';

interface DNSRecord {
  type: string;
  value: string;
}

async function checkDNSRecords(domain: string, verificationToken: string): Promise<{
  aRecordValid: boolean;
  txtRecordValid: boolean;
  cnameValid: boolean;
  aRecordValue: string | null;
  txtRecordValue: string | null;
  cnameValue: string | null;
}> {
  const results = {
    aRecordValid: false,
    txtRecordValid: false,
    cnameValid: false,
    aRecordValue: null as string | null,
    txtRecordValue: null as string | null,
    cnameValue: null as string | null,
  };

  try {
    // Check A record using Cloudflare DNS API
    const aResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (aResponse.ok) {
      const aData = await aResponse.json();
      console.log(`A record response for ${domain}:`, JSON.stringify(aData));
      
      if (aData.Answer && aData.Answer.length > 0) {
        const aRecords = aData.Answer.filter((r: any) => r.type === 1);
        for (const record of aRecords) {
          results.aRecordValue = record.data;
          if (record.data === EXPECTED_IP) {
            results.aRecordValid = true;
            break;
          }
        }
      }
    }

    // Check TXT record for _lovable verification
    const txtResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=_lovable.${domain}&type=TXT`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (txtResponse.ok) {
      const txtData = await txtResponse.json();
      console.log(`TXT record response for _lovable.${domain}:`, JSON.stringify(txtData));
      
      if (txtData.Answer && txtData.Answer.length > 0) {
        const txtRecords = txtData.Answer.filter((r: any) => r.type === 16);
        for (const record of txtRecords) {
          // TXT records come with quotes
          const value = record.data?.replace(/"/g, '');
          results.txtRecordValue = value;
          if (value === `lovable_verify=${verificationToken}`) {
            results.txtRecordValid = true;
            break;
          }
        }
      }
    }

    // Check CNAME record for www
    const cnameResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=www.${domain}&type=CNAME`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (cnameResponse.ok) {
      const cnameData = await cnameResponse.json();
      console.log(`CNAME record response for www.${domain}:`, JSON.stringify(cnameData));
      
      if (cnameData.Answer && cnameData.Answer.length > 0) {
        const cnameRecords = cnameData.Answer.filter((r: any) => r.type === 5);
        for (const record of cnameRecords) {
          // Remove trailing dot from CNAME
          const value = record.data?.replace(/\.$/, '');
          results.cnameValue = value;
          if (value === domain || value === `${domain}.`) {
            results.cnameValid = true;
            break;
          }
        }
      }
      
      // Also check if www points to our IP via A record
      const wwwAResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=www.${domain}&type=A`, {
        headers: { 'Accept': 'application/dns-json' }
      });
      
      if (wwwAResponse.ok) {
        const wwwAData = await wwwAResponse.json();
        if (wwwAData.Answer && wwwAData.Answer.length > 0) {
          const aRecords = wwwAData.Answer.filter((r: any) => r.type === 1);
          for (const record of aRecords) {
            if (record.data === EXPECTED_IP) {
              results.cnameValid = true;
              break;
            }
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
    const { domainId, domain, verificationToken } = await req.json();
    
    if (!domainId || !domain || !verificationToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying domain: ${domain} with token: ${verificationToken}`);

    // Check DNS records
    const dnsResults = await checkDNSRecords(domain, verificationToken);
    
    console.log('DNS check results:', JSON.stringify(dnsResults));

    // Determine status based on DNS results
    const isVerified = dnsResults.aRecordValid && dnsResults.txtRecordValid;
    
    // Update database with results
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (isVerified) {
      // Domain is verified - update status and start SSL provisioning
      const { error: updateError } = await supabase
        .from('funnel_domains')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          ssl_provisioned: true, // In production, this would be a separate process
        })
        .eq('id', domainId);

      if (updateError) {
        console.error('Error updating domain status:', updateError);
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          verified: true,
          ssl_status: 'provisioned',
          dns_results: dnsResults,
          message: 'Domain verified successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Not verified yet - return current status
      return new Response(
        JSON.stringify({
          verified: false,
          ssl_status: 'pending',
          dns_results: dnsResults,
          message: 'DNS records not yet configured correctly',
          requirements: {
            a_record: {
              required: EXPECTED_IP,
              found: dnsResults.aRecordValue,
              valid: dnsResults.aRecordValid
            },
            txt_record: {
              required: `lovable_verify=${verificationToken}`,
              found: dnsResults.txtRecordValue,
              valid: dnsResults.txtRecordValid
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
