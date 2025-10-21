import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { teamId } = await req.json();

    if (!teamId) {
      return new Response(JSON.stringify({ error: 'teamId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has permission to modify this team
    const { data: membership, error: membershipError } = await supabase
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

    if (!membership || !['owner', 'offer_owner'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized to modify this team' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current Calendly access token to revoke it
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('calendly_access_token')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError) {
      console.error('Error fetching team:', teamError);
      return new Response(JSON.stringify({ error: 'Failed to fetch team data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!team) {
      console.error('Team not found:', teamId);
      return new Response(JSON.stringify({ error: 'Team not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Revoke the Calendly OAuth token to force fresh login on reconnect
    if (team?.calendly_access_token) {
      try {
        const revokeResponse = await fetch('https://auth.calendly.com/oauth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: team.calendly_access_token,
            client_id: Deno.env.get('CALENDLY_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('CALENDLY_CLIENT_SECRET') ?? '',
          }),
        });

        if (!revokeResponse.ok) {
          console.error('Failed to revoke Calendly token:', await revokeResponse.text());
        } else {
          console.log('Successfully revoked Calendly token');
        }
      } catch (revokeError) {
        console.error('Error revoking Calendly token:', revokeError);
        // Continue with reset even if revocation fails
      }
    }

    // Clear Calendly connection from database
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        calendly_access_token: null,
        calendly_organization_uri: null,
        calendly_webhook_id: null,
        calendly_event_types: [],
      })
      .eq('id', teamId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error resetting Calendly:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
