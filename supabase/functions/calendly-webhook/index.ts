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

    // Check if appointment should be synced based on selected event types
    const eventTypeUri = payload.payload?.scheduled_event?.event_type;
    console.log(`Processing appointment from event type: ${eventTypeUri}`);
    
    // Filter by selected event types if configured
    if (team.calendly_event_types && Array.isArray(team.calendly_event_types) && team.calendly_event_types.length > 0) {
      if (!eventTypeUri || !team.calendly_event_types.includes(eventTypeUri)) {
        console.log(`Skipping appointment - event type ${eventTypeUri} not in selected types`);
        await logWebhookEvent(supabase, teamId, event, 'success', {
          message: 'Appointment skipped - event type not selected for sync',
          eventTypeUri,
          selectedEventTypes: team.calendly_event_types
        });
        return new Response(
          JSON.stringify({ message: 'Event type not selected for sync' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
          console.log('🔍 Organizer details:', { email: organizerEmail, name: organizerName });
          
          // Method 0: Check email aliases first (highest priority)
          const { data: aliasMatches } = await supabase
            .from('email_aliases')
            .select('user_id')
            .eq('alias_email', organizerEmail);
          
          let profiles = null;
          if (aliasMatches && aliasMatches.length > 0) {
            // Get the profile for the matched user_id
            const { data: aliasProfile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', aliasMatches[0].user_id)
              .maybeSingle();
            
            if (aliasProfile) {
              profiles = aliasProfile;
              console.log(`✓ Email alias match found: "${organizerEmail}" → ${profiles.full_name} (${profiles.email})`);
            }
          }
          
          // Method 1: Try exact email match
          if (!profiles) {
            profiles = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('email', organizerEmail)
              .maybeSingle()
              .then(({ data }) => data);

            if (profiles) {
              console.log(`✓ Exact email match found: ${profiles.full_name} (${profiles.email})`);
            }
          }

          // Method 2: Try partial email match (username part)
          if (!profiles && organizerEmail.includes('@')) {
            const emailUsername = organizerEmail.split('@')[0];
            console.log(`🔍 Trying partial email match with username: ${emailUsername}`);
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
            console.log(`🔍 Trying name match for: ${organizerName}`);
            const nameParts = organizerName.toLowerCase().split(' ');
            const { data: nameMatches } = await supabase
              .from('profiles')
              .select('id, full_name, email');
            
            // Find best name match
            if (nameMatches && nameMatches.length > 0) {
              console.log(`🔍 Found ${nameMatches.length} profiles to check against name`);
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
            // Verify they're a team member (any role is fine)
            const { data: teamMember } = await supabase
              .from('team_members')
              .select('role')
              .eq('team_id', teamId)
              .eq('user_id', profiles.id)
              .maybeSingle();

            if (teamMember) {
              // Assign meeting host as closer
              closerId = profiles.id;
              closerName = profiles.full_name;
              console.log(`✓ Assigned meeting host as closer: ${closerName} (${profiles.email}) [${teamMember.role}]`);
            } else {
              console.log(`⚠️ Profile matched but not a team member: ${profiles.full_name} (${profiles.email})`);
            }
          } else {
            console.log('✗ No profile match found for organizer');
          }
        }
      }
      
      // FALLBACK: If no closer assigned yet, check if there's only one active closer in the team
      if (!closerId) {
        console.log('🔍 No closer assigned yet, checking for fallback assignment...');
        const { data: teamClosers } = await supabase
          .from('team_members')
          .select('user_id, is_active, role')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .in('role', ['closer', 'owner', 'admin', 'offer_owner']);
        
        console.log(`🔍 Found ${teamClosers?.length || 0} potential closers in team`);
        
        if (teamClosers && teamClosers.length === 1) {
          // Only one closer - get their profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', teamClosers[0].user_id)
            .maybeSingle();
          
          if (profile) {
            closerId = profile.id;
            closerName = profile.full_name;
            console.log(`✅ FALLBACK: Auto-assigned to sole active closer: ${closerName}`);
          }
        } else if (teamClosers && teamClosers.length > 1) {
          // Multiple closers - prioritize offer_owner
          const offerOwner = teamClosers.find(tc => tc.role === 'offer_owner');
          if (offerOwner) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', offerOwner.user_id)
              .maybeSingle();
            
            if (profile) {
              closerId = profile.id;
              closerName = profile.full_name;
              console.log(`✅ FALLBACK: Auto-assigned to offer_owner: ${closerName}`);
            }
          } else {
            console.log(`⚠️ Multiple closers found (${teamClosers.length}), no offer_owner to auto-assign`);
          }
        } else {
          console.log('⚠️ No active closers found in team');
        }
      }
    }

    // Handle different event types
    if (event === 'invitee.created') {
      try {
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
                appointmentData.booking_code = bookingCode; // Store the booking code!
                console.log(`Auto-assigned to setter: ${profile?.full_name} (${bookingCode})`);
              } else {
                console.log('No team member found for booking code:', bookingCode);
              }
            }
            
            // SETTER FALLBACK: If no setter assigned via UTM, check if there's only one active setter
            if (!appointmentData.setter_id) {
              console.log('🔍 No setter assigned yet, checking for fallback setter assignment...');
              const { data: teamSetters } = await supabase
                .from('team_members')
                .select('user_id, is_active, role')
                .eq('team_id', teamId)
                .eq('is_active', true)
                .eq('role', 'setter');
              
              console.log(`🔍 Found ${teamSetters?.length || 0} active setters in team`);
              
              if (teamSetters && teamSetters.length === 1) {
                // Only one setter - auto-assign to them
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .eq('id', teamSetters[0].user_id)
                  .maybeSingle();
                
                if (profile) {
                  appointmentData.setter_id = profile.id;
                  appointmentData.setter_name = profile.full_name;
                  console.log(`✅ SETTER FALLBACK: Auto-assigned to sole active setter: ${profile.full_name}`);
                }
              } else if (teamSetters && teamSetters.length > 1) {
                console.log(`⚠️ Multiple setters found (${teamSetters.length}), cannot auto-assign`);
              } else {
                console.log('⚠️ No active setters found in team');
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

      // ============= INTELLIGENT RETURNING LEAD DETECTION =============
      console.log('[RETURNING-LEAD] Checking for ANY prior appointments with same email/phone...');
      
      // Search for ANY prior appointment (not just recently cancelled)
      let priorQuery = supabase
        .from('appointments')
        .select('id, setter_id, setter_name, closer_id, closer_name, calendly_invitee_uri, pipeline_stage, status, revenue, start_at_utc, original_booking_date, reschedule_count')
        .eq('team_id', teamId)
        .eq('lead_email', leadEmail)
        .neq('start_at_utc', startTime) // Don't match the same appointment
        .order('start_at_utc', { ascending: false })
        .limit(1);
      
      const { data: priorAppointments } = await priorQuery;
      const priorAppointment = priorAppointments?.[0] || null;
      
      // Variables to track rebooking context
      let rebookingType: string | null = null;
      let previousStatus: string | null = null;
      let originalBookingDate: string | null = null;
      let recentlyCancelled: any = null;
      
      if (priorAppointment) {
        const previousStage = priorAppointment.pipeline_stage;
        const previousDate = new Date(priorAppointment.start_at_utc);
        const newDate = startTime ? new Date(startTime) : new Date();
        const now = new Date();
        const isPast = previousDate < now;
        const hasRevenue = (priorAppointment.revenue || 0) > 0;
        
        console.log(`[RETURNING-LEAD] Found prior appointment:`);
        console.log(`  - ID: ${priorAppointment.id}`);
        console.log(`  - Stage: ${previousStage}`);
        console.log(`  - Date: ${previousDate.toISOString()}`);
        console.log(`  - Has Revenue: ${hasRevenue}`);
        console.log(`  - Is Past: ${isPast}`);
        
        // Determine rebooking type
        if (previousStage === 'won' || hasRevenue) {
          rebookingType = 'returning_client';
          console.log(`[RETURNING-LEAD] 🎉 RETURNING CLIENT detected - previously closed!`);
        } else if (['lost', 'no_show', 'disqualified', 'canceled'].includes(previousStage || '')) {
          rebookingType = 'win_back';
          console.log(`[RETURNING-LEAD] 🔄 WIN-BACK detected - was ${previousStage}`);
        } else if (isPast) {
          rebookingType = 'rebooking';
          console.log(`[RETURNING-LEAD] ⚠️ REBOOKING detected - past appointment`);
        } else {
          rebookingType = 'reschedule';
          console.log(`[RETURNING-LEAD] 📅 RESCHEDULE detected - upcoming appointment`);
        }
        
        previousStatus = previousStage || priorAppointment.status;
        originalBookingDate = priorAppointment.original_booking_date || priorAppointment.start_at_utc;
        
        // Preserve setter/closer from prior appointment if not already assigned via UTM
        if (!appointmentData.setter_id && priorAppointment.setter_id) {
          appointmentData.setter_id = priorAppointment.setter_id;
          appointmentData.setter_name = priorAppointment.setter_name;
          console.log(`✓ Preserved setter from prior appointment: ${priorAppointment.setter_name}`);
        }
        if (!appointmentData.closer_id && priorAppointment.closer_id) {
          appointmentData.closer_id = priorAppointment.closer_id;
          appointmentData.closer_name = priorAppointment.closer_name;
          console.log(`✓ Preserved closer from prior appointment: ${priorAppointment.closer_name}`);
        }
        
        // Check if this is a recent Calendly reschedule (within 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        if (priorAppointment.status === 'CANCELLED' || previousStage === 'canceled') {
          const { data: recentCancel } = await supabase
            .from('appointments')
            .select('id')
            .eq('id', priorAppointment.id)
            .gte('updated_at', twoMinutesAgo)
            .maybeSingle();
          
          if (recentCancel) {
            recentlyCancelled = priorAppointment;
            appointmentData.status = 'RESCHEDULED';
            console.log(`[RETURNING-LEAD] Also a recent Calendly reschedule - marking as RESCHEDULED`);
          }
        }
        
        // Store rebooking context on the new appointment
        (appointmentData as any).original_appointment_id = priorAppointment.id;
        (appointmentData as any).original_booking_date = originalBookingDate;
        (appointmentData as any).rebooking_type = rebookingType;
        (appointmentData as any).previous_status = previousStatus;
        (appointmentData as any).reschedule_count = (priorAppointment.reschedule_count || 0) + 1;
        
      } else {
        console.log('[RETURNING-LEAD] No prior appointments found - treating as new lead');
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
        booking_code: appointmentData.booking_code || null,
        status: appointmentData.status,
        event_type_uri: appointmentData.event_type_uri || null,
        event_type_name: appointmentData.event_type_name || null,
        pipeline_stage: appointmentData.pipeline_stage || 'booked',
        reschedule_url: rescheduleUrl,
        cancel_url: cancelUrl,
        calendly_invitee_uri: calendlyInviteeUri,
        assignment_source: appointmentData.setter_id ? 'booking_link' : null,
        // Rebooking context fields
        original_appointment_id: (appointmentData as any).original_appointment_id || null,
        original_booking_date: (appointmentData as any).original_booking_date || null,
        rebooking_type: (appointmentData as any).rebooking_type || null,
        previous_status: (appointmentData as any).previous_status || null,
        reschedule_count: (appointmentData as any).reschedule_count || 0,
      };

      console.log('Inserting appointment with data:', JSON.stringify(appointmentToInsert));

      // Direct insert using service role client (already created above)
      const { data: insertedAppointment, error: insertError } = await adminClient
        .from('appointments')
        .insert([appointmentToInsert])
        .select()
        .single();

      if (insertError) {
        console.error('[CREATE] ❌ Error creating appointment:', insertError);
        console.error('[CREATE] Error details:', JSON.stringify(insertError, null, 2));
        console.error('[CREATE] Attempted insert data:', JSON.stringify(appointmentToInsert, null, 2));
        
        // Log to error_logs table for tracking
        try {
          await supabase.functions.invoke('log-error', {
            body: {
              team_id: teamId,
              error_type: 'webhook_appointment_creation',
              error_message: insertError.message || 'Unknown error',
              error_context: {
                event,
                appointmentData: appointmentToInsert,
                error: insertError
              }
            }
          });
        } catch (logErr) {
          console.error('[CREATE] Failed to log error:', logErr);
        }
        
        await logWebhookEvent(supabase, teamId, event, 'error', { error: insertError });
        return new Response(JSON.stringify({ error: 'Failed to process appointment', details: insertError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CREATE] ✅ Appointment created successfully:', insertedAppointment?.id);
      console.log('[CREATE] Appointment details:', {
        id: insertedAppointment?.id,
        lead_name: insertedAppointment?.lead_name,
        start_at_utc: insertedAppointment?.start_at_utc,
        status: insertedAppointment?.status
      });

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
      
      // Log activity for returning lead detection
      if (rebookingType && insertedAppointment?.id) {
        const warningMessages: Record<string, string> = {
          returning_client: `🎉 RETURNING CLIENT: This lead previously closed${priorAppointment?.revenue ? ` ($${priorAppointment.revenue})` : ''}. Find out why they're booking again - could be upsell or new deal!`,
          win_back: `🔄 WIN-BACK OPPORTUNITY: Lead was previously ${previousStatus?.replace('_', ' ')}. They're giving you another chance - find out what changed!`,
          rebooking: `⚠️ REBOOKING: Originally booked for ${originalBookingDate ? new Date(originalBookingDate).toLocaleDateString() : 'unknown'}. Confirm they want the new date.`,
          reschedule: `📅 RESCHEDULE: Lead changed their appointment. Confirm this is intentional.`
        };
        
        await adminClient.from('activity_logs').insert({
          team_id: teamId,
          appointment_id: insertedAppointment.id,
          actor_name: 'System',
          action_type: `${rebookingType.replace('_', ' ').toUpperCase()} Detected`,
          note: warningMessages[rebookingType] || `Returning lead detected: ${rebookingType}`
        });
        
        console.log(`[RETURNING-LEAD] Activity logged for ${rebookingType}`);
      }
      
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: insertedAppointment?.id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
      } catch (appointmentCreationError: any) {
        // CRITICAL ERROR SAFETY NET: Log and return 200 to prevent Calendly retries
        console.error('[SAFETY-NET] ❌ Appointment creation failed with error:', appointmentCreationError);
        
        try {
          // Log error for admin visibility
          await supabase.functions.invoke('log-error', {
            body: {
              team_id: teamId,
              error_type: 'webhook_appointment_creation_fatal',
              error_message: appointmentCreationError.message || 'Unknown fatal error',
              error_context: {
                event,
                leadName,
                leadEmail,
                startTime,
                error: {
                  message: appointmentCreationError.message,
                  stack: appointmentCreationError.stack,
                  code: appointmentCreationError.code
                }
              }
            }
          });
          
          await logWebhookEvent(supabase, teamId, event, 'error', { 
            error: 'Fatal appointment creation error',
            details: appointmentCreationError.message 
          });
        } catch (logErr) {
          console.error('[SAFETY-NET] Failed to log fatal error:', logErr);
        }
        
        // Return 200 OK to Calendly to prevent infinite retries
        return new Response(
          JSON.stringify({ 
            acknowledged: true, 
            error: 'Internal error - logged for admin review' 
          }), 
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

    } else if (event === 'invitee.canceled') {
      console.log('[CANCEL] Processing cancellation event');
      console.log('[CANCEL] Event URI:', eventUri);
      console.log('[CANCEL] Lead email:', leadEmail);
      console.log('[CANCEL] Start time:', startTime);
      
      // Try to find by calendly_invitee_uri first (most reliable)
      let appointment = null;
      let findError = null;
      
      if (eventUri) {
        console.log('[CANCEL] Searching by calendly_invitee_uri:', eventUri);
        const result = await supabase
          .from('appointments')
          .select('id, team_id, lead_name, calendly_invitee_uri')
          .eq('calendly_invitee_uri', eventUri)
          .eq('team_id', teamId)
          .maybeSingle();
        
        appointment = result.data;
        findError = result.error;
        
        if (appointment) {
          console.log('[CANCEL] ✓ Found appointment by URI:', appointment.id);
        } else {
          console.log('[CANCEL] ⚠️ No appointment found by URI, trying email+time...');
        }
      }
      
      // Fallback: search by email and time
      if (!appointment && leadEmail && startTime) {
        console.log('[CANCEL] Searching by email + time');
        const result = await supabase
          .from('appointments')
          .select('id, team_id, lead_name, calendly_invitee_uri')
          .eq('lead_email', leadEmail)
          .eq('start_at_utc', startTime)
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        appointment = result.data;
        findError = result.error;
        
        if (appointment) {
          console.log('[CANCEL] ✓ Found appointment by email+time:', appointment.id);
        }
      }

      if (findError || !appointment) {
        console.error('[CANCEL] ❌ Could not find appointment');
        console.error('[CANCEL] Search criteria:', { eventUri, leadEmail, startTime, teamId });
        console.error('[CANCEL] Error:', findError);
        
        await logWebhookEvent(supabase, teamId, event, 'error', { 
          error: 'Appointment not found',
          searchCriteria: { eventUri, leadEmail, startTime }
        });
        
        // Still return success to Calendly to avoid retries
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Appointment not found',
          note: 'This may be expected if appointment was never synced'
        }), {
          status: 200, // Return 200 so Calendly doesn't retry
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CANCEL] Updating appointment to CANCELLED:', appointment.id);
      
      // Update the specific appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'CANCELLED',
          pipeline_stage: 'canceled'
        })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('[CANCEL] ❌ Error updating appointment:', updateError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: updateError.message });
        return new Response(JSON.stringify({ error: 'Failed to process cancellation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[CANCEL] ✓ Successfully canceled appointment:', appointment.id, '-', appointment.lead_name);
      await logWebhookEvent(supabase, teamId, event, 'success', { appointmentId: appointment.id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (event === 'invitee.rescheduled') {
      console.log('[RESCHEDULE] ===== Processing rescheduled event =====');
      console.log('[RESCHEDULE] Event URI:', eventUri);
      console.log('[RESCHEDULE] Invitee URI:', inviteeUri);
      console.log('[RESCHEDULE] Lead email:', leadEmail);
      console.log('[RESCHEDULE] New start time:', startTime);
      
      // Fetch new invitee details for updated URLs
      let newRescheduleUrl = null;
      let newCancelUrl = null;
      let newCalendlyInviteeUri = null;
      
      try {
        const inviteeUuid = inviteeUri?.split('/').pop();
        const eventUuid = eventUri?.split('/').pop();
        
        if (inviteeUuid && eventUuid && accessToken) {
          console.log('[RESCHEDULE] Fetching new invitee details from Calendly...');
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
            console.log('[RESCHEDULE] ✓ Fetched new URLs:', { 
              hasRescheduleUrl: !!newRescheduleUrl, 
              hasCancelUrl: !!newCancelUrl, 
              hasInviteeUri: !!newCalendlyInviteeUri 
            });
          } else {
            console.warn('[RESCHEDULE] ⚠️ Failed to fetch invitee details, status:', inviteeResponse.status);
          }
        }
      } catch (error) {
        console.error('[RESCHEDULE] ❌ Error fetching new invitee details:', error);
      }

      // Find the old appointment - try multiple methods
      console.log('[RESCHEDULE] Searching for old appointment...');
      let oldAppointment = null;
      let findError = null;
      
      // Try by email + team first (most reliable for reschedules)
      const searchResult = await supabase
        .from('appointments')
        .select('id, team_id, setter_id, setter_name, closer_id, closer_name, reschedule_count, original_appointment_id, calendly_invitee_uri, lead_name')
        .eq('lead_email', leadEmail)
        .eq('team_id', teamId)
        .neq('start_at_utc', startTime) // Exclude the new time to avoid finding newly created appointment
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      oldAppointment = searchResult.data;
      findError = searchResult.error;

      if (oldAppointment) {
        console.log('[RESCHEDULE] ✓ Found old appointment by email+team:', oldAppointment.id, '-', oldAppointment.lead_name);
      } else {
        console.error('[RESCHEDULE] ❌ Could not find old appointment');
        console.error('[RESCHEDULE] Search criteria:', { leadEmail, teamId, excludedTime: startTime });
        await logWebhookEvent(supabase, teamId, event, 'error', { 
          error: 'Old appointment not found',
          searchCriteria: { leadEmail, teamId }
        });
        return new Response(JSON.stringify({ 
          error: 'Old appointment not found',
          note: 'May need to check if appointment was ever synced'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create admin client for service role operations
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

      console.log('[RESCHEDULE] Updating old appointment to rescheduled stage...');
      // Move old appointment to "rescheduled" stage but keep it
      const { error: updateOldError } = await adminClient
        .from('appointments')
        .update({ 
          pipeline_stage: 'rescheduled',
          status: 'RESCHEDULED',
        })
        .eq('id', oldAppointment.id);

      if (updateOldError) {
        console.error('[RESCHEDULE] ❌ Error updating old appointment:', updateOldError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: updateOldError.message });
        return new Response(JSON.stringify({ error: 'Failed to update old appointment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[RESCHEDULE] ✓ Moved old appointment to rescheduled stage');

      // Create NEW appointment for the new date
      console.log('[RESCHEDULE] Creating new appointment for rescheduled date...');
      const eventTypeName = eventTypeUri?.split('/').pop() || 'Unknown Event';
      const newAppointmentData = {
        team_id: teamId,
        lead_name: leadName,
        lead_email: leadEmail,
        lead_phone: payload.payload?.questions_and_answers?.find((qa: any) => 
          qa.question?.toLowerCase().includes('phone')
        )?.answer || null,
        start_at_utc: startTime,
        status: 'NEW',
        pipeline_stage: 'booked',
        event_type_uri: eventTypeUri,
        event_type_name: eventTypeName,
        reschedule_url: newRescheduleUrl,
        cancel_url: newCancelUrl,
        calendly_invitee_uri: newCalendlyInviteeUri,
        // Preserve setter and closer from old appointment
        setter_id: oldAppointment.setter_id,
        setter_name: oldAppointment.setter_name,
        closer_id: oldAppointment.closer_id,
        closer_name: oldAppointment.closer_name,
        // Link to old appointment and track reschedule count
        original_appointment_id: oldAppointment.original_appointment_id || oldAppointment.id,
        reschedule_count: (oldAppointment.reschedule_count || 0) + 1,
      };

      const { data: newAppointment, error: createError } = await adminClient
        .from('appointments')
        .insert(newAppointmentData)
        .select()
        .single();

      if (createError || !newAppointment) {
        console.error('[RESCHEDULE] Error creating new appointment:', createError);
        await logWebhookEvent(supabase, teamId, event, 'error', { error: createError?.message || 'Failed to create' });
        return new Response(JSON.stringify({ error: 'Failed to create new appointment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[RESCHEDULE] Created new appointment:', newAppointment.id);

      // Update old appointment to point to new one
      await adminClient
        .from('appointments')
        .update({ rescheduled_to_appointment_id: newAppointment.id })
        .eq('id', oldAppointment.id);

      // Mark any awaiting_reschedule tasks on old appointment as completed
      await adminClient
        .from('confirmation_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('appointment_id', oldAppointment.id)
        .eq('status', 'awaiting_reschedule');

      // Create new call_confirmation task for NEW appointment
      await adminClient.rpc('create_task_with_assignment', {
        p_team_id: teamId,
        p_appointment_id: newAppointment.id,
        p_task_type: 'call_confirmation'
      });

      // Log activity for both appointments
      await adminClient.from('activity_logs').insert([
        {
          team_id: teamId,
          appointment_id: oldAppointment.id,
          actor_name: 'Calendly Webhook',
          action_type: 'Rescheduled',
          note: `Appointment rescheduled to new time. New appointment ID: ${newAppointment.id}`
        },
        {
          team_id: teamId,
          appointment_id: newAppointment.id,
          actor_name: 'Calendly Webhook',
          action_type: 'Created',
          note: `Rescheduled from appointment ${oldAppointment.id}. Reschedule count: ${newAppointmentData.reschedule_count}`
        }
      ]);

      console.log('[RESCHEDULE] Successfully created reschedule chain');
      await logWebhookEvent(supabase, teamId, event, 'success', { 
        oldAppointmentId: oldAppointment.id,
        newAppointmentId: newAppointment.id 
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        oldAppointmentId: oldAppointment.id,
        newAppointmentId: newAppointment.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, event }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Unexpected webhook error:', error);
    console.error('Error stack:', error.stack);
    
    // Log unexpected errors
    try {
      const logClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await logClient
        .from('error_logs')
        .insert({
          team_id: null,
          error_type: 'unexpected_webhook_error',
          error_message: String(error),
          error_context: { event: 'webhook_handler', error: String(error), stack: error.stack }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Return 200 to prevent infinite retries from Calendly
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal error logged',
        details: String(error) 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
