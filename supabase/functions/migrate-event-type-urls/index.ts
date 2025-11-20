import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting event type URL migration...');

    // Get all teams with calendly configuration
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, calendly_access_token, calendly_event_types, calendly_organization_uri')
      .not('calendly_access_token', 'is', null)
      .not('calendly_event_types', 'is', null);

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    console.log(`Found ${teams?.length || 0} teams to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const team of teams || []) {
      try {
        console.log(`Processing team ${team.id}...`);
        
        const eventTypes = team.calendly_event_types || [];
        
        // Check if already using API URIs
        const needsMigration = eventTypes.some((url: string) => 
          !url.includes('/event_types/')
        );

        if (!needsMigration) {
          console.log(`Team ${team.id} already using API URIs, skipping`);
          skippedCount++;
          results.push({
            team_id: team.id,
            status: 'skipped',
            message: 'Already using API URIs'
          });
          continue;
        }

        // Fetch all event types from Calendly API
        const eventTypesResponse = await fetch(
          `https://api.calendly.com/event_types?organization=${encodeURIComponent(team.calendly_organization_uri)}`,
          {
            headers: {
              'Authorization': `Bearer ${team.calendly_access_token}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!eventTypesResponse.ok) {
          throw new Error(`Calendly API error: ${await eventTypesResponse.text()}`);
        }

        const eventTypesData = await eventTypesResponse.json();
        const allEventTypes = eventTypesData.collection || [];

        // Convert scheduling URLs to API URIs
        const migratedEventTypes = eventTypes.map((url: string) => {
          // If already an API URI, keep it
          if (url.includes('/event_types/')) {
            return url;
          }

          // Extract slug from scheduling URL (e.g., "appointment-30min" from "https://calendly.com/user/appointment-30min")
          const slug = url.split('/').pop();
          
          // Find matching event type by slug
          const matchingEvent = allEventTypes.find((et: any) => 
            et.slug === slug || et.scheduling_url === url
          );

          if (matchingEvent) {
            console.log(`Converted ${url} -> ${matchingEvent.uri}`);
            return matchingEvent.uri;
          }

          // If no match found, keep original (shouldn't happen but safe fallback)
          console.warn(`Could not find API URI for ${url}, keeping original`);
          return url;
        });

        // Update team with new event types
        const { error: updateError } = await supabase
          .from('teams')
          .update({ calendly_event_types: migratedEventTypes })
          .eq('id', team.id);

        if (updateError) {
          throw new Error(`Failed to update team: ${updateError.message}`);
        }

        console.log(`Successfully migrated team ${team.id}`);
        migratedCount++;
        results.push({
          team_id: team.id,
          status: 'success',
          original_count: eventTypes.length,
          migrated_count: migratedEventTypes.length
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing team ${team.id}:`, error);
        results.push({
          team_id: team.id,
          status: 'error',
          error: errorMessage
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete: ${migratedCount} teams migrated, ${skippedCount} teams skipped`,
        migrated: migratedCount,
        skipped: skippedCount,
        total: teams?.length || 0,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
