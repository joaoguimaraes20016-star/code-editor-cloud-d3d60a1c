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
type ConsentMode = "explicit" | "implicit";
type ConsentMode = "explicit" | "implicit";

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

// Backend mirror of the public funnel consent helpers.
// These helpers intentionally use `any` to avoid coupling to frontend types.

function getDefaultPrivacyPolicyUrlBackend(funnel: any, team: any | null): string {
  const funnelUrl = funnel?.settings?.privacy_policy_url;
  if (typeof funnelUrl === "string" && funnelUrl.trim().length > 0) {
    return funnelUrl.trim();
  }

  const teamUrl = team?.settings?.privacy_policy_url;
  if (typeof teamUrl === "string" && teamUrl.trim().length > 0) {
    return teamUrl.trim();
  }

  return "/legal/privacy";
}

function resolvePrivacyPolicyUrlBackend(
  step: any | null,
  funnel: any,
  team: any | null,
): string {
  const content = step?.content || {};
  const stepUrl =
    content.privacy_link ||
    content.terms_url ||
    content.terms_link;

  if (typeof stepUrl === "string" && stepUrl.trim().length > 0) {
    return stepUrl.trim();
  }

  return getDefaultPrivacyPolicyUrlBackend(funnel, team);
}

function getConsentModeBackend(step: any | null, termsUrl: string | null): ConsentMode {
  const raw = step?.content?.consent_mode as ConsentMode | undefined;
  if (raw === "explicit" || raw === "implicit") return raw;
  return termsUrl ? "implicit" : "explicit";
}

function shouldShowConsentCheckboxBackend(step: any | null, termsUrl: string | null): boolean {
  if (!step || !termsUrl) return false;
  const stepType = step.step_type || "";
  const consentSteps = ["opt_in", "email_capture", "phone_capture", "contact_capture"];
  return consentSteps.includes(stepType);
}

// Minimal consent step shape used on the backend. Matches the shape produced by
// public.funnel-renderer.js and the React funnel renderer (step_type + content).
interface ConsentStep {
  id?: string;
  step_type?: string | null;
  content?: Record<string, any> | null;
}

// Resolve the privacy / terms URL for a step using the same precedence as the
// frontend helpers: step-level overrides, then funnel-level default.
function getTermsUrlFromStepAndFunnel(
  step: ConsentStep | null,
  funnel: any,
): string | null {
  const content = step?.content ?? {};
  const rawStepUrl =
    content.privacy_link ||
    (content as any).terms_url ||
    (content as any).terms_link ||
    null;

  if (typeof rawStepUrl === "string" && rawStepUrl.trim().length > 0) {
    return rawStepUrl.trim();
  }

  const rawFunnelUrl = funnel?.settings?.privacy_policy_url ?? null;
  if (typeof rawFunnelUrl === "string" && rawFunnelUrl.trim().length > 0) {
    return rawFunnelUrl.trim();
  }

  return null;
}

// Mirror getConsentMode from src/components/funnel-public/consent.ts
function getConsentModeForStep(
  step: ConsentStep | null,
  termsUrl: string | null,
): ConsentMode {
  const rawMode = step?.content?.consent_mode as ConsentMode | undefined;
  if (rawMode === "explicit" || rawMode === "implicit") return rawMode;
  return termsUrl ? "implicit" : "explicit";
}

// Backend version of shouldShowConsentCheckbox. This keeps the server-side
// gating aligned with the UI but does not depend on any browser APIs.
function shouldShowConsentCheckboxBackend(
  step: ConsentStep | null,
  termsUrl: string | null,
): boolean {
  if (!step || !termsUrl) return false;

  const content = step.content ?? {};

  if (content.requires_consent === true || content.show_consent_checkbox === true) {
    return true;
  }

  const stepType = step.step_type || "";
  const consentSteps = ["opt_in", "email_capture", "phone_capture", "contact_capture"];
  return consentSteps.includes(stepType);
}

// Compute the consent requirement contract for the submission, mirroring the
// intended UX rule:
//   requireConsent = explicit_mode AND show_checkbox AND termsUrl exists
function computeConsentRequirement(opts: {
  step: ConsentStep | null;
  funnel: any;
}): {
  termsUrl: string | null;
  consentMode: ConsentMode;
  requireConsent: boolean;
  showConsentCheckbox: boolean;
} {
  const { step, funnel } = opts;

  const termsUrl = getTermsUrlFromStepAndFunnel(step, funnel);
  const consentMode = getConsentModeForStep(step, termsUrl);
  const showConsentCheckbox = shouldShowConsentCheckboxBackend(step, termsUrl);

  const requireConsent =
    consentMode === "explicit" && showConsentCheckbox === true && !!termsUrl;

  return { termsUrl, consentMode, requireConsent, showConsentCheckbox };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/[^0-9]/g, "");
    const withPlus = digits.length > 0 ? `+${digits}` : "";
    return withPlus || null;
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : null;
}

async function resolveContact(
  supabase: any,
  team_id: string,
  emailNorm: string | null,
  phoneNorm: string | null,
  nameNorm: string | null,
): Promise<{
  contactId: string | null;
  identity_match_type: "email" | "phone" | "none";
  identity_mismatch: boolean;
  identity_mismatch_reason: string | null;
}> {
  if (!emailNorm && !phoneNorm && !nameNorm) {
    return {
      contactId: null,
      identity_match_type: "none",
      identity_mismatch: false,
      identity_mismatch_reason: null,
    };
  }

  let contactByEmail: any = null;
  let contactByPhone: any = null;

  try {
    if (emailNorm) {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("team_id", team_id)
        .eq("primary_email_normalized", emailNorm)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[submit-funnel-lead] Error looking up contact by email:", error);
      } else {
        contactByEmail = data;
      }
    }

    if (phoneNorm) {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("team_id", team_id)
        .eq("primary_phone_normalized", phoneNorm)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[submit-funnel-lead] Error looking up contact by phone:", error);
      } else {
        contactByPhone = data;
      }
    }
  } catch (lookupErr) {
    console.error("[submit-funnel-lead] Unexpected error during contact lookup:", lookupErr);
  }

  let chosenContact: any = null;
  let identity_match_type: "email" | "phone" | "none" = "none";
  let identity_mismatch = false;
  let identity_mismatch_reason: string | null = null;

  if (contactByEmail && contactByPhone && contactByEmail.id !== contactByPhone.id) {
    chosenContact = contactByEmail;
    identity_match_type = "email";
    identity_mismatch = true;
    identity_mismatch_reason = "email_phone_conflict";
  } else if (contactByEmail || contactByPhone) {
    chosenContact = contactByEmail ?? contactByPhone;

    if (contactByEmail && contactByPhone && contactByEmail.id === contactByPhone.id) {
      identity_match_type = emailNorm ? "email" : "phone";
    } else if (contactByEmail) {
      identity_match_type = "email";
    } else if (contactByPhone) {
      identity_match_type = "phone";
    }
  }

  if (!chosenContact) {
    try {
      const { data: newContact, error: insertError } = await supabase
        .from("contacts")
        .insert({
          team_id,
          primary_email_normalized: emailNorm,
          primary_phone_normalized: phoneNorm,
          display_name: nameNorm,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("[submit-funnel-lead] Error creating new contact:", insertError);
        return {
          contactId: null,
          identity_match_type: "none",
          identity_mismatch: false,
          identity_mismatch_reason: null,
        };
      }

      chosenContact = newContact;
      identity_match_type = "none";
      identity_mismatch = false;
      identity_mismatch_reason = null;
    } catch (insertErr) {
      console.error("[submit-funnel-lead] Unexpected error creating new contact:", insertErr);
      return {
        contactId: null,
        identity_match_type: "none",
        identity_mismatch: false,
        identity_mismatch_reason: null,
      };
    }
  } else if (identity_match_type !== "none" && identity_mismatch_reason !== "email_phone_conflict") {
    const contactEmailNorm = normalizeEmail(
      chosenContact.primary_email_normalized ?? chosenContact.email ?? null,
    );
    const contactPhoneNorm = normalizePhone(
      chosenContact.primary_phone_normalized ?? chosenContact.phone ?? null,
    );
    const contactNameNorm = normalizeName(
      chosenContact.display_name ?? chosenContact.name ?? null,
    );

    const mismatches: string[] = [];

    if (emailNorm && contactEmailNorm && emailNorm !== contactEmailNorm) {
      mismatches.push("email");
    }

    if (phoneNorm && contactPhoneNorm && phoneNorm !== contactPhoneNorm) {
      mismatches.push("phone");
    }

    if (nameNorm && contactNameNorm && nameNorm !== contactNameNorm) {
      mismatches.push("name");
    }

    if (mismatches.length > 0) {
      identity_mismatch = true;
      if (!identity_mismatch_reason) {
        identity_mismatch_reason = mismatches.join(",");
      }
    }
  }

  return {
    contactId: chosenContact ? chosenContact.id : null,
    identity_match_type,
    identity_mismatch,
    identity_mismatch_reason,
  };
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
    let answers: any = body.answers ?? {};
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

    // Load the step being submitted (if provided) so we can mirror
    // frontend consent rules and enforce them authoritatively here.
    let stepRow: any | null = null;
    if (step_id) {
      try {
        const { data: stepData, error: stepErr } = await supabase
          .from("funnel_steps")
          .select("id, step_type, content")
          .eq("id", step_id)
          .eq("funnel_id", funnel_id)
          .maybeSingle();

        if (stepErr) {
          console.error("[submit-funnel-lead] Error loading funnel_step for consent evaluation", stepErr);
        } else {
          stepRow = stepData;
        }
      } catch (stepLoadErr) {
        console.error("[submit-funnel-lead] Unexpected error loading funnel_step", stepLoadErr);
      }
    }

    // Optionally load team settings if we need a fallback privacy URL.
    let team: any | null = null;
    try {
      const { data: teamData, error: teamErr } = await supabase
        .from("teams")
        .select("id, settings")
        .eq("id", funnel.team_id)
        .maybeSingle();

      if (teamErr) {
        console.error("[submit-funnel-lead] Error loading team for consent evaluation", teamErr);
      } else {
        team = teamData;
      }
    } catch (teamLoadErr) {
      console.error("[submit-funnel-lead] Unexpected error loading team for consent evaluation", teamLoadErr);
    }

    // Determine consent requirements for this submission based on the
    // step being submitted. This mirrors the public funnel consent
    // helpers while remaining backend-authoritative.
    let termsUrl: string | null = null;
    let consentMode: ConsentMode = "explicit";
    let requireConsent = false;

    if (stepRow) {
      termsUrl = resolvePrivacyPolicyUrlBackend(stepRow, funnel, team);
      const normalizedTermsUrl = termsUrl && termsUrl.trim().length > 0 ? termsUrl.trim() : null;
      termsUrl = normalizedTermsUrl;

      consentMode = getConsentModeBackend(stepRow, termsUrl);

      const showConsentCheckboxExplicit =
        stepRow.content?.requires_consent === true ||
        stepRow.content?.show_consent_checkbox === true;

      const showConsentCheckboxDerived = shouldShowConsentCheckboxBackend(stepRow, termsUrl);

      // Authoritative rule: a step requires consent if a privacy/terms
      // URL exists AND either the consent mode is explicit OR the
      // step config indicates a consent checkbox should be shown.
      requireConsent = !!termsUrl && (
        consentMode === "explicit" ||
        showConsentCheckboxExplicit ||
        showConsentCheckboxDerived
      );
    }

    // Load the funnel step (if provided) so we can enforce consent on the
    // backend using the same configuration as the editor/runtime.
    let consentStep: ConsentStep | null = null;
    if (step_id) {
      try {
        const { data: stepData, error: stepError } = await supabase
          .from("funnel_steps")
          .select("id, step_type, content")
          .eq("id", step_id)
          .eq("funnel_id", funnel_id)
          .maybeSingle();

        if (stepError) {
          console.error("[submit-funnel-lead] Error loading funnel_step for consent enforcement:", stepError);
        } else if (stepData) {
          consentStep = stepData as ConsentStep;
        }
      } catch (stepErr) {
        console.error("[submit-funnel-lead] Unexpected error loading funnel_step for consent enforcement:", stepErr);
      }
    }

    const {
      termsUrl: consentTermsUrl,
      consentMode,
      requireConsent,
      showConsentCheckbox,
    } = computeConsentRequirement({ step: consentStep, funnel });

    const existingLegal = answers && (answers as any).legal
      ? (answers as any).legal as Record<string, any>
      : null;
    const nowIso = new Date().toISOString();

    // We only hard-block capture / submit-style writes; draft progress saves
    // for non-capture steps are allowed without explicit consent.
    const isCaptureSubmission =
      effectiveSubmitMode === "submit" || step_intent === "capture";

    if (requireConsent && isCaptureSubmission) {
      const accepted = !!(
        existingLegal &&
        (existingLegal.accepted === true || existingLegal.consent_given === true)
      );

      const rawPrivacy = existingLegal
        ? (existingLegal.privacy_policy_url || existingLegal.terms_url)
        : null;

      const privacyFromPayload =
        typeof rawPrivacy === "string" && rawPrivacy.trim().length > 0
          ? rawPrivacy.trim()
          : null;

      const effectivePrivacyUrl = privacyFromPayload || consentTermsUrl;

      if (!accepted || !effectivePrivacyUrl) {
        console.log("[submit-funnel-lead] Blocking capture submission due to missing consent", {
          step_id,
          step_type,
          step_intent,
          requireConsent,
          showConsentCheckbox,
          accepted,
          hasPrivacyUrl: !!effectivePrivacyUrl,
        });

        return new Response(
          JSON.stringify({
            error: "CONSENT_REQUIRED",
            message:
              "Consent is required to submit this form. Please accept the privacy policy to continue.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Normalize the legal payload that will be stored with the lead so we
      // have a consistent record of which policy was accepted and when.
      (answers as any).legal = {
        ...(existingLegal ?? {}),
        accepted: true,
        consent_given: true,
        accepted_at: existingLegal?.accepted_at ?? nowIso,
        consent_ts: existingLegal?.consent_ts ?? nowIso,
        privacy_policy_url: effectivePrivacyUrl,
        terms_url: effectivePrivacyUrl,
        consent_mode:
          (existingLegal?.consent_mode as ConsentMode | undefined) ?? consentMode,
        step_id: step_id ?? existingLegal?.step_id ?? null,
      };
    } else if (!requireConsent && consentTermsUrl) {
      // Implicit consent path: a terms URL exists but an explicit checkbox is
      // not required. We still record a normalized legal payload so downstream
      // systems can see which policy applied.
      (answers as any).legal = {
        ...(existingLegal ?? {}),
        accepted: existingLegal?.accepted ?? true,
        consent_given: existingLegal?.consent_given ?? true,
        accepted_at: existingLegal?.accepted_at ?? nowIso,
        consent_ts: existingLegal?.consent_ts ?? nowIso,
        privacy_policy_url:
          existingLegal?.privacy_policy_url ?? consentTermsUrl,
        terms_url: existingLegal?.terms_url ?? consentTermsUrl,
        consent_mode:
          (existingLegal?.consent_mode as ConsentMode | undefined) ??
          consentMode ??
          "implicit",
        step_id: step_id ?? existingLegal?.step_id ?? null,
      };
    }

    // Infer contact fields from booking if present
    // (keeps your existing behavior; safe if null)
    if (calendly_booking?.invitee_email && !email) email = calendly_booking.invitee_email;
    if (calendly_booking?.invitee_phone && !phone) phone = calendly_booking.invitee_phone;
    if (calendly_booking?.invitee_name && !name) name = calendly_booking.invitee_name;

    // Before deriving lead status or writing any rows, enforce
    // consent requirements for real submit/capture flows.
    const isSubmitLike = effectiveSubmitMode === "submit" || step_intent === "capture";

    let normalizedLegal: {
      accepted: boolean;
      accepted_at: string;
      privacy_policy_url: string;
      step_id: string | null;
      consent_mode: ConsentMode;
    } | null = null;

    const existingLegal = (answers as any)?.legal ?? null;

    if (isSubmitLike && termsUrl && requireConsent) {
      const accepted = existingLegal?.accepted === true;

      if (!accepted) {
        console.warn("[submit-funnel-lead] Consent required but not accepted", {
          funnel_id,
          step_id,
          step_type,
          step_intent,
          effectiveSubmitMode,
        });

        return new Response(
          JSON.stringify({ success: false, code: "CONSENT_REQUIRED", message: "CONSENT_REQUIRED" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const acceptedAt: string =
        typeof existingLegal?.accepted_at === "string" && existingLegal.accepted_at
          ? existingLegal.accepted_at
          : new Date().toISOString();

      const privacy_policy_url: string =
        typeof existingLegal?.privacy_policy_url === "string" && existingLegal.privacy_policy_url
          ? existingLegal.privacy_policy_url
          : termsUrl;

      normalizedLegal = {
        accepted: true,
        accepted_at: acceptedAt,
        privacy_policy_url,
        step_id,
        consent_mode: consentMode,
      };
    } else if (termsUrl && !requireConsent) {
      // Implicit mode: record that the user progressed through a step
      // with a privacy policy URL, even if an explicit checkbox was
      // not required.
      normalizedLegal = {
        accepted: true,
        accepted_at: new Date().toISOString(),
        privacy_policy_url: termsUrl,
        step_id,
        consent_mode: "implicit",
      };
    }

    if (normalizedLegal) {
      answers = {
        ...(answers || {}),
        legal: normalizedLegal,
      };
    }

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

    const emailNormalized = normalizeEmail(email);
    const phoneNormalized = normalizePhone(phone);
    const nameNormalized = normalizeName(name);

    let contactId: string | null = null;
    let identityMatchType: "email" | "phone" | "none" = "none";
    let identityMismatch: boolean | null = null;
    let identityMismatchReason: string | null = null;
    let identityFieldsResolved = false;

    // If a lead_id was provided, try to load the existing lead first so we can
    // decide whether to attach a contact and avoid overwriting non-null
    // identity fields.
    let existingLead: any = null;
    if (lead_id) {
      try {
        const { data: existing, error: existingError } = await supabase
          .from("funnel_leads")
          .select("*")
          .eq("id", lead_id)
          .eq("team_id", funnel.team_id)
          .maybeSingle();

        if (existingError) {
          console.error("[submit-funnel-lead] Error loading existing funnel_lead for lead_id", lead_id, existingError);
        } else {
          existingLead = existing;
        }
      } catch (existingErr) {
        console.error("[submit-funnel-lead] Unexpected error loading existing funnel_lead", existingErr);
      }
    }

    const hasIdentityInput = !!(emailNormalized || phoneNormalized || nameNormalized);
    const autoCreateAllowed = funnel.auto_create_contact !== false;

    const shouldAttemptContactResolution =
      autoCreateAllowed &&
      hasIdentityInput &&
      // For existing leads, only resolve if they don't already have a contact.
      (!existingLead || !existingLead.contact_id);

    if (shouldAttemptContactResolution) {
      const contactResult = await resolveContact(
        supabase,
        funnel.team_id,
        emailNormalized,
        phoneNormalized,
        nameNormalized,
      );

      contactId = contactResult.contactId;
      identityMatchType = contactResult.identity_match_type;
      identityMismatch = contactResult.identity_mismatch;
      identityMismatchReason = contactResult.identity_mismatch_reason;
      identityFieldsResolved = true;
    }

    let lead: any = null;

    // 1) Update existing lead if lead_id provided and row exists
    if (lead_id && existingLead) {
      const updatePayload: any = {
        answers,
        email: email || undefined,
        phone: phone || undefined,
        name: name || undefined,
        calendly_booking_data: calendlyBookingData || undefined,
        opt_in_status: optInStatus ?? undefined,
        opt_in_timestamp: optInTimestamp || undefined,
        status: leadStatus,
        last_step_index: last_step_index ?? undefined,
      };

      if (contactId && !existingLead.contact_id) {
        updatePayload.contact_id = contactId;
      }

      if (identityFieldsResolved) {
        if (existingLead.identity_match_type == null) {
          updatePayload.identity_match_type = identityMatchType;
        }

        if (existingLead.identity_mismatch == null && typeof identityMismatch === "boolean") {
          updatePayload.identity_mismatch = identityMismatch;
        }

        if (existingLead.identity_mismatch_reason == null && identityMismatchReason) {
          updatePayload.identity_mismatch_reason = identityMismatchReason;
        }
      }

      const { data: updatedLead, error: updateError } = await supabase
        .from("funnel_leads")
        .update(updatePayload)
        .eq("id", lead_id)
        .eq("team_id", funnel.team_id)
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
            contact_id: contactId,
            identity_match_type: identityMatchType,
            identity_mismatch: identityMismatch,
            identity_mismatch_reason: identityMismatchReason,
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

  // After lead upsert, write an audit log row for downstream history views.
  // Uses a short dedupe window to avoid duplicate inserts for the same lead/step.
  try {
    const auditEventType = "lead_submitted";
    const DEDUPE_WINDOW_MS = 10_000;
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

    const auditDetails: Record<string, any> = {
      lead_id: lead.id,
      funnel_id,
      step_id,
      step_type,
      step_intent,
      submitMode,
    };

    if (name) auditDetails.name = name;
    if (email) auditDetails.email = email;
    if (phone) auditDetails.phone = phone;

    let duplicateExists = false;
    try {
      let auditQuery = supabase
        .from("webhook_audit_logs")
        .select("id")
        .eq("team_id", funnel.team_id)
        .eq("event_type", auditEventType)
        .gte("created_at", since)
        .eq("details->>lead_id", lead.id as string);

      if (step_id) {
        auditQuery = auditQuery.eq("details->>step_id", step_id as string);
      }

      const { data: existingLogs, error: existingError } = await auditQuery.limit(1);

      if (!existingError && existingLogs && existingLogs.length > 0) {
        duplicateExists = true;
      } else if (existingError) {
        console.error("[submit-funnel-lead] Failed checking webhook_audit_logs dedupe:", existingError);
      }
    } catch (checkErr) {
      console.error("[submit-funnel-lead] Unexpected error during webhook_audit_logs dedupe check:", checkErr);
    }

    if (!duplicateExists) {
      const { error: auditError } = await supabase.from("webhook_audit_logs").insert({
        team_id: funnel.team_id,
        event_type: auditEventType,
        status: "success", // matches table constraint (success|error)
        details: auditDetails,
        received_at: new Date().toISOString(),
      });

      if (auditError) {
        console.error("[submit-funnel-lead] Failed inserting webhook_audit_logs:", auditError);
      }
    } else {
      console.log("[submit-funnel-lead] Skipping webhook_audit_logs insert due to recent duplicate", {
        team_id: funnel.team_id,
        event_type: auditEventType,
        lead_id: lead.id,
        step_id,
      });
    }
  } catch (auditOuterErr) {
    console.error("[submit-funnel-lead] Error while logging to webhook_audit_logs:", auditOuterErr);
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
