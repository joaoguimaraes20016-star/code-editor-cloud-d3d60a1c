import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { teamId } = await req.json();

    const healthChecks = {
      database: false,
      triggers: false,
      webhooks: false,
      recentErrors: 0,
      status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy'
    };

    // Check 1: Database connectivity
    try {
      const { error } = await supabase.from('teams').select('id').limit(1);
      healthChecks.database = !error;
    } catch (e) {
      console.error('Database check failed:', e);
    }

    // Check 2: Triggers active
    try {
      const { data: triggers, error } = await supabase.rpc('check_active_triggers');
      if (!error && triggers) {
        healthChecks.triggers = true;
      }
    } catch (e) {
      console.error('Trigger check failed:', e);
    }

    // Check 3: Recent errors (last hour)
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: errors } = await supabase
        .from('error_logs')
        .select('id')
        .eq('team_id', teamId)
        .gte('created_at', oneHourAgo);
      
      healthChecks.recentErrors = errors?.length || 0;
    } catch (e) {
      console.error('Error log check failed:', e);
    }

    // Check 4: Webhook configuration
    try {
      const { data: team } = await supabase
        .from('teams')
        .select('calendly_webhook_id, calendly_access_token')
        .eq('id', teamId)
        .single();
      
      healthChecks.webhooks = !!(team?.calendly_webhook_id && team?.calendly_access_token);
    } catch (e) {
      console.error('Webhook check failed:', e);
    }

    // Determine overall status
    const checksPassedCount = [
      healthChecks.database,
      healthChecks.triggers,
      healthChecks.webhooks
    ].filter(Boolean).length;

    if (checksPassedCount === 3 && healthChecks.recentErrors < 5) {
      healthChecks.status = 'healthy';
    } else if (checksPassedCount >= 2) {
      healthChecks.status = 'degraded';
    }

    return new Response(JSON.stringify(healthChecks), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: 'unhealthy'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});