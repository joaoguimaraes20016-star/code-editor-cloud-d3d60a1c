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

    const { teamId } = await req.json();

    // Get the team's Google Sheets URL
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('google_sheets_url')
      .eq('id', teamId)
      .single();

    if (teamError || !team?.google_sheets_url) {
      console.error('No Google Sheets URL configured:', teamError);
      return new Response(
        JSON.stringify({ error: 'No Google Sheets URL configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch data from Google Sheets published CSV
    const sheetsResponse = await fetch(team.google_sheets_url);
    if (!sheetsResponse.ok) {
      throw new Error('Failed to fetch Google Sheets data');
    }

    const csvText = await sheetsResponse.text();
    const rows = csvText.split('\n').slice(1); // Skip header row
    
    const appointments = rows
      .filter(row => row.trim())
      .map(row => {
        const [leadName, leadEmail, startAtUtc] = row.split(',').map(cell => cell.trim());
        return {
          team_id: teamId,
          lead_name: leadName,
          lead_email: leadEmail,
          start_at_utc: new Date(startAtUtc).toISOString(),
          status: 'NEW',
        };
      });

    if (appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No appointments to import' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert appointments
    const { error: insertError } = await supabase
      .from('appointments')
      .insert(appointments);

    if (insertError) {
      console.error('Error inserting appointments:', insertError);
      throw insertError;
    }

    console.log(`Successfully synced ${appointments.length} appointments for team ${teamId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: appointments.length,
        message: `Successfully synced ${appointments.length} appointments` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-appointments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
