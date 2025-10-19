import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    // Get team's Calendly credentials
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('calendly_access_token, calendly_organization_uri, calendly_webhook_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return new Response(JSON.stringify({ error: 'Team not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = team.calendly_access_token;
    const organizationUri = team.calendly_organization_uri;

    if (!accessToken || !organizationUri) {
      return new Response(JSON.stringify({ error: 'Calendly not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete old webhook if it exists
    if (team.calendly_webhook_id) {
      console.log('Deleting old webhook:', team.calendly_webhook_id);
      await fetch(team.calendly_webhook_id, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }

    // Create new webhook with correct URL including team_id
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-webhook?team_id=${teamId}`;
    
    console.log('Creating new webhook with URL:', webhookUrl);
    
    const webhookResponse = await fetch('https://api.calendly.com/webhook_subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        organization: organizationUri,
        scope: 'organization',
        events: [
          'invitee.created',
          'invitee.canceled',
        ],
      }),
    });

    if (!webhookResponse.ok) {
      const errorData = await webhookResponse.json();
      console.error('Failed to create webhook:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to create webhook', details: errorData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const webhookData = await webhookResponse.json();
    const webhookId = webhookData.resource?.uri;

    console.log('Webhook created successfully:', webhookId);

    // Update database with new webhook ID
    const { error: updateError } = await supabase
      .from('teams')
      .update({ calendly_webhook_id: webhookId })
      .eq('id', teamId);

    if (updateError) {
      console.error('Failed to update team:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save webhook ID' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      webhookId,
      webhookUrl 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error fixing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
