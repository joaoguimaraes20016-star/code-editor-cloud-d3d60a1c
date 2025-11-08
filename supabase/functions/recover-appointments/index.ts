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

    const { teamId, startDate, endDate } = await req.json();

    // Get team's Calendly credentials
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('calendly_access_token, calendly_organization_uri, calendly_event_types')
      .eq('id', teamId)
      .single();

    if (teamError || !team?.calendly_access_token) {
      return new Response(JSON.stringify({ error: 'Team not found or Calendly not configured' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch appointments from Calendly
    const calendlyUrl = new URL('https://api.calendly.com/scheduled_events');
    calendlyUrl.searchParams.set('organization', team.calendly_organization_uri);
    calendlyUrl.searchParams.set('min_start_time', startDate);
    calendlyUrl.searchParams.set('max_start_time', endDate);
    calendlyUrl.searchParams.set('status', 'active');
    calendlyUrl.searchParams.set('count', '100');

    const calendlyResponse = await fetch(calendlyUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${team.calendly_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!calendlyResponse.ok) {
      throw new Error(`Calendly API error: ${calendlyResponse.status}`);
    }

    const calendlyData = await calendlyResponse.json();
    const calendlyEvents = calendlyData.collection || [];

    // Filter by event types if configured
    const filteredEvents = team.calendly_event_types?.length > 0
      ? calendlyEvents.filter((event: any) => 
          team.calendly_event_types.includes(event.event_type)
        )
      : calendlyEvents;

    // Get existing appointments from database
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('calendly_invitee_uri, lead_email, start_at_utc')
      .eq('team_id', teamId)
      .gte('start_at_utc', startDate)
      .lte('start_at_utc', endDate);

    // Find missing appointments
    const missingAppointments = [];
    const existingUris = new Set(
      existingAppointments?.map(a => a.calendly_invitee_uri).filter(Boolean)
    );
    const existingKeys = new Set(
      existingAppointments?.map(a => `${a.lead_email}-${a.start_at_utc}`)
    );

    for (const event of filteredEvents) {
      // Fetch invitees for this event
      const inviteesUrl = `${event.uri}/invitees`;
      const inviteesResponse = await fetch(inviteesUrl, {
        headers: {
          'Authorization': `Bearer ${team.calendly_access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (inviteesResponse.ok) {
        const inviteesData = await inviteesResponse.json();
        const invitees = inviteesData.collection || [];

        for (const invitee of invitees) {
          const key = `${invitee.email}-${event.start_time}`;
          if (!existingUris.has(invitee.uri) && !existingKeys.has(key)) {
            missingAppointments.push({
              calendly_event: event,
              invitee: invitee,
              lead_name: invitee.name,
              lead_email: invitee.email,
              start_at_utc: event.start_time,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      totalCalendlyEvents: filteredEvents.length,
      existingInDatabase: existingAppointments?.length || 0,
      missingAppointments: missingAppointments.length,
      details: missingAppointments,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Recovery error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});