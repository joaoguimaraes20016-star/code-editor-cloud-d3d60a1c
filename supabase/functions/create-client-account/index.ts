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

    const body = await req.json();
    console.log('Received request body:', JSON.stringify({ ...body, password: '[REDACTED]' }));

    const { email, password, fullName, clientAssetId, teamName, accessToken } = body;

    // Validate required fields
    if (!clientAssetId) {
      return new Response(
        JSON.stringify({ error: 'Client asset ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the access token matches the client asset and is not expired
    const { data: assetValidation, error: validationError } = await supabase
      .from('client_assets')
      .select('id, access_token, token_expires_at, status')
      .eq('id', clientAssetId)
      .single();

    if (validationError || !assetValidation) {
      console.error('Asset validation error:', validationError);
      return new Response(
        JSON.stringify({ error: 'Invalid client asset' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the access token matches
    if (assetValidation.access_token !== accessToken) {
      console.error('Access token mismatch for asset:', clientAssetId);
      return new Response(
        JSON.stringify({ error: 'Invalid access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(assetValidation.token_expires_at) < new Date()) {
      console.error('Token expired for asset:', clientAssetId);
      return new Response(
        JSON.stringify({ error: 'Access token has expired. Please contact the team for a new link.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed
    if (assetValidation.status === 'complete') {
      console.log('Asset already completed:', clientAssetId);
      return new Response(
        JSON.stringify({ error: 'This onboarding has already been completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating client account for:', email);
    console.log('Team name:', teamName);
    console.log('Client asset ID:', clientAssetId);
    console.log('Full name:', fullName);

    // Validate team name
    if (!teamName || teamName.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Team name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (teamName.trim().length > 100) {
      return new Response(
        JSON.stringify({ error: 'Team name must be less than 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userId: string;
    let isNewUser = false;

    // Check if user already exists
    console.log('Checking for existing user...');
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    console.log('Existing user found:', !!existingUser);

    if (existingUser) {
      console.log('User already exists:', existingUser.id);
      userId = existingUser.id;
      isNewUser = false;
      
      // Update the user's password to the new one they just entered
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password }
      );
      
      if (updateError) {
        console.error('Password update error:', updateError);
        // Continue anyway - they might be using the same password
      } else {
        console.log('User password updated');
      }
    } else {
      // Create new user account
      console.log('Creating new user...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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

      userId = authData.user.id;
      isNewUser = true;
      console.log('User created successfully:', userId);
    }

    // Check if user already has a team
    console.log('Checking for existing team membership...');
    const { data: existingMembership, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.error('Membership check error:', membershipError);
      throw membershipError;
    }

    let teamId: string;

    if (existingMembership?.team_id) {
      // User already has a team
      teamId = existingMembership.team_id;
      console.log('Using existing team:', teamId);
    } else {
      // Create a new team with the provided name
      console.log('Creating new team with name:', teamName.trim());
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          created_by: userId,
        })
        .select()
        .single();

      if (teamError) {
        console.error('Team creation error:', teamError);
        console.error('Team error details:', JSON.stringify(teamError));
        throw teamError;
      }

      teamId = teamData.id;
      console.log('Team created successfully:', teamId);

      // Add user to team as offer_owner (they're creating their own workspace)
      console.log('Adding user to team as offer_owner...');
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId,
          role: 'offer_owner',
        });

      if (memberError) {
        console.error('Team member error:', memberError);
        console.error('Member error details:', JSON.stringify(memberError));
        throw memberError;
      }

      console.log('User assigned as admin successfully');
    }

    // Fetch the client asset to get the original creator
    const { data: assetData, error: assetFetchError } = await supabase
      .from('client_assets')
      .select('created_by')
      .eq('id', clientAssetId)
      .single();

    if (assetFetchError) {
      console.error('Asset fetch error:', assetFetchError);
      throw assetFetchError;
    }

    // Update the client asset to link to this team and user, and mark as complete
    const { error: assetError } = await supabase
      .from('client_assets')
      .update({
        team_id: teamId,
        last_updated_by: userId,
        status: 'complete',
      })
      .eq('id', clientAssetId);

    if (assetError) {
      console.error('Asset update error:', assetError);
      throw assetError;
    }

    console.log('Client asset linked to team');

    // Add the original creator to the team if they're not already a member
    if (assetData.created_by && assetData.created_by !== userId) {
      console.log('Adding original creator to team:', assetData.created_by);
      
      const { error: creatorMemberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: assetData.created_by,
          role: 'admin',
        });

      if (creatorMemberError) {
        console.error('Error adding creator to team:', creatorMemberError);
        // Don't throw - this is not critical enough to fail the whole operation
      } else {
        console.log('Original creator added to team successfully');
      }
    }

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
        isNewUser,
        message: isNewUser ? 'Account created successfully' : 'Account linked successfully' 
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