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
    // Use service role for database operations to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { teamId, accessToken, refreshToken, expiresAt, organizationUri } = await req.json();

    console.log('Setting up Calendly for team:', teamId);

    console.log('Setting up Calendly for team:', teamId);

    // Check if this is a service role call (from OAuth callback)
    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'xxx');

    // For non-service-role calls, verify user authentication and permissions
    if (!isServiceRole) {
      // Create auth client to verify user
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader! },
          },
        }
      );

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        console.error('Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Verifying user permissions for team:', teamId);

      // Verify user is team admin or offer owner
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        console.error('Error fetching membership:', membershipError);
        return new Response(JSON.stringify({ error: 'Failed to verify team membership' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!membership || (membership.role !== 'admin' && membership.role !== 'offer_owner')) {
        console.error('User does not have permission. Role:', membership?.role);
        return new Response(JSON.stringify({ error: 'Only team admins and offer owners can setup Calendly' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Signing key is configured at environment level via CALENDLY_WEBHOOK_SIGNING_KEY
    // No need to fetch it per team
    
    // Register webhook with Calendly - include team ID in URL
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-webhook?team_id=${teamId}`;
    
    // First, check if webhook already exists and delete it
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
        console.log('Deleting existing webhook:', existingWebhook.uri);
        await fetch(existingWebhook.uri, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
    }
    
    // Create new webhook
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
      
      // Check if it's a permission error
      if (errorData.title === 'Permission Denied' || errorData.message?.includes('permission')) {
        return new Response(JSON.stringify({ 
          error: 'Permission Denied: Your Calendly account needs admin/owner permissions to create webhooks. Please have an organization admin connect Calendly instead.' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Failed to create webhook: ' + (errorData.message || 'Unknown error') }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const webhookData = await webhookResponse.json();
    const webhookId = webhookData.resource?.uri;
    
    console.log('Webhook created successfully with ID:', webhookId);
    
    // Fetch event types from Calendly (including inactive ones)
    console.log('Fetching event types from Calendly...');
    const eventTypesResponse = await fetch(`https://api.calendly.com/event_types?organization=${encodeURIComponent(organizationUri)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    let eventTypes: string[] = [];
    if (eventTypesResponse.ok) {
      const eventTypesData = await eventTypesResponse.json();
      // Store API URIs (not scheduling URLs) to match what CalendlyConfig expects
      eventTypes = eventTypesData.collection?.map((et: any) => et.uri) || [];
      console.log('Fetched event types:', eventTypes);
    } else {
      console.error('Failed to fetch event types:', await eventTypesResponse.text());
    }
    
    // Store credentials in database (signing key is stored in environment secrets, not per-team)
    console.log('Storing credentials in database for team:', teamId);
    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({
        calendly_access_token: accessToken,
        calendly_refresh_token: refreshToken,
        calendly_token_expires_at: expiresAt,
        calendly_organization_uri: organizationUri,
        calendly_webhook_id: webhookId,
        calendly_event_types: eventTypes,
      })
      .eq('id', teamId);

    if (updateError) {
      console.error('Failed to update team:', updateError);
      console.error('Update error details:', JSON.stringify(updateError));
      
      // Try to cleanup webhook if database update failed
      if (webhookId) {
        console.log('Cleaning up webhook due to database error');
        try {
          await fetch(webhookId, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup webhook:', cleanupError);
        }
      }

      return new Response(JSON.stringify({ 
        error: 'Failed to save configuration', 
        details: updateError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully configured Calendly for team:', teamId);

    // Trigger background import of existing appointments (fire and forget)
    console.log('Triggering background import of existing appointments...');
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/import-calendly-appointments`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamId }),
    }).then(async (response) => {
      if (response.ok) {
        const result = await response.json();
        console.log(`✓ Import completed: ${result.imported} imported, ${result.skipped} skipped`);
      } else {
        console.error('✗ Import failed:', await response.text());
      }
    }).catch((error) => {
      console.error('✗ Import error:', error);
    });

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
