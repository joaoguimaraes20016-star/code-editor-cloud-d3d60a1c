import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, teamId } = await req.json();

    if (!url || !teamId) {
      throw new Error('URL and teamId are required');
    }

    console.log('Fetching CSV from URL:', url);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch team members for name matching
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('user_id, profiles(full_name)')
      .eq('team_id', teamId);

    console.log('Team members:', teamMembers);

    // Fetch the CSV file
    const csvResponse = await fetch(url);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch CSV: ${csvResponse.statusText}`);
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Parse header and data
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const dataLines = lines.slice(1);

    console.log('CSV Headers detected:', headers);

    // Find column indices
    const getColumnIndex = (possibleNames: string[]) => {
      return possibleNames
        .map(name => headers.indexOf(name))
        .find(idx => idx !== -1) ?? -1;
    };

    const customerIdx = getColumnIndex(['lead name', 'customer name', 'customer', 'prospect name', 'prospect']);
    const offerOwnerIdx = getColumnIndex(['offer owner', 'owner']);
    const setterIdx = getColumnIndex(['setter', 'setter name']);
    const closerIdx = getColumnIndex(['closer', 'closer name', 'sales rep', 'salesrep']);
    const dateIdx = getColumnIndex(['date of call', 'date', 'close date', 'closed date']);
    const revenueIdx = getColumnIndex(['revenue (total ticket)', 'revenue', 'amount', 'deal value']);
    const setterCommissionIdx = getColumnIndex(['commission $ (setter)', 'setter commission', 'setter comm']);
    const closerCommissionIdx = getColumnIndex(['commission $ (closer)', 'closer commission', 'closer comm', 'commission']);
    const statusIdx = getColumnIndex(['status']);
    const ccCollectedIdx = getColumnIndex(['cash collected', 'cc collected', 'cash']);
    const mrrIdx = getColumnIndex(['mrr', 'mrr amount', 'monthly recurring']);
    const mrrMonthsIdx = getColumnIndex(['mrr months', 'months', 'duration']);
    const emailIdx = getColumnIndex(['email', 'prospect email', 'customer email']);

    console.log('Column indices found:', {
      customerIdx,
      closerIdx,
      dateIdx,
      revenueIdx,
      setterIdx,
      statusIdx,
      ccCollectedIdx,
      mrrIdx,
      mrrMonthsIdx,
      emailIdx
    });

    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
      try {
        // Parse CSV line properly handling quotes
        const columns = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        columns.push(current.trim());

        // Log first row for debugging
        if (dataLines.indexOf(line) === 0) {
          console.log('First row columns:', columns);
          console.log('Number of columns:', columns.length);
        }

        const customerName = customerIdx >= 0 ? columns[customerIdx] : '';
        const rawSetter = setterIdx >= 0 ? columns[setterIdx] : '';
        const rawCloser = closerIdx >= 0 ? columns[closerIdx] : '';
        
        // Match names to team members (case-insensitive partial match)
        const findTeamMember = (name: string) => {
          if (!name) return null;
          const lowerName = name.toLowerCase().trim();
          return teamMembers?.find((tm: any) => 
            tm.profiles?.full_name?.toLowerCase().includes(lowerName) ||
            lowerName.includes(tm.profiles?.full_name?.toLowerCase())
          );
        };
        
        const setterMatch = findTeamMember(rawSetter);
        const closerMatch = findTeamMember(rawCloser);
        
        const setter = setterMatch ? (setterMatch.profiles as any).full_name : rawSetter;
        const closer = closerMatch ? (closerMatch.profiles as any).full_name : rawCloser;

        if (!customerName || !closer) {
          if (dataLines.indexOf(line) < 3) {
            console.log('Row', dataLines.indexOf(line), 'data:', { 
              customerName, 
              closer,
              customerIdx,
              closerIdx,
              columnsLength: columns.length,
              sample: columns.slice(0, 5)
            });
          }
          errorCount++;
          continue;
        }

        const offerOwner = offerOwnerIdx >= 0 ? columns[offerOwnerIdx] : '';
        
        // Parse date - skip row if invalid
        const rawDateValue = dateIdx >= 0 ? columns[dateIdx]?.trim() : '';
        console.log('Processing date:', rawDateValue, 'for customer:', customerName);
        
        if (rawDateValue && /^[a-zA-Z\s]+$/.test(rawDateValue)) {
          console.log('Skipping row - text in date field:', rawDateValue);
          errorCount++;
          continue;
        }

        let date = new Date().toISOString().split('T')[0];
        if (rawDateValue) {
          const parsedDate = new Date(rawDateValue);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString().split('T')[0];
          } else {
            console.log('Skipping row - invalid date:', rawDateValue);
            errorCount++;
            continue;
          }
        }

        const revenue = revenueIdx >= 0 ? parseFloat(columns[revenueIdx]?.replace(/[^0-9.-]/g, '')) || 0 : 0;
        const setterCommission = setterCommissionIdx >= 0 ? parseFloat(columns[setterCommissionIdx]?.replace(/[^0-9.-]/g, '')) || 0 : 0;
        const closerCommission = closerCommissionIdx >= 0 ? parseFloat(columns[closerCommissionIdx]?.replace(/[^0-9.-]/g, '')) || 0 : 0;
        const ccCollected = ccCollectedIdx >= 0 ? parseFloat(columns[ccCollectedIdx]?.replace(/[^0-9.-]/g, '')) || 0 : 0;
        const rawStatus = statusIdx >= 0 ? columns[statusIdx]?.toLowerCase().trim() : 'closed';
        // Map CSV status values to database allowed values: closed, pending, no-show
        let status = 'closed';
        if (rawStatus.includes('deposit') || rawStatus.includes('pending')) {
          status = 'pending';
        } else if (rawStatus.includes('not closed') || rawStatus.includes('no-show') || rawStatus.includes('no show')) {
          status = 'no-show';
        } else if (rawStatus.includes('closed')) {
          status = 'closed';
        }
        const mrr = mrrIdx >= 0 ? parseFloat(columns[mrrIdx]?.replace(/[^0-9.-]/g, '')) || 0 : 0;
        const mrrMonths = mrrMonthsIdx >= 0 ? parseInt(columns[mrrMonthsIdx]) || 0 : 0;
        const email = emailIdx >= 0 ? columns[emailIdx] : '';

        // Check for duplicate before inserting
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id')
          .eq('team_id', teamId)
          .eq('customer_name', customerName)
          .eq('date', date)
          .eq('sales_rep', closer)
          .maybeSingle();

        if (existingSale) {
          console.log('Skipping duplicate:', customerName, date);
          errorCount++;
          continue;
        }

        // Insert sale
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            team_id: teamId,
            customer_name: customerName,
            offer_owner: offerOwner,
            setter: setter || null,
            sales_rep: closer,
            date: date,
            revenue: revenue,
            setter_commission: setterCommission,
            commission: closerCommission,
            status: status,
          })
          .select()
          .single();

        if (saleError) {
          console.error('Sale insert error:', saleError);
          errorCount++;
          continue;
        }

        // Create appointment if email exists
        if (email && saleData) {
          await supabase.from('appointments').insert([{
            team_id: teamId,
            lead_name: customerName,
            lead_email: email,
            start_at_utc: new Date(date).toISOString(),
            event_type_name: 'Imported',
            closer_id: closerMatch?.user_id || null,
            closer_name: closer,
            setter_id: setterMatch?.user_id || null,
            setter_name: setter,
            status: 'CLOSED',
            revenue: revenue,
            mrr_amount: mrr > 0 ? mrr : null,
            mrr_months: mrrMonths > 0 ? mrrMonths : null,
          }]);
        }

        successCount++;
      } catch (rowError) {
        console.error('Error processing row:', rowError);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
