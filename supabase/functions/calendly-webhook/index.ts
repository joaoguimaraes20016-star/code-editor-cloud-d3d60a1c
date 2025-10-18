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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Received Calendly webhook payload:', JSON.stringify(payload, null, 2));

    const event = payload.event;
    
    // Extract invitee URI from the correct location in Calendly webhook payload
    const inviteeUri = payload.payload?.uri;
    if (!inviteeUri) {
      console.error('No invitee URI in payload. Payload structure:', JSON.stringify(payload));
      return new Response(JSON.stringify({ error: 'No invitee data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get team's Calendly access token based on webhook subscription
    // First, find which team this webhook belongs to by checking the organization URI
    const organizationUri = payload.payload?.scheduled_event?.event_memberships?.[0]?.user;
    
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, calendly_access_token, calendly_event_types')
      .not('calendly_access_token', 'is', null)
      .limit(1)
      .maybeSingle();

    if (teamError || !team) {
      console.error('Could not find team for webhook:', teamError);
      return new Response(JSON.stringify({ error: 'Team not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = team.calendly_access_token;
    const teamId = team.id;
    const allowedEventTypes = team.calendly_event_types || [];

    // Check if event type filtering is enabled (only if filters are set)
    const eventTypeUri = payload.payload?.scheduled_event?.event_type;
    if (allowedEventTypes && allowedEventTypes.length > 0 && eventTypeUri) {
      if (!allowedEventTypes.includes(eventTypeUri)) {
        console.log(`Event type ${eventTypeUri} not in allowed list (${allowedEventTypes.length} filters active). Skipping.`);
        return new Response(JSON.stringify({ success: true, message: 'Event type not tracked' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log(`No event type filters configured. Accepting all appointments.`);
    }

    // Get invitee details - the payload.payload IS the invitee data
    const inviteeData = payload.payload;

    const leadName = inviteeData.name;
    const leadEmail = inviteeData.email;
    const startTime = inviteeData.scheduled_event?.start_time;
    const status = inviteeData.status; // "active" or "canceled"
    
    console.log('Processing appointment:', { leadName, leadEmail, startTime, status });

    // Get event organizer email
    const eventUri = inviteeData.scheduled_event?.uri;
    let closerId = null;
    let closerName = null;

    if (eventUri && accessToken) {
      const eventResponse = await fetch(eventUri, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        const organizerEmail = eventData.resource?.event_memberships?.[0]?.user_email;

        if (organizerEmail) {
          // Find team member by email
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('email', organizerEmail)
            .maybeSingle();

          if (profiles) {
            closerId = profiles.id;
            closerName = profiles.full_name;
            console.log(`Matched organizer ${organizerEmail} to team member ${closerName}`);
          }
        }
      }
    }

    // Handle different event types
    if (event === 'invitee.created') {
      // Create new appointment
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          lead_name: leadName,
          lead_email: leadEmail,
          start_at_utc: startTime,
          closer_id: closerId,
          closer_name: closerName,
          status: 'NEW',
          team_id: teamId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating appointment:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Created appointment:', appointment.id);
      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (event === 'invitee.canceled') {
      // Update appointment status to CANCELLED
      const { data: appointment, error } = await supabase
        .from('appointments')
        .update({ status: 'CANCELLED' })
        .eq('lead_email', leadEmail)
        .eq('start_at_utc', startTime)
        .select()
        .single();

      if (error) {
        console.error('Error canceling appointment:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Canceled appointment:', appointment?.id);
      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (event === 'invitee.rescheduled') {
      // Update appointment time
      const { data: appointment, error } = await supabase
        .from('appointments')
        .update({ start_at_utc: startTime })
        .eq('lead_email', leadEmail)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error rescheduling appointment:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Rescheduled appointment:', appointment?.id);
      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, event }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
