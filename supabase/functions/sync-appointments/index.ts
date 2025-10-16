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
    console.log('Syncing appointments for team:', teamId);

    // Get the team's Google Sheets URL
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('google_sheets_url')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError) {
      console.error('Error fetching team:', teamError);
      return new Response(
        JSON.stringify({ error: 'Error fetching team data: ' + teamError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!team || !team.google_sheets_url) {
      console.error('No Google Sheets URL configured for team:', teamId);
      return new Response(
        JSON.stringify({ error: 'No Google Sheets URL configured. Please add a URL in the Appointments settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching data from:', team.google_sheets_url);

    // Convert edit URL to CSV export URL if needed
    let csvUrl = team.google_sheets_url;
    if (csvUrl.includes('/edit')) {
      const match = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = csvUrl.match(/[#&]gid=(\d+)/);
      if (match) {
        const spreadsheetId = match[1];
        const gid = gidMatch ? gidMatch[1] : '0';
        csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        console.log('Converted to CSV URL:', csvUrl);
      }
    }

    // Fetch data from Google Sheets published CSV
    const sheetsResponse = await fetch(csvUrl);
    console.log('Sheets response status:', sheetsResponse.status);
    
    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error('Failed to fetch Google Sheets. Status:', sheetsResponse.status, 'Body:', errorText);
      throw new Error(`Failed to fetch Google Sheets (${sheetsResponse.status}). Make sure the URL is a published CSV link.`);
    }

    const csvText = await sheetsResponse.text();
    const rows = csvText.split('\n').slice(1); // Skip header row
    console.log('CSV rows found:', rows.length);
    
    const appointments = rows
      .filter((row: string) => row.trim())
      .map((row: string) => {
        const cells = row.split(',').map((cell: string) => cell.trim().replace(/^"|"$/g, ''));
        const [leadName, leadEmail, startAtUtc] = cells;
        
        if (!leadName || !leadEmail || !startAtUtc) {
          console.warn('Skipping invalid row:', row);
          return null;
        }
        
        // Parse and validate the date
        const parsedDate = new Date(startAtUtc);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date in row:', row, 'Date value:', startAtUtc);
          return null;
        }
        
        return {
          team_id: teamId,
          lead_name: leadName,
          lead_email: leadEmail,
          start_at_utc: parsedDate.toISOString(),
          status: 'NEW',
        };
      })
      .filter((apt): apt is NonNullable<typeof apt> => apt !== null);

    if (appointments.length === 0) {
      console.log('No valid appointments to import');
      return new Response(
        JSON.stringify({ success: true, count: 0, message: 'No appointments to import' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Inserting appointments:', appointments.length);

    // Get existing appointments to prevent duplicates
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('lead_email, start_at_utc')
      .eq('team_id', teamId);

    const existingSet = new Set(
      (existingAppointments || []).map(apt => 
        `${apt.lead_email}|${apt.start_at_utc}`
      )
    );

    // Filter out duplicates
    const newAppointments = appointments.filter(apt => {
      const key = `${apt.lead_email}|${apt.start_at_utc}`;
      return !existingSet.has(key);
    });

    if (newAppointments.length === 0) {
      console.log('All appointments already exist, no new ones to insert');
      return new Response(
        JSON.stringify({ 
          success: true, 
          count: 0, 
          message: 'All appointments already synced. No new appointments added.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('New appointments to insert:', newAppointments.length);

    // Insert appointments
    const { error: insertError } = await supabase
      .from('appointments')
      .insert(newAppointments);

    if (insertError) {
      console.error('Error inserting appointments:', insertError);
      throw insertError;
    }

    console.log(`Successfully synced ${newAppointments.length} new appointments for team ${teamId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: newAppointments.length,
        message: `Successfully synced ${newAppointments.length} new appointment${newAppointments.length === 1 ? '' : 's'}` 
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
