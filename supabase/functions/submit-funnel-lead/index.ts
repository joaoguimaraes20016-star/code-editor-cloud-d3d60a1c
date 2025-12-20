// supabase/functions/submit-funnel-lead/index.ts
// Canonical Funnel Lead Submission Handler
// GHL-style behavior:
// - ALWAYS upsert the lead (draft saves allowed)
// - ONLY trigger automations on explicit submitMode === "submit" OR step_intent === "capture"
// - Keep dedupe window to avoid double-submit inserts
// - Uses canonical step definitions for intent derivation

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubmitMode = "draft" | "submit";
type StepIntent = "capture" | "collect" | "schedule" | "complete";

// Canonical default intent derivation (mirrors frontend stepDefinitions.ts)
function getDefaultIntent(stepType: string): StepIntent {
  switch (stepType) {
    case 'opt_in':
    case 'email_capture':
    case 'phone_capture':
      return 'capture';
    case 'embed':
      return 'schedule';
    case 'thank_you':
      return 'complete';
    default:
      return 'collect';
  }
}

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

    const normalizeString = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const firstNonEmpty = (...values: (unknown | null | undefined)[]): string | null => {
      for (const v of values) {
        const normalized = normalizeString(v as string | null);
        if (normalized) return normalized;
      }
      return null;
    };

    const extractContactFromAnswers = (answers: any) => {
      let nameFromAnswers: string | null = null;
      let emailFromAnswers: string | null = null;
      let phoneFromAnswers: string | null = null;

      if (!answers || typeof answers !== "object") {
        return { nameFromAnswers, emailFromAnswers, phoneFromAnswers };
      }

      // Case 1: flat answers.name / answers.email / answers.phone
      nameFromAnswers = firstNonEmpty(
        answers.name,
        answers.full_name,
        answers.contact_name,
        answers.first_name && answers.last_name
          ? `${answers.first_name} ${answers.last_name}`
          : null,
      );
      emailFromAnswers = firstNonEmpty(
        answers.email,
        answers.email_address,
        answers.contact_email,
      );
      phoneFromAnswers = firstNonEmpty(
        answers.phone,
        answers.phone_number,
        answers.contact_phone,
      );

      // Case 2: per-step answers keyed by step id, with shape { value, ... }
      if (!nameFromAnswers || !emailFromAnswers || !phoneFromAnswers) {
        for (const key of Object.keys(answers)) {
          const entry = (answers as any)[key];
          if (!entry) continue;

          const value = typeof entry === "object" && entry !== null && "value" in entry
            ? (entry as any).value
            : entry;

          if (!value || typeof value !== "object") continue;

          const maybeName = firstNonEmpty(
            (value as any).name,
            (value as any).full_name,
            (value as any).contact_name,
            (value as any).first_name && (value as any).last_name
              ? `${(value as any).first_name} ${(value as any).last_name}`
              : null,
          );
          const maybeEmail = firstNonEmpty(
            (value as any).email,
            (value as any).email_address,
            (value as any).contact_email,
          );
          const maybePhone = firstNonEmpty(
            (value as any).phone,
            (value as any).phone_number,
            (value as any).contact_phone,
          );

          if (!nameFromAnswers && maybeName) nameFromAnswers = maybeName;
          if (!emailFromAnswers && maybeEmail) emailFromAnswers = maybeEmail;
          if (!phoneFromAnswers && maybePhone) phoneFromAnswers = maybePhone;

          if (nameFromAnswers && emailFromAnswers && phoneFromAnswers) break;
        }
      }

      return { nameFromAnswers, emailFromAnswers, phoneFromAnswers };
    };

    // REQUIRED-ish
    const funnel_id: string = body.funnel_id;
    const lead_id: string | null = body.lead_id ?? null;

    // Lead data
    const answers = body.answers ?? {};
    const optInStatus = body.opt_in_status ?? null;
    const optInTimestamp = body.opt_in_timestamp ?? null;
    const last_step_index = body.last_step_index ?? null;

    // Contact info (may also be inferred from booking data and nested answers)
    const { nameFromAnswers, emailFromAnswers, phoneFromAnswers } = extractContactFromAnswers(answers);

    let name: string | null = firstNonEmpty(
      body.name,
      body.full_name,
      body.contact_name,
      body.first_name && body.last_name ? `${body.first_name} ${body.last_name}` : null,
      (body.answers && (body.answers as any).name) || null,
      nameFromAnswers,
    );
    let email: string | null = firstNonEmpty(
      body.email,
      body.email_address,
      body.contact_email,
      (body.answers && (body.answers as any).email) || null,
      emailFromAnswers,
    );
    let phone: string | null = firstNonEmpty(
      body.phone,
      body.phone_number,
      body.contact_phone,
      (body.answers && (body.answers as any).phone) || null,
      phoneFromAnswers,
    );

    // Booking data (optional)
    const calendly_booking = body.calendly_booking ?? null;
    const calendlyBookingData = body.calendly_booking_data ?? null;

    // Submit mode and step semantics
    const submitMode: SubmitMode = (body.submitMode ?? "draft") as SubmitMode;
    const step_id: string | null = body.step_id ?? null;
    const step_type: string | null = body.step_type ?? null;
    const step_intent_raw: string | null = body.step_intent ?? null;

    // For tracing + optional event id stability
    const clientRequestId: string | null = body.clientRequestId ?? null;
    
    // Derive step_intent using canonical rules if not provided
    let step_intent: StepIntent | null = step_intent_raw as StepIntent | null;
    if (!step_intent && step_type) {
      step_intent = getDefaultIntent(step_type);
      console.log(`[submit-funnel-lead] Derived step_intent=${step_intent} from step_type=${step_type}`);
    }
  
    // Compute effectiveSubmitMode: 
    // - If submitMode is "submit", use it
    // - If step_intent is "capture", upgrade draft to submit
    let effectiveSubmitMode: SubmitMode = submitMode;
    if (submitMode === "draft" && step_intent === "capture") {
      effectiveSubmitMode = "submit";
      console.log("[submit-funnel-lead] Safety net: upgrading draft->submit because step_intent=capture");
    }
  
    console.log(`[submit-funnel-lead] step_id=${step_id}, step_type=${step_type}, step_intent=${step_intent}, submitMode=${submitMode}, effectiveSubmitMode=${effectiveSubmitMode}, clientRequestId=${clientRequestId}`);

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

    // Determine lead status based on data captured
    // - 'visitor': Has answers but no contact info
    // - 'partial': Has some contact info but not all three
    // - 'lead': For submit/capture, we normalize to lead so Performance/Contacts can see it
    let leadStatus = "visitor";
    const hasAnyContactInfo = !!(email || phone || name);

    if (hasAnyContactInfo) {
      leadStatus = "partial";
    }

    const shouldForceLeadStatus =
      effectiveSubmitMode === "submit" || step_intent === "capture";

    if (shouldForceLeadStatus) {
      leadStatus = "lead";
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

    // Structured log line for tracing lead creation/update and contact enrichment
    console.log("[submit-funnel-lead] result", {
      leadId: lead?.id ?? null,
      effectiveSubmitMode,
      stepIntent: step_intent,
      nameSet: !!name,
      emailSet: !!email,
      phoneSet: !!phone,
    });

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
