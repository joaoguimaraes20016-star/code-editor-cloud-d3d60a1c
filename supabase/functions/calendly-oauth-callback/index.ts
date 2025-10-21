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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('OAuth callback received');

    // Decode state first to get origin
    let teamId: string = '';
    let userId: string = '';
    let origin: string = '';
    
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        teamId = stateData.teamId;
        userId = stateData.userId;
        origin = stateData.origin;
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }

    // Handle OAuth errors (user denied access)
    if (error) {
      console.error('OAuth error:', error);
      const errorDescription = url.searchParams.get('error_description') || 'Authorization denied';
      
      // Redirect back to app with error
      const redirectUrl = origin 
        ? `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent(errorDescription)}`
        : `/team/settings?calendly_oauth_error=${encodeURIComponent(errorDescription)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !state || !origin) {
      console.error('Missing required parameters');
      const redirectUrl = origin 
        ? `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('Invalid OAuth callback')}`
        : `/team/settings?calendly_oauth_error=${encodeURIComponent('Invalid OAuth callback')}`;
      return Response.redirect(redirectUrl, 302);
    }

    console.log('Processing OAuth for team:', teamId, 'user:', userId);

    // Get OAuth credentials
    const clientId = Deno.env.get('CALENDLY_CLIENT_ID');
    const clientSecret = Deno.env.get('CALENDLY_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('OAuth credentials not configured');
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('OAuth not configured')}`,
        302
      );
    }

    // Exchange authorization code for access token
    console.log('Exchanging code for access token...');
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('Failed to exchange authorization code')}`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds until expiration

    if (!accessToken) {
      console.error('No access token in response');
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('No access token received')}`,
        302
      );
    }

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

    console.log('Access token obtained successfully, expires at:', expiresAt);

    // Fetch organization URI using the access token
    console.log('Fetching organization URI...');
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('Failed to fetch Calendly user info')}`,
        302
      );
    }

    const userData = await userResponse.json();
    const organizationUri = userData.resource?.current_organization;

    if (!organizationUri) {
      console.error('No organization URI found');
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('No organization found')}`,
        302
      );
    }

    console.log('Organization URI obtained:', organizationUri);

    // Initialize Supabase client with service role key for setup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call setup-calendly function to register webhook
    console.log('Registering webhook...');
    const { data: setupData, error: setupError } = await supabaseAdmin.functions.invoke('setup-calendly', {
      body: {
        teamId,
        accessToken,
        refreshToken,
        expiresAt,
        organizationUri,
      },
    });

    if (setupError) {
      console.error('Setup failed:', setupError);
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('Failed to setup webhook')}`,
        302
      );
    }

    if (setupData?.error) {
      console.error('Setup returned error:', setupData.error);
      return Response.redirect(
        `${origin}/team/${teamId}?calendly_oauth_error=${encodeURIComponent(setupData.error)}`,
        302
      );
    }

    console.log('Calendly OAuth setup completed successfully');

    // Redirect back to team settings with success
    const redirectUrl = `${origin}/team/${teamId}?calendly_oauth_success=true`;
    
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Error in calendly-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return Response.redirect(
      `/team/settings?calendly_oauth_error=${encodeURIComponent(errorMessage)}`,
      302
    );
  }
});
