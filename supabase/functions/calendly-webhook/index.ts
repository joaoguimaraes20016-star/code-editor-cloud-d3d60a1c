import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
};

// Webhook payload validation schema
const webhookPayloadSchema = z.object({
  event: z.enum(['invitee.created', 'invitee.canceled', 'invitee.rescheduled']),
  payload: z.object({
    uri: z.string().url().optional(),
    name: z.string().min(1).max(255),
    email: z.string().email().max(255),
    status: z.string().optional(),
    scheduled_event: z.object({
      uri: z.string().url().optional(),
      start_time: z.string(),
      event_type: z.string().url().optional(),
      event_memberships: z.array(z.object({
        user: z.string().optional(),
        user_email: z.string().optional(),
      })).optional(),
    }).optional(),
  }),
});

// Audit log helper
async function logWebhookEvent(
  supabase: any,
  teamId: string,
  event: string,
  status: 'success' | 'error',
  details: any
) {
  await supabase.from('webhook_audit_logs').insert({
    team_id: teamId,
    event_type: event,
    status,
    details,
    received_at: new Date().toISOString(),
  }).then(({ error }: any) => {
    if (error) console.error('Failed to log webhook event:', error);
  });
}

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

    const rawPayload = await req.json();
    console.log('Received Calendly webhook');

    // Validate webhook payload
    let payload;
    try {
      payload = webhookPayloadSchema.parse(rawPayload);
    } catch (validationError) {
      console.error('Invalid webhook payload:', validationError);
      return new Response(JSON.stringify({ error: 'Invalid payload format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = payload.event;
    const inviteeUri = payload.payload?.uri;

    // Get team ID from URL parameter
    const url = new URL(req.url);
    const teamIdParam = url.searchParams.get('team_id');
    
    if (!teamIdParam) {
      console.error('No team_id in webhook URL');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify team exists and has Calendly configured
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, calendly_access_token, calendly_event_types')
      .eq('id', teamIdParam)
      .not('calendly_access_token', 'is', null)
      .maybeSingle();

    if (teamError || !team) {
      console.error('Could not find team for webhook');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
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

    const leadName = inviteeData.name.substring(0, 255);
    const leadEmail = inviteeData.email.substring(0, 255);
    const startTime = inviteeData.scheduled_event?.start_time;
    const status = inviteeData.status;
    
    console.log('Processing appointment for team:', teamId);

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
      // Prepare appointment data with optional auto-assignment
      const appointmentData: any = {
        lead_name: leadName,
        lead_email: leadEmail,
        start_at_utc: startTime,
        closer_id: closerId,
        closer_name: closerName,
        status: 'NEW',
        team_id: teamId,
      };

      // Try to auto-assign based on UTM tracking parameter
      try {
        console.log('Attempting to fetch invitee details for auto-assignment');
        
        // The invitee URI is the full URI, extract UUID from it
        const inviteeUuid = inviteeUri?.split('/').pop();
        const eventUuid = eventUri?.split('/').pop();
        
        if (inviteeUuid && eventUuid && accessToken) {
          const inviteeResponse = await fetch(
            `https://api.calendly.com/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (inviteeResponse.ok) {
            const inviteeDetails = await inviteeResponse.json();
            const utmSource = inviteeDetails.resource?.tracking?.utm_source;
            
            console.log('UTM tracking data:', { utm_source: utmSource });
            
            // Check if utm_source matches pattern "setter_{code}"
            if (utmSource && utmSource.startsWith('setter_')) {
              const bookingCode = utmSource.replace('setter_', '');
              console.log('Attempting auto-assignment with booking code:', bookingCode);
              
              // Look up team member by booking_code
              const { data: teamMemberData, error: memberError } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('team_id', teamId)
                .eq('booking_code', bookingCode)
                .maybeSingle();
              
              if (teamMemberData && !memberError) {
                // Get profile info separately
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', teamMemberData.user_id)
                  .maybeSingle();
                
                appointmentData.setter_id = teamMemberData.user_id;
                appointmentData.setter_name = profile?.full_name || 'Unknown';
                console.log(`Auto-assigned to setter: ${profile?.full_name} (${bookingCode})`);
              } else {
                console.log('No team member found for booking code:', bookingCode);
              }
            }
          } else {
            console.warn('Failed to fetch invitee details:', inviteeResponse.status);
          }
        } else {
          console.log('Missing required data for auto-assignment:', { inviteeUuid, eventUuid, hasToken: !!accessToken });
        }
      } catch (error) {
        // Log error but continue - appointment will just remain unassigned
        console.warn('Error during auto-assignment attempt:', error);
      }

      // Create new appointment (with or without auto-assignment)
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating appointment:', error);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to process appointment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Created appointment:', appointment.id);
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment.id });
      return new Response(JSON.stringify({ success: true }), {
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
        await logWebhookEvent(supabase, teamId, event, 'error', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to process cancellation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Canceled appointment:', appointment?.id);
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment?.id });
      return new Response(JSON.stringify({ success: true }), {
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
        await logWebhookEvent(supabase, teamId, event, 'error', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to process reschedule' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Rescheduled appointment:', appointment?.id);
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment?.id });
      return new Response(JSON.stringify({ success: true }), {
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
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
