import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    );

    // Get request body
    const { teamId, userId } = await req.json();

    console.log('Starting OAuth flow for teamId:', teamId, 'userId:', userId);

    if (!teamId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Team ID and User ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin or owner of this team
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.error('Membership check failed:', {
        message: membershipError.message,
        details: membershipError.details,
        hint: membershipError.hint,
        code: membershipError.code,
        fullError: JSON.stringify(membershipError)
      });
      return new Response(
        JSON.stringify({ error: 'Failed to verify team membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!membership) {
      console.error('No membership found for user:', userId, 'in team:', teamId);
      return new Response(
        JSON.stringify({ error: 'You are not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (membership.role !== 'admin' && membership.role !== 'owner' && membership.role !== 'offer_owner') {
      return new Response(
        JSON.stringify({ error: 'Only team admins and owners can configure Calendly integration' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth credentials from environment
    const clientId = Deno.env.get('CALENDLY_CLIENT_ID');
    const clientSecret = Deno.env.get('CALENDLY_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('Calendly OAuth credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Calendly integration is not configured yet. Please contact your system administrator to set up the Calendly OAuth credentials (CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET).' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the origin from the request headers to redirect back correctly
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';

    // Generate state parameter (includes team_id, user_id, and origin for callback)
    const state = btoa(JSON.stringify({ teamId, userId, origin }));

    // Construct Calendly OAuth authorization URL
    const authUrl = new URL('https://auth.calendly.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    console.log('OAuth URL generated successfully');

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calendly-oauth-start:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
