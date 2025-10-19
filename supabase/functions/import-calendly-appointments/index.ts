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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { teamId } = await req.json();

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'Team ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting import for team:', teamId);

    // Fetch team's Calendly credentials
    const { data: team, error: teamError } = await supabaseClient
      .from('teams')
      .select('calendly_access_token, calendly_organization_uri')
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

    const accessToken = team.calendly_access_token;
    const organizationUri = team.calendly_organization_uri;

    // Fetch scheduled events from Calendly (past 6 months + future)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000)).toISOString();
    const calendlyEventsUrl = `https://api.calendly.com/scheduled_events?organization=${encodeURIComponent(organizationUri)}&status=active&min_start_time=${encodeURIComponent(sixMonthsAgo)}&count=100`;

    console.log('Fetching scheduled events from Calendly...');
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

    let importedCount = 0;
    let skippedCount = 0;

    // Fetch all closers for this team (same logic as webhook)
    const { data: closerMembers } = await supabaseClient
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('role', 'closer');

    const closerIds = closerMembers?.map(m => m.user_id) || [];
    
    const { data: closers } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', closerIds);

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

          // Determine status based on event timing and Calendly data
          let appointmentStatus: 'NEW' | 'CONFIRMED' | 'NO_SHOW' | 'CANCELLED' = 'NEW';

          const eventStartTime = new Date(event.start_time);
          const isPastEvent = eventStartTime < now;

          // Check if event was cancelled in Calendly (invitee status is 'active' or 'canceled')
          if (invitee.status !== 'active' || event.status !== 'active') {
            appointmentStatus = 'CANCELLED';
          } 
          // For past events without cancellation, mark as NO_SHOW by default
          else if (isPastEvent) {
            appointmentStatus = 'NO_SHOW';
          } 
          // For future events, mark as CONFIRMED if invitee confirmed
          else if (invitee.status === 'active') {
            appointmentStatus = 'CONFIRMED';
          }

          console.log(`Event status for ${invitee.name} at ${event.start_time}: ${appointmentStatus} (past: ${isPastEvent})`);

          // Insert appointment with same data structure as webhook
          const { error: insertError } = await supabaseClient
            .from('appointments')
            .insert({
              team_id: teamId,
              lead_name: invitee.name,
              lead_email: invitee.email,
              start_at_utc: event.start_time,
              closer_id: closerId,
              closer_name: closerName,
              setter_id: setterId,
              setter_name: setterName,
              event_type_uri: event.event_type,
              event_type_name: eventTypeName,
              status: appointmentStatus,
            });

          if (insertError) {
            console.error(`Error inserting appointment: ${insertError.message}`);
          } else {
            importedCount++;
            console.log(`✓ Imported: ${invitee.name} (${invitee.email}) at ${event.start_time}`);
          }
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.uri}:`, eventError);
        continue;
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
