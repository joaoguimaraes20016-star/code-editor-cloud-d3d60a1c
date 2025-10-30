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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    const { teamId } = await req.json();

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'Team ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting reschedule URL backfill for team:', teamId);

    // Fetch team's Calendly credentials
    const { data: team, error: teamError } = await supabaseClient
      .from('teams')
      .select('calendly_access_token, calendly_refresh_token, calendly_token_expires_at')
      .eq('id', teamId)
      .single();

    if (teamError || !team || !team.calendly_access_token) {
      console.error('Error fetching team or missing Calendly token:', teamError);
      return new Response(
        JSON.stringify({ error: 'Team not found or Calendly not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    let accessToken = team.calendly_access_token;
    if (team.calendly_token_expires_at) {
      const expiresAt = new Date(team.calendly_token_expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Token expired, refreshing...');
        const refreshResponse = await supabaseClient.functions.invoke('refresh-calendly-token', {
          body: { teamId }
        });

        if (refreshResponse.error || refreshResponse.data?.error) {
          console.error('Token refresh failed:', refreshResponse.error || refreshResponse.data?.error);
          return new Response(
            JSON.stringify({ 
              error: 'Calendly token expired. Please reconnect Calendly.',
              needsReauth: true 
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: updatedTeam } = await supabaseClient
          .from('teams')
          .select('calendly_access_token')
          .eq('id', teamId)
          .single();
        
        accessToken = updatedTeam?.calendly_access_token || accessToken;
      }
    }

    // Fetch appointments missing reschedule_url but have calendly_invitee_uri
    const { data: appointments, error: appointmentsError } = await supabaseClient
      .from('appointments')
      .select('id, calendly_invitee_uri, start_at_utc, lead_email')
      .eq('team_id', teamId)
      .is('reschedule_url', null)
      .not('calendly_invitee_uri', 'is', null);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch appointments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${appointments?.length || 0} appointments to backfill`);

    let updatedCount = 0;
    let failedCount = 0;

    // Process each appointment
    for (const appointment of appointments || []) {
      try {
        // Extract invitee UUID and event UUID from the invitee URI
        const inviteeUuid = appointment.calendly_invitee_uri?.split('/').pop();
        
        if (!inviteeUuid) {
          console.log(`Skipping appointment ${appointment.id} - invalid invitee URI`);
          failedCount++;
          continue;
        }

        // We need to get the event UUID from the invitee details first
        const inviteeResponse = await fetch(
          appointment.calendly_invitee_uri,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!inviteeResponse.ok) {
          console.error(`Failed to fetch invitee details for ${appointment.lead_email}:`, inviteeResponse.status);
          failedCount++;
          continue;
        }

        const inviteeData = await inviteeResponse.json();
        const rescheduleUrl = inviteeData.resource?.reschedule_url || null;
        const cancelUrl = inviteeData.resource?.cancel_url || null;

        if (rescheduleUrl || cancelUrl) {
          // Update the appointment
          const { error: updateError } = await supabaseClient
            .from('appointments')
            .update({
              reschedule_url: rescheduleUrl,
              cancel_url: cancelUrl
            })
            .eq('id', appointment.id);

          if (updateError) {
            console.error(`Failed to update appointment ${appointment.id}:`, updateError);
            failedCount++;
          } else {
            console.log(`✓ Updated ${appointment.lead_email}: reschedule=${!!rescheduleUrl}`);
            updatedCount++;
          }
        } else {
          console.log(`No URLs found for ${appointment.lead_email}`);
          failedCount++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
        failedCount++;
      }
    }

    console.log(`Backfill complete: ${updatedCount} updated, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: appointments?.length || 0,
        updated: updatedCount,
        failed: failedCount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in backfill function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
