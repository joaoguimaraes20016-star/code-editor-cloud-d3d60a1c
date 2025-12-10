import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalendlyBookingData {
  event_uri?: string;
  invitee_uri?: string;
  event_start_time?: string;
  event_end_time?: string;
  invitee_name?: string;
  invitee_email?: string;
}

interface FunnelLeadRequest {
  funnel_id: string
  lead_id?: string // For updating existing leads
  answers: Record<string, any>
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  calendly_booking?: CalendlyBookingData
  is_complete?: boolean // Whether this is the final submission
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
    const { funnel_id, lead_id, answers, utm_source, utm_medium, utm_campaign, calendly_booking, is_complete } = body

    console.log('Received funnel lead submission:', { 
      funnel_id, 
      lead_id, 
      utm_source, 
      has_calendly: !!calendly_booking,
      is_complete 
    })

    if (!funnel_id || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: funnel_id and answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the funnel to validate and get settings
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id, team_id, status, settings, name, auto_create_contact, webhook_urls, zapier_webhook_url')
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

    // Extract email, phone, name, opt-in from answers
    let email: string | null = null
    let phone: string | null = null
    let name: string | null = null
    let optInStatus: boolean | null = null
    let optInTimestamp: string | null = null

    for (const [stepId, answer] of Object.entries(answers)) {
      const value = typeof answer === 'object' && answer !== null ? answer.value : answer
      const stepType = typeof answer === 'object' && answer !== null ? answer.step_type : null

      // Email capture step
      if (stepType === 'email_capture' && typeof value === 'string' && value.includes('@')) {
        email = value
      }

      // Phone capture step
      if (stepType === 'phone_capture' && typeof value === 'string') {
        phone = value
      }

      // Opt-in step returns { name, email, phone, opt_in }
      if (stepType === 'opt_in' && typeof value === 'object') {
        if (value.email) email = value.email
        if (value.phone) phone = value.phone
        if (value.name) name = value.name
        // Check both opt_in and optIn for backwards compatibility
        if (value.opt_in !== undefined) {
          optInStatus = value.opt_in
          optInTimestamp = new Date().toISOString()
        } else if (value.optIn !== undefined) {
          optInStatus = value.optIn
          optInTimestamp = new Date().toISOString()
        }
      }

      // Text question that asks for name
      if (stepType === 'text_question' && !name && typeof value === 'string' && value.length > 0) {
        const content = typeof answer === 'object' ? answer.content : null
        if (content?.headline?.toLowerCase().includes('name')) {
          name = value
        }
      }
    }

    // Build calendly booking data if provided
    const calendlyBookingData = calendly_booking ? {
      event_uri: calendly_booking.event_uri,
      invitee_uri: calendly_booking.invitee_uri,
      event_start_time: calendly_booking.event_start_time,
      event_end_time: calendly_booking.event_end_time,
      invitee_name: calendly_booking.invitee_name,
      invitee_email: calendly_booking.invitee_email,
      booked_at: new Date().toISOString(),
    } : null

    // If we got email from Calendly, use it
    if (calendly_booking?.invitee_email && !email) {
      email = calendly_booking.invitee_email
    }
    if (calendly_booking?.invitee_name && !name) {
      name = calendly_booking.invitee_name
    }

    // Determine lead status based on data captured:
    // - 'started': Has answers but no email/phone yet (not a real lead)
    // - 'partial': Has email OR phone captured but not opted in
    // - 'lead': Has completed opt-in form (real lead)
    // - 'booked': Has Calendly booking
    let leadStatus = 'started'
    
    if (email || phone) {
      leadStatus = 'partial'
    }
    
    if (optInStatus === true && email) {
      leadStatus = 'lead'
    }
    
    if (is_complete) {
      if (calendly_booking) {
        leadStatus = 'booked'
      } else if (optInStatus === true && email) {
        leadStatus = 'lead'
      }
    }

    let lead: any = null
    let contactId: string | null = null

    // Check if we're updating an existing lead or creating new
    if (lead_id) {
      // Update existing lead
      const { data: updatedLead, error: updateError } = await supabase
        .from('funnel_leads')
        .update({
          answers,
          email: email || undefined,
          phone: phone || undefined,
          name: name || undefined,
          calendly_booking_data: calendlyBookingData || undefined,
          opt_in_status: optInStatus ?? undefined,
          opt_in_timestamp: optInTimestamp || undefined,
          status: leadStatus,
        })
        .eq('id', lead_id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating lead:', updateError)
        // If update fails, try to create new lead
      } else {
        lead = updatedLead
        console.log('Lead updated successfully:', lead.id)
      }
    }

    // Create new lead if no lead_id or update failed
    if (!lead) {
      const { data: newLead, error: insertError } = await supabase
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
          calendly_booking_data: calendlyBookingData,
          opt_in_status: optInStatus,
          opt_in_timestamp: optInTimestamp,
          status: leadStatus,
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
      lead = newLead
      console.log('Lead created successfully:', lead.id)
    }

    // Only create/update contact and send webhooks on complete submission
    if (is_complete) {
      // Auto-create contact if enabled
      if (funnel.auto_create_contact !== false && (email || phone)) {
        // Check if contact already exists by email
        let existingContact = null
        if (email) {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('team_id', funnel.team_id)
            .eq('email', email)
            .maybeSingle()
          existingContact = existing
        }

        if (existingContact) {
          // Update existing contact
          const { error: updateContactError } = await supabase
            .from('contacts')
            .update({
              funnel_lead_id: lead.id,
              name: name || undefined,
              phone: phone || undefined,
              opt_in: optInStatus ?? undefined,
              calendly_booked_at: calendly_booking?.event_start_time || undefined,
              custom_fields: answers,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingContact.id)
          
          if (!updateContactError) {
            contactId = existingContact.id
            console.log('Updated existing contact:', contactId)
          }
        } else {
          // Create new contact
          const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              team_id: funnel.team_id,
              funnel_lead_id: lead.id,
              name,
              email,
              phone,
              opt_in: optInStatus ?? false,
              source: `Funnel: ${funnel.name}`,
              calendly_booked_at: calendly_booking?.event_start_time || null,
              custom_fields: answers,
            })
            .select('id')
            .single()
          
          if (!contactError && contact) {
            contactId = contact.id
            console.log('Created new contact:', contactId)
          } else {
            console.error('Error creating contact:', contactError)
          }
        }
      }

      // Prepare webhook payload
      const webhookPayload: Record<string, any> = {
        lead_id: lead.id,
        contact_id: contactId,
        email,
        phone,
        name,
        source: `Funnel: ${funnel.name}`,
        funnel_id: funnel_id,
        funnel_name: funnel.name,
        utm_source,
        utm_medium,
        utm_campaign,
        opt_in: optInStatus,
        opt_in_timestamp: optInTimestamp,
        custom_fields: answers,
        calendly_booked: !!calendly_booking,
        calendly_event_time: calendly_booking?.event_start_time || null,
        calendly_event_uri: calendly_booking?.event_uri || null,
        submitted_at: new Date().toISOString(),
      }

      // Send to GHL webhook if configured
      const ghlWebhookUrl = funnel.settings?.ghl_webhook_url
      if (ghlWebhookUrl) {
        console.log('Sending to GHL webhook:', ghlWebhookUrl)
        try {
          const ghlResponse = await fetch(ghlWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          })

          if (ghlResponse.ok) {
            console.log('GHL webhook successful')
            await supabase
              .from('funnel_leads')
              .update({ ghl_synced_at: new Date().toISOString() })
              .eq('id', lead.id)
          } else {
            console.error('GHL webhook failed:', await ghlResponse.text())
          }
        } catch (ghlError) {
          console.error('GHL webhook error:', ghlError)
        }
      }

      // Send to Zapier webhook if configured
      if (funnel.zapier_webhook_url) {
        console.log('Sending to Zapier webhook')
        try {
          await fetch(funnel.zapier_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          })
          console.log('Zapier webhook sent')
        } catch (zapierError) {
          console.error('Zapier webhook error:', zapierError)
        }
      }

      // Send to additional webhook URLs if configured
      const webhookUrls = funnel.webhook_urls || []
      for (const webhookUrl of webhookUrls) {
        if (webhookUrl && typeof webhookUrl === 'string') {
          console.log('Sending to custom webhook:', webhookUrl)
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload),
            })
          } catch (webhookError) {
            console.error('Custom webhook error:', webhookError)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        contact_id: contactId,
      }),
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