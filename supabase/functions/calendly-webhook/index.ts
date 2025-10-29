import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://calendly.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
};

// Verify Calendly webhook signature
async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  signingKey: string
): Promise<boolean> {
  if (!signature || !signingKey) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Webhook payload validation schema
const webhookPayloadSchema = z.object({
  event: z.enum(['invitee.created', 'invitee.canceled', 'invitee.rescheduled']),
  payload: z.object({
    uri: z.string().url().optional(),
    name: z.string().min(1).max(255),
    email: z.string().email().max(255),
    status: z.string().optional(),
    questions_and_answers: z.array(z.object({
      question: z.string().optional(),
      answer: z.string().optional(),
    })).optional(),
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    const rawBody = await req.text();
    const url = new URL(req.url);
    const teamIdParam = url.searchParams.get('team_id');
    
    console.log('Webhook received - URL:', req.url);
    console.log('Team ID from URL:', teamIdParam);
    
    if (!teamIdParam) {
      console.error('No team_id in webhook URL');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch team's Calendly configuration - only need tokens, not signing key
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, calendly_access_token, calendly_refresh_token, calendly_token_expires_at, calendly_event_types')
      .eq('id', teamIdParam)
      .not('calendly_access_token', 'is', null)
      .maybeSingle();

    console.log('Team query result:', { team, error: teamError });

    if (teamError || !team) {
      console.error('Could not find team for webhook - Team ID:', teamIdParam, 'Error:', teamError);
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired or about to expire (within 5 minutes)
    let accessToken = team.calendly_access_token;
    if (team.calendly_token_expires_at) {
      const expiresAt = new Date(team.calendly_token_expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Access token expired or expiring soon, attempting to refresh...');
        
        // Call refresh function
        const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-calendly-token', {
          body: { teamId: teamIdParam }
        });

        if (refreshError || refreshData?.error) {
          console.error('Token refresh failed:', refreshError || refreshData?.error);
          await logWebhookEvent(supabase, teamIdParam, 'token_refresh_failed', 'error', { 
            error: 'Token expired and refresh failed. Please reconnect Calendly.' 
          });
          return new Response(
            JSON.stringify({ error: 'Calendly token expired. Please reconnect.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch updated token
        const { data: updatedTeam } = await supabase
          .from('teams')
          .select('calendly_access_token')
          .eq('id', teamIdParam)
          .single();
        
        accessToken = updatedTeam?.calendly_access_token || accessToken;
        console.log('Token refreshed successfully for webhook processing');
      }
    }

    const teamId = team.id;
    const allowedEventTypes = team.calendly_event_types || [];
    
    // Skip signature verification for now - Calendly webhooks will be accepted
    console.log('⚠ Webhook signature verification disabled - accepting all Calendly webhooks');
    
    const rawPayload = JSON.parse(rawBody);
    console.log('Received valid Calendly webhook for team:', teamId);

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

    // Event type filtering temporarily disabled - accepting all appointments
    const eventTypeUri = payload.payload?.scheduled_event?.event_type;
    console.log(`Processing appointment from event type: ${eventTypeUri}`);

    // Get invitee details - the payload.payload IS the invitee data
    const inviteeData = payload.payload;

    const leadName = inviteeData.name.substring(0, 255);
    const leadEmail = inviteeData.email.substring(0, 255);
    const startTime = inviteeData.scheduled_event?.start_time;
    const status = inviteeData.status;
    
    // Extract phone number from questions_and_answers
    let leadPhone = null;
    if (inviteeData.questions_and_answers && Array.isArray(inviteeData.questions_and_answers)) {
      const phoneQuestion = inviteeData.questions_and_answers.find((qa: any) => 
        qa.question?.toLowerCase().includes('phone') || 
        qa.question?.toLowerCase().includes('number')
      );
      if (phoneQuestion?.answer) {
        leadPhone = phoneQuestion.answer;
      }
    }
    
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
        const organizerName = eventData.resource?.event_memberships?.[0]?.user_name;
        console.log('Event data received:', JSON.stringify(eventData, null, 2));

        if (organizerEmail) {
          console.log('Organizer details:', { email: organizerEmail, name: organizerName });
          
          // Method 1: Try exact email match first
          let profiles = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', organizerEmail)
            .maybeSingle()
            .then(({ data }) => data);

          // Method 2: Try partial email match (username part)
          if (!profiles && organizerEmail.includes('@')) {
            const emailUsername = organizerEmail.split('@')[0];
            const { data: partialMatches } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .ilike('email', `${emailUsername}%`);
            
            profiles = partialMatches?.[0] || null;
            if (profiles) {
              console.log(`✓ Matched by partial email: "${organizerEmail}" → "${profiles.email}"`);
            }
          }

          // Method 3: Try name matching (case-insensitive, partial)
          if (!profiles && organizerName) {
            const nameParts = organizerName.toLowerCase().split(' ');
            const { data: nameMatches } = await supabase
              .from('profiles')
              .select('id, full_name, email');
            
            // Find best name match
            if (nameMatches && nameMatches.length > 0) {
              const scored = nameMatches.map(profile => {
                const profileNameLower = profile.full_name.toLowerCase();
                const matches = nameParts.filter((part: string) => 
                  profileNameLower.includes(part) && part.length > 2
                ).length;
                return { profile, score: matches };
              });
              
              const best = scored.sort((a, b) => b.score - a.score)[0];
              if (best && best.score > 0) {
                profiles = best.profile;
                console.log(`✓ Matched by name: "${organizerName}" → "${profiles.full_name}" (score: ${best.score})`);
              }
            }
          }

          if (profiles) {
            closerId = profiles.id;
            closerName = profiles.full_name;
            console.log(`✓ Final match: ${closerName} (${profiles.email})`);
          } else {
            console.log('✗ No closer match found');
          }
        }
      }
    }

    // Handle different event types
    if (event === 'invitee.created') {
      // Fetch event type name from Calendly API
      let eventTypeName = null;
      if (eventTypeUri && accessToken) {
        try {
          const eventTypeResponse = await fetch(eventTypeUri, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          if (eventTypeResponse.ok) {
            const eventTypeData = await eventTypeResponse.json();
            eventTypeName = eventTypeData.resource?.name;
            console.log(`Event type: ${eventTypeName}`);
          }
        } catch (error) {
          console.warn('Failed to fetch event type name:', error);
        }
      }

      // Prepare appointment data with optional auto-assignment
      const appointmentData: any = {
        lead_name: leadName,
        lead_email: leadEmail,
        lead_phone: leadPhone,
        start_at_utc: startTime,
        closer_id: closerId,
        closer_name: closerName,
        status: 'NEW',
        team_id: teamId,
        event_type_uri: eventTypeUri,
        event_type_name: eventTypeName,
        pipeline_stage: 'booked', // Auto-assign to Appointment Booked stage
      };

      // Fetch full invitee details for auto-assignment and Calendly URLs
      let rescheduleUrl = null;
      let cancelUrl = null;
      let calendlyInviteeUri = null;
      
      try {
        console.log('Attempting to fetch invitee details for auto-assignment and URLs');
        
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
            const resource = inviteeDetails.resource;
            
            // Store Calendly URLs for rescheduling
            rescheduleUrl = resource?.reschedule_url || null;
            cancelUrl = resource?.cancel_url || null;
            calendlyInviteeUri = resource?.uri || null;
            
            console.log('Extracted Calendly URLs:', { rescheduleUrl, cancelUrl, calendlyInviteeUri });
            
            const utmSource = resource?.tracking?.utm_source;
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
          console.log('Missing required data for invitee fetch:', { inviteeUuid, eventUuid, hasToken: !!accessToken });
        }
      } catch (error) {
        // Log error but continue - appointment will just remain unassigned
        console.warn('Error during invitee details fetch:', error);
      }

      // Check for duplicate before creating appointment
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('id')
        .eq('team_id', teamId)
        .eq('lead_email', leadEmail)
        .eq('start_at_utc', startTime)
        .neq('status', 'CANCELLED') // Don't count cancelled appointments
        .maybeSingle();

      if (existingAppointment) {
        console.log(`⚠️ Duplicate appointment detected - skipping (ID: ${existingAppointment.id})`);
        await logWebhookEvent(supabase, teamId, event, 'success', { 
          appointmentId: existingAppointment.id,
          note: 'Duplicate skipped'
        });
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if this is a rescheduled appointment (cancelled within last 2 minutes with same email)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentlyCancelled } = await supabase
        .from('appointments')
        .select('id, setter_id, setter_name, closer_id, closer_name')
        .eq('team_id', teamId)
        .eq('lead_email', leadEmail)
        .eq('status', 'CANCELLED')
        .gte('updated_at', twoMinutesAgo)
        .maybeSingle();

      // If there's a recently cancelled appointment, this is a reschedule
      if (recentlyCancelled) {
        console.log(`🔄 Detected reschedule - will delete old appointment ${recentlyCancelled.id}`);
        
        // Preserve setter/closer from old appointment if not already assigned
        if (!appointmentData.setter_id && recentlyCancelled.setter_id) {
          appointmentData.setter_id = recentlyCancelled.setter_id;
          appointmentData.setter_name = recentlyCancelled.setter_name;
          console.log(`Preserved setter from cancelled appointment: ${recentlyCancelled.setter_name}`);
        }
        if (!appointmentData.closer_id && recentlyCancelled.closer_id) {
          appointmentData.closer_id = recentlyCancelled.closer_id;
          appointmentData.closer_name = recentlyCancelled.closer_name;
          console.log(`Preserved closer from cancelled appointment: ${recentlyCancelled.closer_name}`);
        }
        
        appointmentData.status = 'RESCHEDULED';
      }

      // Create admin client for operations that need service role
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Delete the old cancelled appointment BEFORE creating the new one
      if (recentlyCancelled) {
        const { error: deleteError } = await adminClient
          .from('appointments')
          .delete()
          .eq('id', recentlyCancelled.id);
        
        if (deleteError) {
          console.error(`Failed to delete old appointment ${recentlyCancelled.id}:`, deleteError);
        } else {
          console.log(`✓ Deleted old cancelled appointment ${recentlyCancelled.id}`);
        }
      }

      // Create new appointment using direct REST API to bypass auth context
      const appointmentToInsert = {
        team_id: appointmentData.team_id,
        lead_name: appointmentData.lead_name,
        lead_email: appointmentData.lead_email,
        lead_phone: appointmentData.lead_phone || null,
        start_at_utc: appointmentData.start_at_utc,
        closer_id: appointmentData.closer_id || null,
        closer_name: appointmentData.closer_name || null,
        setter_id: appointmentData.setter_id || null,
        setter_name: appointmentData.setter_name || null,
        status: appointmentData.status,
        event_type_uri: appointmentData.event_type_uri || null,
        event_type_name: appointmentData.event_type_name || null,
        pipeline_stage: appointmentData.pipeline_stage || 'booked',
        reschedule_url: rescheduleUrl,
        cancel_url: cancelUrl,
        calendly_invitee_uri: calendlyInviteeUri,
      };

      console.log('Inserting appointment with data:', JSON.stringify(appointmentToInsert));

      // Direct insert using service role client (already created above)
      const { data: insertedAppointment, error: insertError } = await adminClient
        .from('appointments')
        .insert([appointmentToInsert])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating appointment:', insertError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: insertError });
        return new Response(JSON.stringify({ error: 'Failed to process appointment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Created appointment:', insertedAppointment?.id);
      
      // If this was a reschedule and we have the old appointment, update any tasks to point to new appointment
      if (recentlyCancelled && insertedAppointment?.id) {
        const { error: taskUpdateError } = await supabase
          .from('confirmation_tasks')
          .update({ appointment_id: insertedAppointment.id })
          .eq('appointment_id', recentlyCancelled.id);
        
        if (taskUpdateError) {
          console.error(`Failed to update tasks for old appointment:`, taskUpdateError);
        } else {
          console.log(`✓ Updated tasks to point to new appointment ${insertedAppointment.id}`);
        }
      }
      
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: insertedAppointment?.id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (event === 'invitee.canceled') {
      console.log('[CANCEL] Processing cancellation event');
      
      // Find most recent appointment by email and time
      const { data: appointment, error: findError } = await supabase
        .from('appointments')
        .select('id, team_id')
        .eq('lead_email', leadEmail)
        .eq('start_at_utc', startTime)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError || !appointment) {
        console.error('[CANCEL] Could not find appointment:', findError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: 'Appointment not found' });
        return new Response(JSON.stringify({ error: 'Failed to find appointment' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update the specific appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'CANCELLED' })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('[CANCEL] Error updating appointment:', updateError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: updateError.message });
        return new Response(JSON.stringify({ error: 'Failed to process cancellation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CANCEL] Canceled appointment:', appointment.id);
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment.id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (event === 'invitee.rescheduled') {
      console.log('[RESCHEDULE] Processing rescheduled event');
      
      // Fetch new invitee details for updated URLs
      let newRescheduleUrl = null;
      let newCancelUrl = null;
      let newCalendlyInviteeUri = null;
      
      try {
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
            const resource = inviteeDetails.resource;
            newRescheduleUrl = resource?.reschedule_url || null;
            newCancelUrl = resource?.cancel_url || null;
            newCalendlyInviteeUri = resource?.uri || null;
            console.log('[RESCHEDULE] Fetched new URLs:', { newRescheduleUrl, newCancelUrl, newCalendlyInviteeUri });
          }
        }
      } catch (error) {
        console.warn('[RESCHEDULE] Failed to fetch new invitee details:', error);
      }

      // Find appointment by email and old time (or calendly URI if available)
      const { data: appointment, error: findError } = await supabase
        .from('appointments')
        .select('id, team_id')
        .eq('lead_email', leadEmail)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError || !appointment) {
        console.error('[RESCHEDULE] Could not find appointment:', findError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: 'Appointment not found' });
        return new Response(JSON.stringify({ error: 'Appointment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update appointment with new time, URLs, and status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          start_at_utc: startTime,
          reschedule_url: newRescheduleUrl,
          cancel_url: newCancelUrl,
          calendly_invitee_uri: newCalendlyInviteeUri,
          status: 'RESCHEDULED',
        })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('[RESCHEDULE] Error updating appointment:', updateError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: updateError.message });
        return new Response(JSON.stringify({ error: 'Failed to update appointment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark any awaiting_reschedule tasks as completed
      const { error: taskUpdateError } = await supabase
        .from('confirmation_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('appointment_id', appointment.id)
        .eq('status', 'awaiting_reschedule');

      if (taskUpdateError) {
        console.error('[RESCHEDULE] Error updating awaiting tasks:', taskUpdateError);
      }

      // Create a new call_confirmation task for the new date
      const { error: newTaskError } = await supabase.rpc('create_task_with_assignment', {
        p_team_id: appointment.team_id,
        p_appointment_id: appointment.id,
        p_task_type: 'call_confirmation'
      });

      if (newTaskError) {
        console.error('[RESCHEDULE] Error creating new task:', newTaskError);
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        team_id: appointment.team_id,
        appointment_id: appointment.id,
        actor_name: 'Calendly Webhook',
        action_type: 'Rescheduled',
        note: `Client rescheduled via Calendly to ${startTime}`
      });

      console.log('[RESCHEDULE] Successfully updated appointment and created new task');
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment.id });
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
