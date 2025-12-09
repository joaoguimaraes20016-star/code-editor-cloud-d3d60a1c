import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean domain (remove www. if present)
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    console.log(`Resolving domain: ${cleanDomain}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up the domain in funnel_domains
    const { data: domainRecord, error: domainError } = await supabase
      .from('funnel_domains')
      .select(`
        id,
        domain,
        status,
        ssl_provisioned,
        team_id
      `)
      .eq('domain', cleanDomain)
      .eq('status', 'verified')
      .single();

    if (domainError || !domainRecord) {
      console.log(`Domain not found or not verified: ${cleanDomain}`);
      return new Response(
        JSON.stringify({ 
          error: 'Domain not found or not verified',
          domain: cleanDomain 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the funnel linked to this domain
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select(`
        id,
        name,
        slug,
        status,
        settings,
        team_id
      `)
      .eq('domain_id', domainRecord.id)
      .eq('status', 'published')
      .single();

    if (funnelError || !funnel) {
      console.log(`No published funnel found for domain: ${cleanDomain}`);
      return new Response(
        JSON.stringify({ 
          error: 'No funnel linked to this domain',
          domain: cleanDomain,
          domain_id: domainRecord.id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get funnel steps
    const { data: steps, error: stepsError } = await supabase
      .from('funnel_steps')
      .select('*')
      .eq('funnel_id', funnel.id)
      .order('order_index', { ascending: true });

    if (stepsError) {
      console.error('Error fetching funnel steps:', stepsError);
    }

    console.log(`Domain ${cleanDomain} resolved to funnel: ${funnel.slug}`);

    return new Response(
      JSON.stringify({
        success: true,
        domain: cleanDomain,
        funnel: {
          id: funnel.id,
          slug: funnel.slug,
          name: funnel.name,
          settings: funnel.settings,
          team_id: funnel.team_id
        },
        steps: steps || [],
        ssl: {
          provisioned: domainRecord.ssl_provisioned,
          status: domainRecord.ssl_provisioned ? 'active' : 'pending'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Domain resolution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Resolution failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
