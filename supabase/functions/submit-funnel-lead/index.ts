import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FunnelLeadRequest {
  funnel_id: string
  answers: Record<string, any>
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: FunnelLeadRequest = await req.json()
    const { funnel_id, answers, utm_source, utm_medium, utm_campaign } = body

    console.log('Received funnel lead submission:', { funnel_id, utm_source })

    if (!funnel_id || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: funnel_id and answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the funnel to validate and get settings
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id, team_id, status, settings')
      .eq('id', funnel_id)
      .single()

    if (funnelError || !funnel) {
      console.error('Funnel not found:', funnelError)
      return new Response(
        JSON.stringify({ error: 'Funnel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (funnel.status !== 'published') {
      return new Response(
        JSON.stringify({ error: 'Funnel is not published' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract email, phone, name from answers
    let email: string | null = null
    let phone: string | null = null
    let name: string | null = null

    for (const [stepId, answer] of Object.entries(answers)) {
      const value = typeof answer === 'object' && answer !== null ? answer.value : answer
      const stepType = typeof answer === 'object' && answer !== null ? answer.step_type : null

      if (stepType === 'email_capture' || (typeof value === 'string' && value.includes('@'))) {
        email = value
      } else if (stepType === 'phone_capture') {
        phone = value
      } else if (stepType === 'text_question' && !name && typeof value === 'string' && value.length > 0) {
        // First text question might be the name
        const content = typeof answer === 'object' ? answer.content : null
        if (content?.headline?.toLowerCase().includes('name')) {
          name = value
        }
      }
    }

    // Insert the lead
    const { data: lead, error: insertError } = await supabase
      .from('funnel_leads')
      .insert({
        funnel_id,
        team_id: funnel.team_id,
        answers,
        email,
        phone,
        name,
        utm_source,
        utm_medium,
        utm_campaign,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting lead:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Lead saved successfully:', lead.id)

    // Check if GHL webhook is configured
    const ghlWebhookUrl = funnel.settings?.ghl_webhook_url

    if (ghlWebhookUrl) {
      console.log('Sending to GHL webhook:', ghlWebhookUrl)

      try {
        // Prepare GHL payload
        const ghlPayload: Record<string, any> = {
          email,
          phone,
          name,
          source: 'Funnel: ' + funnel_id,
          utm_source,
          utm_medium,
          utm_campaign,
          custom_fields: answers,
        }

        const ghlResponse = await fetch(ghlWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ghlPayload),
        })

        if (ghlResponse.ok) {
          console.log('GHL webhook successful')
          
          // Update lead with sync timestamp
          await supabase
            .from('funnel_leads')
            .update({ ghl_synced_at: new Date().toISOString() })
            .eq('id', lead.id)
        } else {
          console.error('GHL webhook failed:', await ghlResponse.text())
        }
      } catch (ghlError) {
        console.error('GHL webhook error:', ghlError)
        // Don't fail the request if GHL sync fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
