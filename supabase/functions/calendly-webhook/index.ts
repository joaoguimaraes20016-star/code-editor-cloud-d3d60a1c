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
    console.log('Received Calendly webhook event:', payload.event);

    const event = payload.event;
    const eventType = payload.event_type?.uri || '';

    // Extract invitee data
    const inviteeUri = payload.payload?.invitee?.uri;
    if (!inviteeUri) {
      console.error('No invitee URI in payload');
      return new Response(JSON.stringify({ error: 'No invitee data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get invitee details
    const inviteeResponse = await fetch(inviteeUri, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CALENDLY_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!inviteeResponse.ok) {
      console.error('Failed to fetch invitee details');
      return new Response(JSON.stringify({ error: 'Failed to fetch invitee' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inviteeData = await inviteeResponse.json();
    const resource = inviteeData.resource;

    const leadName = resource.name;
    const leadEmail = resource.email;
    const startTime = resource.start_time;
    const canceledAt = resource.canceled ? new Date(resource.updated_at).toISOString() : null;
    const rescheduledFrom = resource.reschedule_url ? resource.old_invitee : null;

    // Get event details to find the organizer
    const eventUri = resource.event;
    const eventResponse = await fetch(eventUri, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CALENDLY_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    });

    let closerId = null;
    let closerName = null;

    if (eventResponse.ok) {
      const eventData = await eventResponse.json();
      const organizerEmail = eventData.resource?.event_memberships?.[0]?.user_email;

      if (organizerEmail) {
        // Find team member by email
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('email', organizerEmail)
          .single();

        if (profiles) {
          closerId = profiles.id;
          closerName = profiles.full_name;
          console.log(`Matched organizer ${organizerEmail} to team member ${closerName}`);
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
          team_id: Deno.env.get('TEAM_ID'), // This should be passed or determined
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
      if (rescheduledFrom) {
        const { data: appointment, error } = await supabase
          .from('appointments')
          .update({ start_at_utc: startTime })
          .eq('lead_email', leadEmail)
          .select()
          .single();

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
