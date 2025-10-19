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

    // Handle OAuth errors (user denied access)
    if (error) {
      console.error('OAuth error:', error);
      const errorDescription = url.searchParams.get('error_description') || 'Authorization denied';
      
      // Redirect back to app with error
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent(errorDescription)}`,
        302
      );
    }

    if (!code || !state) {
      console.error('Missing code or state parameter');
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('Invalid OAuth callback')}`,
        302
      );
    }

    // Decode state to get teamId and userId
    let teamId: string;
    let userId: string;
    try {
      const stateData = JSON.parse(atob(state));
      teamId = stateData.teamId;
      userId = stateData.userId;
    } catch (e) {
      console.error('Failed to parse state:', e);
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('Invalid state parameter')}`,
        302
      );
    }

    console.log('Processing OAuth for team:', teamId, 'user:', userId);

    // Get OAuth credentials
    const clientId = Deno.env.get('CALENDLY_CLIENT_ID');
    const clientSecret = Deno.env.get('CALENDLY_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('OAuth credentials not configured');
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('OAuth not configured')}`,
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
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('Failed to exchange authorization code')}`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in response');
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('No access token received')}`,
        302
      );
    }

    console.log('Access token obtained successfully');

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
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('Failed to fetch Calendly user info')}`,
        302
      );
    }

    const userData = await userResponse.json();
    const organizationUri = userData.resource?.current_organization;

    if (!organizationUri) {
      console.error('No organization URI found');
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent('No organization found')}`,
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
        organizationUri,
      },
    });

    if (setupError) {
      console.error('Setup failed:', setupError);
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/${teamId}?calendly_oauth_error=${encodeURIComponent('Failed to setup webhook')}`,
        302
      );
    }

    if (setupData?.error) {
      console.error('Setup returned error:', setupData.error);
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/${teamId}?calendly_oauth_error=${encodeURIComponent(setupData.error)}`,
        302
      );
    }

    console.log('Calendly OAuth setup completed successfully');

    // Return HTML that will close the popup and notify the parent window
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Success</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .checkmark {
      font-size: 64px;
      margin-bottom: 1rem;
      animation: scale-in 0.3s ease-out;
    }
    @keyframes scale-in {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Connected Successfully!</h1>
    <p>This window will close automatically...</p>
  </div>
  <script>
    (function() {
      // Send message to parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'calendly-oauth-success' }, '*');
        // Close after a short delay to show the success message
        setTimeout(function() {
          window.close();
        }, 1500);
      } else {
        // Fallback: redirect if not in popup
        window.location.href = '${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/${teamId}?calendly_oauth_success=true';
      }
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders 
      }
    });
  } catch (error) {
    console.error('Error in calendly-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return Response.redirect(
      `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://58be05a2-2d12-4440-8371-6b03075eca7a.lovableproject.com'}/team/settings?calendly_oauth_error=${encodeURIComponent(errorMessage)}`,
      302
    );
  }
});
