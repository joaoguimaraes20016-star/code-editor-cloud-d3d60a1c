// supabase/functions/submit-funnel-lead/index.ts
// GHL-style behavior:
// - ALWAYS upsert the lead (draft saves allowed)
// - ONLY trigger automations on explicit submitMode === "submit"
// - Keep dedupe window to avoid double-submit inserts
// Constraints: no DB schema changes, do NOT touch automation-trigger

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubmitMode = "draft" | "submit";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json();

    // REQUIRED-ish
    const funnel_id: string = body.funnel_id;
    const lead_id: string | null = body.lead_id ?? null;

    // Lead data
    const answers = body.answers ?? {};
    const optInStatus = body.opt_in_status ?? null;
    const optInTimestamp = body.opt_in_timestamp ?? null;
    const last_step_index = body.last_step_index ?? null;

    // Contact info (may also be inferred from booking data)
    let email: string | null = body.email ?? null;
    let phone: string | null = body.phone ?? null;
    let name: string | null = body.name ?? null;

    // Booking data (optional)
    const calendly_booking = body.calendly_booking ?? null;
    const calendlyBookingData = body.calendly_booking_data ?? null;

  // NEW: explicit submit mode (draft vs submit)
  const submitMode: SubmitMode = (body.submitMode ?? "draft") as SubmitMode;
  
  // NEW: step semantics for backend safety net
  const step_id: string | null = body.step_id ?? null;
  const step_intent: string | null = body.step_intent ?? null;

  // For tracing + optional event id stability
  const clientRequestId: string | null = body.clientRequestId ?? null;
  
  // Compute effectiveSubmitMode: if submitMode is draft but step_intent is capture, upgrade to submit
  let effectiveSubmitMode: SubmitMode = submitMode;
  if (submitMode === "draft" && step_intent === "capture") {
    effectiveSubmitMode = "submit";
    console.log("[submit-funnel-lead] Safety net: upgrading draft->submit because step_intent=capture");
  }
  
  console.log(`[submit-funnel-lead] step_id=${step_id}, step_intent=${step_intent}, submitMode=${submitMode}, effectiveSubmitMode=${effectiveSubmitMode}, clientRequestId=${clientRequestId}`);

    if (!funnel_id) {
      return new Response(JSON.stringify({ error: "Missing funnel_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load funnel to get team_id etc.
    const { data: funnel, error: funnelErr } = await supabase
      .from("funnels")
      .select("*")
      .eq("id", funnel_id)
      .single();

    if (funnelErr || !funnel) {
      console.error("Error loading funnel:", funnelErr);
      return new Response(JSON.stringify({ error: "Funnel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Infer contact fields from booking if present
    // (keeps your existing behavior; safe if null)
    if (calendly_booking?.invitee_email && !email) email = calendly_booking.invitee_email;
    if (calendly_booking?.invitee_phone && !phone) phone = calendly_booking.invitee_phone;
    if (calendly_booking?.invitee_name && !name) name = calendly_booking.invitee_name;

    // Determine lead status based on data captured (same logic you had)
    // - 'visitor': Has answers but no contact info
    // - 'partial': Has some contact info but not all three
    // - 'lead': Has ALL THREE
    // - 'booked': Has booking AND is a real lead
    let leadStatus = "visitor";
    const hasAnyContactInfo = !!(email || phone || name);
    const isRealLead = !!(name && phone && email);

    if (hasAnyContactInfo && !isRealLead) leadStatus = "partial";
    if (isRealLead) leadStatus = "lead";

    if (calendly_booking && isRealLead) {
      leadStatus = "booked";
    } else if (calendly_booking) {
      leadStatus = "partial";
    }

    let lead: any = null;

    // 1) Update existing lead if lead_id provided
    if (lead_id) {
      const { data: updatedLead, error: updateError } = await supabase
        .from("funnel_leads")
        .update({
          answers,
          email: email || undefined,
          phone: phone || undefined,
          name: name || undefined,
          calendly_booking_data: calendlyBookingData || undefined,
          opt_in_status: optInStatus ?? undefined,
          opt_in_timestamp: optInTimestamp || undefined,
          status: leadStatus,
          last_step_index: last_step_index ?? undefined,
        })
        .eq("id", lead_id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating lead:", updateError);
      } else {
        lead = updatedLead;
        console.log("Lead updated successfully:", lead.id);
      }
    }

    // 2) Create new lead if no lead or update failed
    // Keep 10s dedupe window to prevent double-submit inserts
    let skipCreateBecauseRecent = false;
    if (!lead) {
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();

      if (email || phone) {
        let query = supabase
          .from("funnel_leads")
          .select("*")
          .eq("funnel_id", funnel_id)
          .eq("team_id", funnel.team_id)
          .gte("created_at", tenSecondsAgo);

        if (email && phone) {
          query = query.or(`email.eq.${email},phone.eq.${phone}`);
        } else if (email) {
          query = query.eq("email", email);
        } else if (phone) {
          query = query.eq("phone", phone);
        }

        const { data: recentLeads } = await query.limit(1);

        if (recentLeads && recentLeads.length > 0) {
          lead = recentLeads[0];
          skipCreateBecauseRecent = true;
          console.log(
            "Found recent lead within 10s dedupe window:",
            lead.id,
            "(will reuse; avoids duplicate inserts)"
          );
        }
      }

      if (!lead) {
        const { data: createdLead, error: createError } = await supabase
          .from("funnel_leads")
          .insert({
            funnel_id,
            team_id: funnel.team_id,
            answers,
            email: email || null,
            phone: phone || null,
            name: name || null,
            calendly_booking_data: calendlyBookingData || null,
            opt_in_status: optInStatus,
            opt_in_timestamp: optInTimestamp,
            status: leadStatus,
            last_step_index,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating lead:", createError);
          return new Response(JSON.stringify({ error: "Failed to create lead" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lead = createdLead;
        console.log("Lead created successfully");
      }
    }

  // NOW: check effectiveSubmitMode — only fire automation-trigger on "submit"
  if (effectiveSubmitMode === "submit") {
    const eventId = `lead_created:${lead.id}`;
    console.log("[submit-funnel-lead] Invoking automation-trigger with eventId:", eventId);

    // Fire-and-forget (we don't block the response on automation execution)
    supabase.functions.invoke("automation-trigger", {
      body: {
        triggerType: "lead_created",
        teamId: funnel.team_id,
        eventId,
        eventPayload: { lead },
      },
    }).catch((err: any) => {
      console.error("Failed to invoke automation-trigger:", err);
    });
  } else {
    console.log(`[submit-funnel-lead] effectiveSubmitMode=${effectiveSubmitMode}, skipping automation-trigger`);
  }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        lead,
        status: leadStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[submit-funnel-lead] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
