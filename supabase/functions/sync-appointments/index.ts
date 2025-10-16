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
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.log('No data rows in CSV');
      return new Response(
        JSON.stringify({ success: true, count: 0, message: 'No appointments to import' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse headers to find column indices
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const nameIndex = headers.findIndex(h => h.includes('name') && (h.includes('invitee') || h.includes('lead')));
    const emailIndex = headers.findIndex(h => h.includes('email'));
    const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('time') || h.includes('start') || h.includes('created'));
    const closerIndex = headers.findIndex(h => (h.includes('profile') && h.includes('name')) || h.includes('closer') || h.includes('meeting with') || h.includes('meeting_with'));

    console.log('CSV headers:', headers);
    console.log('Column indices - name:', nameIndex, 'email:', emailIndex, 'date:', dateIndex, 'closer:', closerIndex);

    if (nameIndex === -1 || emailIndex === -1 || dateIndex === -1) {
      throw new Error('CSV must have columns for name, email, and date/time');
    }

    const rows = lines.slice(1); // Skip header row
    console.log('CSV rows found:', rows.length);

    // Get team members to map closer names
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('user_id, profiles!inner(full_name)')
      .eq('team_id', teamId);

    console.log('Team members found:', teamMembers?.length || 0);
    
    const appointments = rows
      .filter((row: string) => row.trim())
      .map((row: string) => {
        const cells = row.split(',').map((cell: string) => cell.trim().replace(/^"|"$/g, ''));
        
        const leadName = cells[nameIndex];
        const leadEmail = cells[emailIndex];
        const startAtUtc = cells[dateIndex];
        const closerName = closerIndex !== -1 ? cells[closerIndex] : null;
        
        if (!leadName || !leadEmail || !startAtUtc) {
          console.warn('Skipping invalid row:', row);
          return null;
        }
        
        // Parse and validate the date
        let parsedDate: Date;
        
        // Check if it's an Excel serial date (number like 45945.85177)
        const excelSerialDate = parseFloat(startAtUtc);
        if (!isNaN(excelSerialDate) && startAtUtc === excelSerialDate.toString()) {
          // Convert Excel serial date to JavaScript Date
          // Excel serial date starts from 1900-01-01, and we need to subtract 1 because Excel incorrectly treats 1900 as a leap year
          const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
          parsedDate = new Date(excelEpoch.getTime() + excelSerialDate * 86400000);
        } else {
          // Try parsing as regular date string
          parsedDate = new Date(startAtUtc);
        }
        
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date in row:', row, 'Date value:', startAtUtc);
          return null;
        }

        // Find closer by name match (with fuzzy matching)
        let closerId = null;
        let closerFullName = null;
        
        if (closerName && teamMembers && teamMembers.length > 0) {
          console.log('Looking for closer:', closerName);
          console.log('Available team members:', teamMembers.map((m: any) => {
            const profiles = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return profiles?.full_name;
          }));
          
          // Normalize and split names into words for comparison
          const closerWords = closerName.toLowerCase().trim().split(/\s+/);
          
          // Try exact match first
          let closerMember = teamMembers.find((m: any) => {
            const profiles = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            const memberName = profiles?.full_name;
            return memberName?.toLowerCase().trim() === closerName.toLowerCase().trim();
          });
          
          // If no exact match, try fuzzy matching
          if (!closerMember) {
            let bestMatch = null;
            let highestScore = 0;
            
            for (const member of teamMembers) {
              const profiles = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
              const memberName = profiles?.full_name;
              if (!memberName) continue;
              
              const memberWords = memberName.toLowerCase().trim().split(/\s+/);
              
              // Calculate match score based on word overlap
              let matchedWords = 0;
              for (const closerWord of closerWords) {
                if (memberWords.some((mw: string) => mw.includes(closerWord) || closerWord.includes(mw))) {
                  matchedWords++;
                }
              }
              
              const score = matchedWords / closerWords.length;
              console.log(`Similarity between "${closerName}" and "${memberName}": ${score.toFixed(2)} (${matchedWords}/${closerWords.length} words matched)`);
              
              // If at least 50% of closer name words match, consider it
              if (score > highestScore && score >= 0.5) {
                highestScore = score;
                bestMatch = member;
              }
            }
            
            if (bestMatch) {
              closerMember = bestMatch;
              console.log(`Fuzzy matched closer with ${(highestScore * 100).toFixed(0)}% confidence`);
            }
          }
          
          if (closerMember) {
            closerId = closerMember.user_id;
            const profiles = Array.isArray(closerMember.profiles) ? closerMember.profiles[0] : closerMember.profiles;
            closerFullName = profiles?.full_name || null;
            console.log('Assigned closer:', closerFullName);
          } else {
            console.warn('No team member found for closer name:', closerName);
          }
        }
        
        return {
          team_id: teamId,
          lead_name: leadName,
          lead_email: leadEmail,
          start_at_utc: parsedDate.toISOString(),
          closer_id: closerId,
          closer_name: closerFullName,
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
    const { data: existingAppointments, error: fetchError } = await supabase
      .from('appointments')
      .select('lead_email, start_at_utc')
      .eq('team_id', teamId);

    if (fetchError) {
      console.error('Error fetching existing appointments:', fetchError);
    }

    console.log('Existing appointments count:', existingAppointments?.length || 0);

    // Create a set of existing appointment keys (email + normalized time)
    const existingSet = new Set(
      (existingAppointments || []).map(apt => {
        const normalizedTime = new Date(apt.start_at_utc).toISOString();
        const key = `${apt.lead_email.toLowerCase().trim()}|${normalizedTime}`;
        console.log('Existing key:', key);
        return key;
      })
    );

    // Filter out duplicates
    const newAppointments = appointments.filter(apt => {
      const normalizedTime = new Date(apt.start_at_utc).toISOString();
      const key = `${apt.lead_email.toLowerCase().trim()}|${normalizedTime}`;
      const isDuplicate = existingSet.has(key);
      console.log('Checking appointment:', key, 'Duplicate:', isDuplicate);
      return !isDuplicate;
    });

    console.log('New appointments after filtering:', newAppointments.length);

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
