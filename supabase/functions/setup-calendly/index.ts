import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { teamId, accessToken, organizationUri } = await req.json();

    // Check if this is a service role call (from OAuth callback)
    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'xxx');

    // For non-service-role calls, verify user authentication and permissions
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user is team owner or offer owner
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      if (membership?.role !== 'owner' && membership?.role !== 'offer_owner') {
        return new Response(JSON.stringify({ error: 'Only team owners and offer owners can setup Calendly' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Register webhook with Calendly - include team ID in URL
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-webhook?team_id=${teamId}`;
    
    // First, check if webhook already exists and delete it to get a fresh signing key
    console.log('Checking for existing webhooks...');
    const listResponse = await fetch(`https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const existingWebhook = listData.collection?.find((w: any) => w.callback_url === webhookUrl);
      
      if (existingWebhook) {
        console.log('Deleting existing webhook to get fresh signing key:', existingWebhook.uri);
        await fetch(existingWebhook.uri, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
    }
    
    // Create new webhook to get signing key
    console.log('Creating new webhook...');
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
      return new Response(JSON.stringify({ error: 'Failed to create webhook' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const webhookData = await webhookResponse.json();
    const webhookId = webhookData.resource?.uri;
    const signingKey = webhookData.resource?.signing_key;
    
    console.log('Webhook created successfully with ID:', webhookId);
    console.log('Signing key captured:', signingKey ? 'Yes' : 'No');
    
    if (!signingKey) {
      console.error('Warning: No signing key received from Calendly');
    }

    // Store signing key in Supabase secrets using admin client
    if (signingKey) {
      try {
        const adminSupabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Store as secret - note: we'll store it in an env var format
        // This will make it available to the webhook function
        console.log('Storing signing key in secrets...');
        
        // For now, we'll need to update the CALENDLY_WEBHOOK_SIGNING_KEY manually
        // or store it in the database as an alternative
      } catch (err) {
        console.error('Failed to store signing key:', err);
      }
    }
    
    // Store credentials in database
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        calendly_access_token: accessToken,
        calendly_organization_uri: organizationUri,
        calendly_webhook_id: webhookId,
        calendly_signing_key: signingKey, // Store it in the database for now
      })
      .eq('id', teamId);

    if (updateError) {
      console.error('Failed to update team:', updateError);
      
      // Try to cleanup webhook if database update failed
      if (webhookId) {
        await fetch(webhookId, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to save configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully configured Calendly for team:', teamId);

    return new Response(JSON.stringify({ 
      success: true,
      webhookId,
      webhookUrl 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
