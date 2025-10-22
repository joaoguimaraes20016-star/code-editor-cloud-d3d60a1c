import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { assetId } = await req.json()

    // Get the client asset
    const { data: asset, error: assetError } = await supabaseClient
      .from('client_assets')
      .select('*, created_by')
      .eq('id', assetId)
      .single()

    if (assetError) throw assetError

    // Check if creator is already a team member
    const { data: existingMember } = await supabaseClient
      .from('team_members')
      .select('id')
      .eq('team_id', asset.team_id)
      .eq('user_id', asset.created_by)
      .single()

    // Add creator as admin if not already a member
    if (!existingMember) {
      const { error: memberError } = await supabaseClient
        .from('team_members')
        .insert({
          team_id: asset.team_id,
          user_id: asset.created_by,
          role: 'admin'
        })

      if (memberError) throw memberError

      console.log(`Added creator ${asset.created_by} as admin to team ${asset.team_id}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})