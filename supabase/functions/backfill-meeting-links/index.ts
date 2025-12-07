import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { teamId } = await req.json();

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: "teamId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team's Calendly credentials
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("calendly_access_token, calendly_refresh_token, calendly_token_expires_at")
      .eq("id", teamId)
      .single();

    if (teamError || !team?.calendly_access_token) {
      return new Response(
        JSON.stringify({ error: "Team not found or Calendly not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = team.calendly_access_token;

    // Check if token needs refresh
    if (team.calendly_token_expires_at && new Date(team.calendly_token_expires_at) < new Date()) {
      console.log("Token expired, refreshing...");
      const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-calendly-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ teamId }),
      });

      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Calendly token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
    }

    // Get appointments without meeting links that have calendly_invitee_uri
    const { data: appointments, error: apptError } = await supabase
      .from("appointments")
      .select("id, calendly_invitee_uri")
      .eq("team_id", teamId)
      .is("meeting_link", null)
      .not("calendly_invitee_uri", "is", null)
      .limit(100); // Process in batches

    if (apptError) {
      console.error("Error fetching appointments:", apptError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch appointments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments to backfill", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${appointments.length} appointments to backfill`);

    let updatedCount = 0;
    const errors: string[] = [];

    for (const appointment of appointments) {
      try {
        // Extract event UUID from invitee URI
        // Format: https://api.calendly.com/scheduled_events/{event_uuid}/invitees/{invitee_uuid}
        const inviteeUri = appointment.calendly_invitee_uri;
        const eventMatch = inviteeUri.match(/scheduled_events\/([^\/]+)/);
        
        if (!eventMatch) {
          console.log(`Could not extract event ID from: ${inviteeUri}`);
          continue;
        }

        const eventUuid = eventMatch[1];
        const eventUri = `https://api.calendly.com/scheduled_events/${eventUuid}`;

        // Fetch event details from Calendly
        const eventResponse = await fetch(eventUri, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!eventResponse.ok) {
          console.error(`Failed to fetch event ${eventUuid}:`, await eventResponse.text());
          errors.push(`Event ${eventUuid}: API error`);
          continue;
        }

        const eventData = await eventResponse.json();
        const resource = eventData.resource;

        // Extract meeting link from location
        let meetingLink: string | null = null;

        if (resource.location) {
          const location = resource.location;
          
          // Check join_url first (most common for video calls)
          if (location.join_url) {
            meetingLink = location.join_url;
          }
          // Check for Zoom integration
          else if (location.data?.extra?.zoom_meeting?.join_url) {
            meetingLink = location.data.extra.zoom_meeting.join_url;
          }
          // Check location string for URLs
          else if (location.location && typeof location.location === 'string') {
            const urlMatch = location.location.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
              meetingLink = urlMatch[0];
            }
          }
        }

        if (meetingLink) {
          const { error: updateError } = await supabase
            .from("appointments")
            .update({ meeting_link: meetingLink })
            .eq("id", appointment.id);

          if (updateError) {
            console.error(`Failed to update appointment ${appointment.id}:`, updateError);
            errors.push(`Appointment ${appointment.id}: Update failed`);
          } else {
            updatedCount++;
            console.log(`Updated appointment ${appointment.id} with meeting link`);
          }
        }

        // Rate limiting - Calendly has limits
        await new Promise((resolve) => setTimeout(resolve, 200));

      } catch (err: unknown) {
        console.error(`Error processing appointment ${appointment.id}:`, err);
        errors.push(`Appointment ${appointment.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Backfill complete`,
        total: appointments.length,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
