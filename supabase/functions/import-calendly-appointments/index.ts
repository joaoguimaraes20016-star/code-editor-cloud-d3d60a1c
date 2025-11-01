import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendlyEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  event: string;
  questions_and_answers?: Array<{
    question?: string;
    answer?: string;
  }>;
  tracking?: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client for non-insert operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-my-custom-header': 'no-auth-injection'
          }
        }
      }
    );

    const { teamId, eventTypeUri } = await req.json();

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'Team ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting import for team:', teamId, 'Event Type:', eventTypeUri || 'ALL');

    console.log('Starting import for team:', teamId);

    // Fetch team's Calendly credentials and selected event types
    const { data: team, error: teamError } = await supabaseClient
      .from('teams')
      .select('calendly_access_token, calendly_refresh_token, calendly_token_expires_at, calendly_organization_uri, calendly_event_types')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      console.error('Error fetching team:', teamError);
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!team.calendly_access_token || !team.calendly_organization_uri) {
      return new Response(
        JSON.stringify({ error: 'Calendly not configured for this team' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired or about to expire (within 5 minutes)
    let accessToken = team.calendly_access_token;
    if (team.calendly_token_expires_at) {
      const expiresAt = new Date(team.calendly_token_expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Access token expired or expiring soon, refreshing...');
        
        // Call refresh function
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

        // Fetch updated token
        const { data: updatedTeam } = await supabaseClient
          .from('teams')
          .select('calendly_access_token')
          .eq('id', teamId)
          .single();
        
        accessToken = updatedTeam?.calendly_access_token || accessToken;
        console.log('Token refreshed successfully');
      }
    }

    const organizationUri = team.calendly_organization_uri;

    // Fetch ONLY upcoming scheduled events from Calendly
    const now = new Date();
    const calendlyEventsUrl = `https://api.calendly.com/scheduled_events?organization=${encodeURIComponent(organizationUri)}&status=active&min_start_time=${encodeURIComponent(now.toISOString())}&count=100`;

    console.log('Fetching upcoming scheduled events from Calendly...');
    const eventsResponse = await fetch(calendlyEventsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('Calendly API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events from Calendly' }),
        { status: eventsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all pages of events (pagination support)
    let allEvents: CalendlyEvent[] = [];
    let nextPageUrl: string | null = calendlyEventsUrl;

    while (nextPageUrl) {
      const pageResponse: Response = await fetch(nextPageUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pageResponse.ok) {
        console.error('Calendly API error on pagination');
        break;
      }

      const pageData: any = await pageResponse.json();
      const pageEvents: CalendlyEvent[] = pageData.collection || [];
      allEvents = allEvents.concat(pageEvents);
      
      // Check for next page
      nextPageUrl = pageData.pagination?.next_page || null;
      
      console.log(`Fetched ${pageEvents.length} events, total so far: ${allEvents.length}`);
    }
    
    console.log(`Found ${allEvents.length} total scheduled events`);

    // Filter by event type if specified OR by team's selected event types
    const selectedEventTypes = team.calendly_event_types;
    if (eventTypeUri) {
      allEvents = allEvents.filter(event => event.event_type === eventTypeUri);
      console.log(`After filtering by specific event type: ${allEvents.length} events`);
    } else if (selectedEventTypes && Array.isArray(selectedEventTypes) && selectedEventTypes.length > 0) {
      allEvents = allEvents.filter(event => selectedEventTypes.includes(event.event_type));
      console.log(`After filtering by team's selected event types: ${allEvents.length} events`);
    }

    let importedCount = 0;
    let skippedCount = 0;
    const appointmentsToInsert: any[] = [];

    // Fetch all team members for closer matching (any role can be a meeting host)
    const { data: allTeamMembers } = await supabaseClient
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    const allMemberIds = allTeamMembers?.map(m => m.user_id) || [];
    
    const { data: closers } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', allMemberIds);

    // Fetch all team members with booking codes (for setter auto-assignment)
    const { data: teamMembers } = await supabaseClient
      .from('team_members')
      .select('user_id, booking_code')
      .eq('team_id', teamId)
      .not('booking_code', 'is', null);

    const { data: memberProfiles } = await supabaseClient
      .from('profiles')
      .select('id, full_name')
      .in('id', teamMembers?.map(m => m.user_id) || []);

    // Fetch ALL existing appointments at once to avoid repeated DB queries
    const { data: existingAppointments } = await supabaseClient
      .from('appointments')
      .select('lead_email, start_at_utc')
      .eq('team_id', teamId);

    // Create a Set for O(1) duplicate lookups
    const existingAppointmentKeys = new Set(
      existingAppointments?.map(a => `${a.lead_email}|${a.start_at_utc}`) || []
    );

    console.log(`Found ${existingAppointmentKeys.size} existing appointments in database`);

    // Process each event
    for (const event of allEvents) {
      try {
        // Fetch event details ONCE per event (not per invitee) - major performance gain
        const eventDetailsResponse = await fetch(event.uri, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!eventDetailsResponse.ok) {
          console.error(`Failed to fetch event details for ${event.uri}`);
          continue;
        }

        const eventDetails = await eventDetailsResponse.json();
        const eventMemberships = eventDetails.resource?.event_memberships || [];
        
        // Determine closer info once per event
        let closerId = null;
        let closerName = null;

          // Match closer using same 3-tier logic as webhook
          if (eventMemberships.length > 0) {
            const organizer = eventMemberships[0];
            const organizerEmail = organizer.user_email?.toLowerCase();
            const organizerName = organizer.user_name?.toLowerCase();

            console.log(`Matching organizer: ${organizerEmail} / ${organizerName}`);

            // Method 1: Exact email match
            const exactMatch = closers?.find(c => c.email?.toLowerCase() === organizerEmail);
            if (exactMatch) {
              closerId = exactMatch.id;
              closerName = exactMatch.full_name;
              console.log(`✓ Exact email match: ${closerName}`);
            }

            // Method 2: Partial email match (username part)
            if (!closerId && organizerEmail) {
              const organizerUsername = organizerEmail.split('@')[0];
              const partialMatch = closers?.find(c => {
                const closerUsername = c.email?.toLowerCase().split('@')[0];
                return closerUsername === organizerUsername;
              });
              if (partialMatch) {
                closerId = partialMatch.id;
                closerName = partialMatch.full_name;
                console.log(`✓ Partial email match: ${closerName}`);
              }
            }

            // Method 3: Name-based matching
            if (!closerId && organizerName) {
              const nameMatches = closers?.map(c => {
                const closerNameLower = c.full_name?.toLowerCase() || '';
                let score = 0;
                if (closerNameLower === organizerName) score = 2;
                else if (closerNameLower.includes(organizerName) || organizerName.includes(closerNameLower)) score = 1;
                return { closer: c, score };
              }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

              if (nameMatches && nameMatches.length > 0) {
                closerId = nameMatches[0].closer.id;
                closerName = nameMatches[0].closer.full_name;
                console.log(`✓ Name match: ${closerName} (score: ${nameMatches[0].score})`);
              }
            }
          }

        // Fetch event type name once per event
        let eventTypeName = event.name;
        if (event.event_type) {
          const eventTypeResponse = await fetch(event.event_type, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          if (eventTypeResponse.ok) {
            const eventTypeData = await eventTypeResponse.json();
            eventTypeName = eventTypeData.resource?.name || event.name;
          }
        }

        // Now fetch invitees and process them
        const inviteesUrl = `${event.uri}/invitees`;
        const inviteesResponse = await fetch(inviteesUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!inviteesResponse.ok) {
          console.error(`Failed to fetch invitees for event ${event.uri}`);
          continue;
        }

        const inviteesData = await inviteesResponse.json();
        const invitees: CalendlyInvitee[] = inviteesData.collection || [];

        for (const invitee of invitees) {
          // Skip duplicates using Set (fast O(1) lookup)
          const appointmentKey = `${invitee.email}|${event.start_time}`;
          if (existingAppointmentKeys.has(appointmentKey)) {
            console.log(`Skipping duplicate: ${invitee.email} at ${event.start_time}`);
            skippedCount++;
            continue;
          }

          // Fetch full invitee details to get reschedule_url and cancel_url
          let rescheduleUrl = null;
          let cancelUrl = null;
          let calendlyInviteeUri = invitee.uri;
          
          try {
            const inviteeUuid = invitee.uri?.split('/').pop();
            const eventUuid = event.uri?.split('/').pop();
            
            if (inviteeUuid && eventUuid) {
              const inviteeDetailsResponse = await fetch(
                `https://api.calendly.com/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              if (inviteeDetailsResponse.ok) {
                const inviteeDetailsData = await inviteeDetailsResponse.json();
                rescheduleUrl = inviteeDetailsData.resource?.reschedule_url || null;
                cancelUrl = inviteeDetailsData.resource?.cancel_url || null;
                calendlyInviteeUri = inviteeDetailsData.resource?.uri || invitee.uri;
                console.log(`✓ Fetched URLs for ${invitee.email}: reschedule=${!!rescheduleUrl}`);
              }
            }
          } catch (inviteeError) {
            console.error(`Failed to fetch invitee details for ${invitee.uri}:`, inviteeError);
          }

          // Extract phone number from questions_and_answers
          let leadPhone = null;
          if (invitee.questions_and_answers && Array.isArray(invitee.questions_and_answers)) {
            const phoneQuestion = invitee.questions_and_answers.find((qa: any) => 
              qa.question?.toLowerCase().includes('phone') || 
              qa.question?.toLowerCase().includes('number')
            );
            if (phoneQuestion?.answer) {
              leadPhone = phoneQuestion.answer;
            }
          }

          // Auto-assign setter based on UTM parameters (same logic as webhook)
          let setterId = null;
          let setterName = null;

          if (invitee.tracking?.utm_source) {
            const utmSource = invitee.tracking.utm_source.toLowerCase();
            const setterMatch = utmSource.match(/setter[_-]?(.+)/i);
            
            if (setterMatch) {
              const bookingCode = setterMatch[1];
              console.log(`Found setter booking code in UTM: ${bookingCode}`);

              const teamMember = teamMembers?.find(tm => 
                tm.booking_code?.toLowerCase() === bookingCode.toLowerCase()
              );

              if (teamMember) {
                setterId = teamMember.user_id;
                const profile = memberProfiles?.find(p => p.id === teamMember.user_id);
                setterName = profile?.full_name || null;
                console.log(`✓ Auto-assigned setter: ${setterName}`);
              }
            }
          }

          // Determine status - NEW until setter confirms, CANCELLED if not active
          let appointmentStatus: 'NEW' | 'CONFIRMED' | 'CANCELLED' = 'NEW';

          // Check if event was cancelled in Calendly
          if (invitee.status !== 'active' || event.status !== 'active') {
            appointmentStatus = 'CANCELLED';
          } 
          // For future events, keep as NEW until setter confirms via task
          else if (invitee.status === 'active') {
            appointmentStatus = 'NEW';
          }

          // Add to batch instead of inserting one by one - explicitly map only valid columns
          appointmentsToInsert.push({
            team_id: teamId,
            lead_name: invitee.name,
            lead_email: invitee.email,
            lead_phone: leadPhone || null,
            start_at_utc: event.start_time,
            closer_id: closerId || null,
            closer_name: closerName || null,
            setter_id: setterId || null,
            setter_name: setterName || null,
            event_type_uri: event.event_type || null,
            event_type_name: eventTypeName || null,
            status: appointmentStatus,
            pipeline_stage: 'booked', // Auto-assign to Appointment Booked stage
            reschedule_url: rescheduleUrl,
            cancel_url: cancelUrl,
            calendly_invitee_uri: calendlyInviteeUri,
          });
          importedCount++;
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.uri}:`, eventError);
        continue;
      }
    }

    // Check for duplicates before inserting
    if (appointmentsToInsert.length > 0) {
      console.log(`Checking for duplicates among ${appointmentsToInsert.length} appointments...`);
      
      // Get existing appointments for this team
      const { data: existingAppointments, error: fetchError } = await supabaseClient
        .from('appointments')
        .select('lead_email, start_at_utc')
        .eq('team_id', teamId);

      if (fetchError) {
        console.error('Error fetching existing appointments:', fetchError);
      }

      // Create a set of existing appointment keys for fast lookup
      // Normalize timestamps to ISO format without milliseconds for comparison
      const existingKeys = new Set(
        (existingAppointments || []).map(apt => {
          const timestamp = new Date(apt.start_at_utc).toISOString().split('.')[0];
          return `${apt.lead_email.toLowerCase()}|${timestamp}`;
        })
      );

      // Filter out duplicates
      const uniqueAppointments = appointmentsToInsert.filter(apt => {
        const timestamp = new Date(apt.start_at_utc).toISOString().split('.')[0];
        const key = `${apt.lead_email.toLowerCase()}|${timestamp}`;
        const isDuplicate = existingKeys.has(key);
        if (isDuplicate) {
          console.log(`✓ Skipping duplicate: ${apt.lead_email} at ${timestamp}`);
        }
        return !isDuplicate;
      });

      const duplicatesSkipped = appointmentsToInsert.length - uniqueAppointments.length;
      
      // Update counts to reflect actual duplicates found
      importedCount = uniqueAppointments.length;
      skippedCount += duplicatesSkipped;
      
      if (duplicatesSkipped > 0) {
        console.log(`⚠️ Skipped ${duplicatesSkipped} duplicate appointments`);
      }
      // Batch insert only unique appointments using service role client
      if (uniqueAppointments.length > 0) {
        console.log(`Batch inserting ${uniqueAppointments.length} unique appointments...`);
        
        // Create admin client with service role to bypass RLS
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

        // Direct insert bypassing triggers - use raw SQL to set session_replication_role
        const { data: insertedData, error: insertError } = await adminClient
          .from('appointments')
          .insert(uniqueAppointments)
          .select();

        if (insertError) {
          console.error('Batch insert error:', insertError);
          return new Response(
            JSON.stringify({ error: `Failed to insert appointments: ${insertError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`✓ Successfully inserted ${insertedData?.length || 0} unique appointments`);
      } else {
        console.log('No new appointments to insert (all were duplicates)');
      }
    }

    console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: importedCount,
        skipped: skippedCount,
        total: allEvents.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-calendly-appointments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
