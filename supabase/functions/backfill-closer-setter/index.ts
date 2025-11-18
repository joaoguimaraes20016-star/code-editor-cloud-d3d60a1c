import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { teamId } = await req.json();

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔧 Starting backfill for team: ${teamId}`);

    // Find offer_owner for closer assignment
    const { data: offerOwner } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('role', 'offer_owner')
      .eq('is_active', true)
      .maybeSingle();

    if (!offerOwner) {
      return new Response(
        JSON.stringify({ error: 'No offer_owner found in team' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: offerOwnerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', offerOwner.user_id)
      .maybeSingle();

    console.log(`✅ Found offer_owner: ${offerOwnerProfile?.full_name}`);

    // Find sole setter for setter assignment
    const { data: setters } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('role', 'setter')
      .eq('is_active', true);

    let setterId = null;
    let setterName = null;
    if (setters && setters.length === 1) {
      const { data: setterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', setters[0].user_id)
        .maybeSingle();
      
      setterId = setters[0].user_id;
      setterName = setterProfile?.full_name;
      console.log(`✅ Found sole setter: ${setterName}`);
    } else {
      console.log(`⚠️ Found ${setters?.length || 0} setters, skipping setter backfill`);
    }

    // Update appointments with null closer_id
    const updatePayload: any = {
      closer_id: offerOwner.user_id,
      closer_name: offerOwnerProfile?.full_name
    };

    // Only update setter if we found exactly one
    if (setterId && setterName) {
      updatePayload.setter_id = setterId;
      updatePayload.setter_name = setterName;
    }

    const { data: updated, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('team_id', teamId)
      .is('closer_id', null)
      .select();

    if (error) {
      console.error('Error updating appointments:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Updated ${updated?.length || 0} appointments`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updated?.length || 0,
        assignedCloser: offerOwnerProfile?.full_name,
        assignedSetter: setterName || 'No setter (multiple setters in team)',
        appointments: updated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
