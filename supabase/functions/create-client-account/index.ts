import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { email, password, fullName, clientAssetId } = await req.json();

    console.log('Creating client account for:', email);

    // Create the user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('User created:', userId);

    // Create the team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: `${fullName}'s Team`,
        created_by: userId,
      })
      .select()
      .single();

    if (teamError) {
      console.error('Team creation error:', teamError);
      throw teamError;
    }

    const teamId = teamData.id;
    console.log('Team created:', teamId);

    // Add user to team as offer_owner (which includes owner permissions)
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role: 'offer_owner',
      });

    if (memberError) {
      console.error('Team member error:', memberError);
      throw memberError;
    }

    console.log('User assigned as offer_owner');

    // Update the client asset to link to this team and user
    const { error: assetError } = await supabase
      .from('client_assets')
      .update({
        team_id: teamId,
        last_updated_by: userId,
      })
      .eq('id', clientAssetId);

    if (assetError) {
      console.error('Asset update error:', assetError);
      throw assetError;
    }

    console.log('Client asset linked to team');

    // Create audit log
    await supabase.from('client_asset_audit_logs').insert({
      client_asset_id: clientAssetId,
      user_id: userId,
      action: 'account_created',
      details: { 
        email,
        team_id: teamId,
        created_at: new Date().toISOString() 
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        teamId,
        message: 'Account created successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});