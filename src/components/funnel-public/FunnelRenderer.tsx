import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProgressDots } from "./ProgressDots";
import { cn } from "@/lib/utils";
import type { CalendlyBookingData } from "./DynamicElementRenderer";
import { getDefaultIntent, getStepDefinition } from "@/lib/funnel/stepDefinitions";
import type { StepIntent, StepType } from "@/lib/funnel/types";
import getStepIntent from '@/lib/funnels/stepIntent';
import recordEvent from "@/lib/events/recordEvent";
import elementDefinitions from "@/components/funnel/elementDefinitions";
import { getConsentMode, shouldShowConsentCheckbox, resolvePrivacyPolicyUrl } from "./consent";
import { getQuestionStepTypes, getStepRegistryEntry } from "@/lib/funnel/stepRegistry";

// Use the shared getStepIntent helper (falls back to defaults).

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: Record<string, any>;
}

interface FunnelSettings {
  logo_url?: string;
  primary_color: string;
  background_color: string;
  button_text: string;
  ghl_webhook_url?: string;
  // Pixel Tracking
  meta_pixel_id?: string;
  google_analytics_id?: string;
  google_ads_id?: string;
  tiktok_pixel_id?: string;
  // Display settings
  show_progress_bar?: boolean;
}

interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  settings: FunnelSettings;
}

// Team Calendly settings for funnel override
interface TeamCalendlySettings {
  calendly_enabled_for_funnels: boolean;
  calendly_funnel_scheduling_url: string | null;
}

interface FunnelRendererProps {
  funnel: Funnel;
  steps: FunnelStep[];
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export function FunnelRenderer({ funnel, steps, utmSource, utmMedium, utmCampaign }: FunnelRendererProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [teamCalendlySettings, setTeamCalendlySettings] = useState<TeamCalendlySettings | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const calendlyBookingRef = useRef<CalendlyBookingData | null>(null);
  const pendingSaveRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const pixelsInitializedRef = useRef(false);
  const firedEventsRef = useRef<Set<string>>(new Set()); // Track fired events to prevent duplicates
  // Track funnel event timestamps to dedupe rapid duplicate emissions
  const firedFunnelEventsRef = useRef<Map<string, number>>(new Map());
  const externalIdRef = useRef<string>(crypto.randomUUID()); // Consistent ID for cross-device tracking
  const queryClient = useQueryClient();

  // Fetch team's Calendly settings for funnel embed override
  // This is read-only and uses safe fallback if fetch fails
  useEffect(() => {
    const fetchTeamCalendlySettings = async () => {
      try {
        const { data, error } = await supabase
          .from("teams")
          .select("calendly_enabled_for_funnels, calendly_funnel_scheduling_url")
          .eq("id", funnel.team_id)
          .single();

        if (error) {
          console.warn("Failed to fetch team Calendly settings, using step defaults:", error.message);
          return; // Keep null - will use step's embed_url
        }

        setTeamCalendlySettings({
          calendly_enabled_for_funnels: data.calendly_enabled_for_funnels ?? false,
          calendly_funnel_scheduling_url: data.calendly_funnel_scheduling_url ?? null,
        });
      } catch (err) {
        console.warn("Error fetching team Calendly settings:", err);
        // Keep null - will use step's embed_url as fallback
      }
    };

    fetchTeamCalendlySettings();
  }, [funnel.team_id]);

  const currentStep = steps[currentStepIndex] ?? null;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isThankYouStep = currentStep?.step_type === "thank_you";
  const domainOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  // Compute consent requirements for a specific step, keeping UI and gating logic in sync.
  function getConsentRequirementForStep(step: FunnelStep | null): { termsUrl: string; requireConsent: boolean } {
    if (!step) {
      return { termsUrl: "", requireConsent: false };
    }

    const termsUrl = resolvePrivacyPolicyUrl(step, funnel, undefined, domainOrigin);
    const requireConsent = shouldShowConsentCheckbox(step, termsUrl);
    return { termsUrl, requireConsent };
  }

  // Single source of truth for the active step's terms URL and consent behavior.
  const { termsUrl: activeTermsUrl, requireConsent: activeRequireConsent } = getConsentRequirementForStep(currentStep);

  // Reset consent UI whenever the active step changes.
  useEffect(() => {
    setConsentError(null);
    setConsentChecked(false);
  }, [currentStep?.id]);

  // Generate unique event ID for deduplication
  const generateEventId = useCallback(() => {
    return `${funnel.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, [funnel.id]);

  // Initialize pixel tracking scripts with advanced configuration
  useEffect(() => {
    if (pixelsInitializedRef.current) return;
    pixelsInitializedRef.current = true;

    const { meta_pixel_id, google_analytics_id, google_ads_id, tiktok_pixel_id } = funnel.settings;

    // Meta Pixel with advanced matching and external_id
    if (meta_pixel_id && !(window as any).fbq) {
      const script = document.createElement("script");
      script.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${meta_pixel_id}', {}, {
          external_id: '${externalIdRef.current}'
        });
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    }

    // Google Analytics 4 with enhanced measurement
    if (google_analytics_id && !(window as any).gtag) {
      const gtagScript = document.createElement("script");
      gtagScript.async = true;
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${google_analytics_id}`;
      document.head.appendChild(gtagScript);

      const configScript = document.createElement("script");
      configScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${google_analytics_id}', {
          'send_page_view': true,
          'allow_enhanced_conversions': true,
          'user_id': '${externalIdRef.current}'
        });
        ${google_ads_id ? `gtag('config', '${google_ads_id}');` : ""}
      `;
      document.head.appendChild(configScript);
    }

    // TikTok Pixel with identify
    if (tiktok_pixel_id && !(window as any).ttq) {
      const ttScript = document.createElement("script");
      ttScript.innerHTML = `
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
          ttq.load('${tiktok_pixel_id}');
          ttq.page();
          ttq.identify('${externalIdRef.current}');
        }(window, document, 'ttq');
      `;
      document.head.appendChild(ttScript);
    }
  }, [funnel.settings]);

  // Fire pixel events with deduplication
  const firePixelEvent = useCallback(
    (
      eventType: "ViewContent" | "Lead" | "CompleteRegistration" | "Schedule",
      data?: Record<string, any>,
      dedupeKey?: string,
    ) => {
      // Prevent duplicate events using deduplication key
      const eventKey = dedupeKey || `${eventType}_${JSON.stringify(data || {})}`;
      if (firedEventsRef.current.has(eventKey)) {
        console.log(`Skipping duplicate event: ${eventType}`);
        return;
      }
      firedEventsRef.current.add(eventKey);

      const eventId = generateEventId();
      const { meta_pixel_id, google_analytics_id, google_ads_id, tiktok_pixel_id } = funnel.settings;

      // Meta Pixel with event_id for server-side deduplication
      if (meta_pixel_id && (window as any).fbq) {
        const fbData = {
          ...data,
          content_name: funnel.name,
          content_category: "funnel",
          external_id: externalIdRef.current,
        };
        (window as any).fbq("track", eventType, fbData, { eventID: eventId });
        console.log(`Meta Pixel [${eventId}]: ${eventType}`, fbData);
      }

      // Google Analytics 4 with proper event mapping
      if (google_analytics_id && (window as any).gtag) {
        const gaEventMap: Record<string, string> = {
          ViewContent: "view_item",
          Lead: "generate_lead",
          CompleteRegistration: "sign_up",
          Schedule: "schedule_appointment",
        };
        const gaEvent = gaEventMap[eventType] || eventType.toLowerCase();
        const gaData = {
          ...data,
          event_id: eventId,
          funnel_name: funnel.name,
          currency: "USD",
          value: data?.value || 0,
        };
        (window as any).gtag("event", gaEvent, gaData);

        // Also send to Google Ads if configured
        if (google_ads_id && eventType === "Lead") {
          (window as any).gtag("event", "conversion", {
            send_to: google_ads_id,
            ...gaData,
          });
        }
        console.log(`GA4 [${eventId}]: ${gaEvent}`, gaData);
      }

      // TikTok Pixel with proper event mapping
      if (tiktok_pixel_id && (window as any).ttq) {
        const ttEventMap: Record<string, string> = {
          ViewContent: "ViewContent",
          Lead: "SubmitForm",
          CompleteRegistration: "CompleteRegistration",
          Schedule: "Schedule",
        };
        const ttEvent = ttEventMap[eventType] || eventType;
        const ttData = {
          ...data,
          content_name: funnel.name,
          event_id: eventId,
        };
        (window as any).ttq.track(ttEvent, ttData);
        console.log(`TikTok Pixel [${eventId}]: ${ttEvent}`, ttData);
      }
    },
    [funnel.settings, funnel.name, generateEventId],
  );

    // Unified funnel event emission (internal events only, not automations)
    const emitFunnelEvent = useCallback(async (opts: { funnel_id: string; step_id: string; lead_id?: string | null; intent: StepIntent; payload?: Record<string, any> }) => {
      const { funnel_id, step_id, lead_id, intent, payload } = opts;
      // Include lead_id in dedupe key when available so we dedupe per lead+step+intent
      const dedupeKey = `funnel_event:${funnel_id}:${step_id}:${intent}:${lead_id || 'no_lead'}`;

      const DEDUPE_WINDOW_MS = 10_000; // 10 seconds
      const now = Date.now();
      const last = firedFunnelEventsRef.current.get(dedupeKey);
      if (last && now - last < DEDUPE_WINDOW_MS) {
        if (import.meta.env.DEV) {
          try {
            console.debug('[FunnelRenderer][dev] emitFunnelEvent deduped', { dedupeKey, last, now, windowMs: DEDUPE_WINDOW_MS });
            // Dev hook: dispatch a DOM event so dev test pages can observe dedupe
            try {
              window.dispatchEvent(new CustomEvent('dev:funnelEventEmitted', { detail: { dedupeKey, emitted: false, reason: 'deduped', last, now } }));
            } catch (e) {
              // ignore
            }
          } catch (err) {
            // ignore
          }
        }
        return;
      }

      // Mark as fired immediately to prevent races (will expire by time window)
      firedFunnelEventsRef.current.set(dedupeKey, now);

      if (import.meta.env.DEV) {
        try {
          console.debug('[FunnelRenderer][dev] emitFunnelEvent', { funnel_id, step_id, lead_id, intent, payload, dedupeKey });
        } catch (err) {
          // ignore
        }
      }

      try {
        await recordEvent({
          team_id: funnel.team_id,
          funnel_id: funnel_id,
          event_type: 'funnel_step_intent',
          dedupe_key: dedupeKey,
          payload: {
            step_id,
            intent,
            lead_id: lead_id || null,
            meta: payload || {},
          },
        });

        // Dev hook: dispatch a DOM event so dev test pages can observe the emitted payload
        if (import.meta.env.DEV) {
          try {
            window.dispatchEvent(new CustomEvent('dev:funnelEventEmitted', { detail: { dedupeKey, emitted: true, step_id, intent, lead_id: lead_id || null, payload: payload || {} } }));
          } catch (e) {
            // ignore
          }
        }

        // Map step intent to workflow trigger names and record a backend trigger event.
        const intentToTriggerMap: Record<string, string> = {
          capture: "lead_captured",
          collect: "info_collected",
          schedule: "appointment_scheduled",
          complete: "funnel_completed",
        };

        const triggerName = intentToTriggerMap[intent] as string | undefined;
        if (triggerName) {
          const triggerDedupeKey = `${dedupeKey}:trigger`;
          if (import.meta.env.DEV) {
            try {
              console.debug('[FunnelRenderer][dev] emitting workflow trigger', { triggerName, triggerDedupeKey });
            } catch (err) {
              // ignore
            }
          }

          try {
            await recordEvent({
              team_id: funnel.team_id,
              funnel_id: funnel_id,
              event_type: triggerName,
              dedupe_key: triggerDedupeKey,
              payload: {
                step_id,
                intent,
                lead_id: lead_id || null,
                meta: payload || {},
              },
            });
          } catch (err) {
            if (import.meta.env.DEV) console.debug('[FunnelRenderer][dev] failed emitting workflow trigger', err);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.debug('[FunnelRenderer][dev] emitFunnelEvent failed', err);
      }
    }, [funnel.team_id]);

  // Fire ViewContent on step change
  useEffect(() => {
    if (currentStep) {
      firePixelEvent(
        "ViewContent",
        {
          content_type: currentStep.step_type,
          step_index: currentStepIndex,
          step_name: currentStep.content?.headline || currentStep.step_type,
        },
        `view_step_${currentStepIndex}`,
      );

      // Also record canonical step_viewed to the events stream
      (async () => {
        try {
          const def = elementDefinitions[currentStep.step_type];
          const dedupe = def?.buildDedupeKey
            ? def.buildDedupeKey(funnel.id, currentStep.id, { step_index: currentStepIndex })
            : `view_step:${funnel.id}:${currentStep.id}`;

          await recordEvent({
            team_id: funnel.team_id,
            funnel_id: funnel.id,
            event_type: def?.viewEvent || "step_viewed",
            dedupe_key: dedupe,
            payload: {
              step_id: currentStep.id,
              step_type: currentStep.step_type,
              step_index: currentStepIndex,
              headline: currentStep.content?.headline,
            },
          });
        } catch (err) {
          console.debug("Failed recording step_viewed event:", err);
        }
      })();
    }
  }, [currentStepIndex, currentStep, firePixelEvent]);

  // Store Calendly booking data when detected
  const handleCalendlyBooking = useCallback(
    (bookingData?: CalendlyBookingData) => {
      if (bookingData) {
        calendlyBookingRef.current = bookingData;
        console.log("Stored Calendly booking data:", bookingData);

        // Fire Schedule pixel event for Calendly booking
        firePixelEvent(
          "Schedule",
          {
            event_start_time: bookingData.event_start_time,
            invitee_email: bookingData.invitee_email,
            value: 100, // Default conversion value
          },
          `schedule_${bookingData.event_start_time}`,
        );
      }
    },
    [firePixelEvent],
  );

  // Progressive lead save - creates or updates lead
  // Uses pendingSaveRef as a mutex to prevent concurrent/duplicate submissions
  // GHL-style: draft saves never trigger workflows; submit saves do.
  type SubmitMode = "draft" | "submit";

  const saveLead = useCallback(
    async (
      allAnswers: Record<string, any>,
      submitMode: SubmitMode = "draft",
      stepId?: string,
      stepIntent?: StepIntent,
      stepType?: string,
    ): Promise<{ data: any; error: any } | void> => {
      // Prevent duplicate submissions - if already submitting, ignore this call
      if (pendingSaveRef.current) {
        console.log("Ignoring duplicate save request - submission in progress");
        return;
      }

      pendingSaveRef.current = true;

      // Stable client request ID for SUBMIT only (so retries reuse same event)
      let clientRequestId: string;
      if (submitMode === "submit") {
        const key = `submitReq:${funnel.id}:${currentStepIndex}`;
        const existing = sessionStorage.getItem(key);
        clientRequestId = existing || crypto.randomUUID();
        if (!existing) sessionStorage.setItem(key, clientRequestId);
      } else {
        clientRequestId = crypto.randomUUID();
      }

      console.log(`[saveLead] stepId=${stepId}, stepIntent=${stepIntent}, submitMode=${submitMode}, clientRequestId=${clientRequestId}`);

      try {
        console.log("[submit-funnel-lead payload]", {
          leadId,
          funnelId: funnel?.id,
          stepId,
          stepType,
          stepIntent,
          submitMode,
          answers: allAnswers,
        });

        const { data, error } = await supabase.functions.invoke("submit-funnel-lead", {
          body: {
            funnel_id: funnel.id,
            funnelId: funnel.id,
            team_id: funnel.team_id,
            teamId: funnel.team_id,
            lead_id: leadId,
            answers: allAnswers,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            calendly_booking: calendlyBookingRef.current,
            submitMode,
            clientRequestId,
            step_id: stepId,
            step_type: stepType,
            step_intent: stepIntent,
          },
        });

        if (error) {
          console.error("Failed to save lead:", error);
        } else {
          // Support BOTH response shapes (old + new) so this won’t break either way:
          const returnedLeadId = data?.lead_id || data?.lead?.id || data?.leadId || data?.id;

          if (returnedLeadId) {
            setLeadId(returnedLeadId);
            console.log("Lead saved:", returnedLeadId, submitMode === "submit" ? "(submit)" : "(draft)");
            try {
              queryClient.invalidateQueries({ queryKey: ["funnel-leads", funnel.team_id] });
            } catch (invalidateError) {
              console.warn("Failed to invalidate funnel-leads query after submit:", invalidateError);
            }
          } else {
            console.log("Lead saved (no id returned)", data);
          }
        }

        return { data, error };
      } catch (err) {
        console.error("Error saving lead:", err);
      } finally {
        pendingSaveRef.current = false;
      }
    },
    [funnel.id, currentStepIndex, leadId, utmSource, utmMedium, utmCampaign],
  );

  // Check if answer contains meaningful data worth saving
  const hasMeaningfulData = useCallback((value: any, stepType: string): boolean => {
    if (value == null) return false;

    // Always save opt-in, email, phone captures immediately
    if (["opt_in", "email_capture", "phone_capture"].includes(stepType)) {
      return true;
    }

    // For opt_in step, check if it has name, email, or phone
    if (stepType === "opt_in" && typeof value === "object") {
      return !!(value.email || value.phone || value.name);
    }

    // For text questions, save if it looks like a name or has content
    if (stepType === "text_question" && typeof value === "string") {
      return value.trim().length > 0;
    }

    // For multi choice steps, save if at least one option is selected
    if (stepType === "multi_choice") {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === "object" && Array.isArray((value as any).options)) {
        return (value as any).options.length > 0;
      }
    }

    // Default: treat as meaningful
    return true;
  }, []);

  // Keep consent state and the canonical answers payload in sync when the
  // checkbox is toggled. This ensures legal data used at submit-time
  // matches the visual checkbox state.
  const handleConsentChange = useCallback(
    (checked: boolean) => {
      setConsentChecked(checked);
      setConsentError(null);

      setAnswers((prev) => {
        const prevAny = prev as any;
        const prevLegal = (prevAny.legal as any) || {};

        const nextLegal: any = {
          ...prevLegal,
          accepted: checked,
          accepted_at: checked ? new Date().toISOString() : null,
          privacy_policy_url: activeTermsUrl || prevLegal.privacy_policy_url,
          step_id: currentStep?.id ?? prevLegal.step_id,
        };

        return {
          ...prevAny,
          legal: nextLegal,
        };
      });
    },
    [activeTermsUrl, currentStep?.id],
  );

  const handleNext = useCallback(
    async (value?: any) => {
      if (!currentStep) return;
      const stepId = currentStep.id;
      const stepType = currentStep.step_type;
      const stepIntent = getStepIntent(currentStep);
      const { termsUrl, requireConsent } = getConsentRequirementForStep(currentStep);

      console.log("[HANDLE_NEXT]", {
        stepId,
        stepType,
        stepIntent,
        consentChecked,
        requireConsent,
        termsUrl,
      });
      
      let updatedAnswers = answers;

      // Save answer if value provided
      if (value !== undefined) {
        updatedAnswers = {
          ...answers,
          [currentStep.id]: {
            value,
            step_type: currentStep.step_type,
            content: currentStep.content,
          },
        };

        setAnswers(updatedAnswers);
      }

      console.log("[HANDLE_NEXT_GATE_PASSED]");

      // Debug logging
      console.log(`[handleNext] stepId=${stepId}, step_type=${currentStep.step_type}, intent=${stepIntent}`);

      if (stepIntent === "capture") {
        // CAPTURE intent = real submit, triggers automations

        // For opt-in steps, a Privacy Policy URL is mandatory in runtime as well.
        // If it's missing entirely, block submit even before consent checkbox state.
        if (stepType === "opt_in" && !termsUrl) {
          setConsentError("Add a Privacy Policy URL in Funnel Settings before publishing.");
          return;
        }

        // Hard consent gate for submit/capture based on the exact step being submitted.
        if (requireConsent && !consentChecked) {
          console.log("[CONSENT_BLOCKED]", {
            stepId,
            stepType,
            stepIntent,
            consentChecked,
            requireConsent,
            termsUrl,
          });
          setConsentError("You must accept the privacy policy to continue.");
          return;
        }

        // One-click dedupe guard for submit/capture.
        if (submitInFlightRef.current) {
          console.log("[SUBMIT_DEDUPE_BLOCK]", { stepId, stepType, stepIntent });
          return;
        }

        submitInFlightRef.current = true;

        try {
          setIsSubmitting(true);
          // DEV-only visibility for submit intent
          if (import.meta.env.DEV) {
            try {
              console.debug('[FunnelRenderer][dev] submit payload', { funnelId: funnel.id, stepId, intent: stepIntent });
            } catch (err) {
              // ignore
            }
          }

          let submitAnswers = updatedAnswers;

          if (requireConsent && consentChecked) {
            const consentMode = getConsentMode(currentStep, activeTermsUrl);
            const existingLegal = (updatedAnswers as any).legal || {};

            submitAnswers = {
              ...updatedAnswers,
              opt_in: true,
              legal: {
                ...existingLegal,
                accepted: true,
                accepted_at: new Date().toISOString(),
                privacy_policy_url: termsUrl,
                consent_mode: consentMode,
              },
            };
            setAnswers(submitAnswers);
          }

          try {
            const result = await saveLead(submitAnswers, "submit", stepId, stepIntent, stepType);

            const consentBlocked =
              (result as any)?.error ||
              ((result as any)?.data &&
                (result as any).data.success === false &&
                (result as any).data.code === "CONSENT_REQUIRED");

            if (consentBlocked) {
              console.log("[CONSENT_BLOCKED] backend", {
                stepId,
                stepType,
                stepIntent,
                consentChecked,
                requireConsent,
                termsUrl,
              });
              submitInFlightRef.current = false;
              setConsentError("You must accept the privacy policy to continue.");
              return;
            }
          } catch (e) {
            submitInFlightRef.current = false;
            throw e;
          }

          await emitFunnelEvent({
            funnel_id: funnel.id,
            step_id: stepId,
            lead_id: leadId,
            intent: stepIntent,
            payload: { answers: submitAnswers },
          });

          updatedAnswers = submitAnswers;
        } finally {
          setIsSubmitting(false);
        }
        
        // Fire Lead pixel event
        const eventData = typeof value === "object" ? value : { value };
        const dedupeKey = eventData.email
          ? `lead_${eventData.email}`
          : eventData.phone
            ? `lead_${eventData.phone}`
            : `lead_step_${currentStepIndex}`;
        firePixelEvent("Lead", { ...eventData, value: 10, currency: "USD" }, dedupeKey);
        // Record canonical lead_submitted event
        (async () => {
          try {
            await recordEvent({
              team_id: funnel.team_id,
              funnel_id: funnel.id,
              event_type: "lead_submitted",
              dedupe_key: dedupeKey,
              payload: {
                step_id: stepId,
                answers: submitInFlightRef.current ? updatedAnswers : updatedAnswers,
                lead_id: leadId,
              },
            });
          } catch (err) {
            console.debug("Failed recording lead_submitted event:", err);
          }
        })();
        
      } else if (stepIntent === "schedule") {
        // SCHEDULE intent = save draft + fire Schedule event
        if (hasMeaningfulData(value, currentStep.step_type)) {
          await saveLead(updatedAnswers, "draft", stepId, stepIntent, stepType);
        }
        firePixelEvent("Schedule", { step_id: stepId }, `schedule_${stepId}`);

        // Record schedule event
        (async () => {
          try {
            await recordEvent({
              team_id: funnel.team_id,
              funnel_id: funnel.id,
              event_type: "schedule",
              dedupe_key: `schedule:${funnel.id}:${stepId}`,
              payload: {
                step_id: stepId,
                calendly_booking: calendlyBookingRef.current,
              },
            });
          } catch (err) {
            console.debug("Failed recording schedule event:", err);
          }
        })();
        
      } else {
        // COLLECT or COMPLETE intent = draft save only
        if (hasMeaningfulData(value, currentStep.step_type)) {
          await saveLead(updatedAnswers, "draft", stepId, stepIntent, stepType);
        }
      }

      // Move to next step
      if (!isLastStep) {
        console.log("[ADVANCE_STEP]", { from: currentStep?.id, stepType: currentStep?.step_type });
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        console.log("[MARK_COMPLETE]", { from: currentStep?.id });
        setIsComplete(true);
      }
    },
    [
      answers,
      currentStep,
      currentStepIndex,
      consentChecked,
      firePixelEvent,
      hasMeaningfulData,
      isLastStep,
      saveLead,
      activeTermsUrl,
    ],
  );

  // Calculate question number for multi_choice steps (excluding welcome, thank_you, video)
  const questionStepTypes = getQuestionStepTypes();
  const questionSteps = steps.filter((s) => questionStepTypes.includes(s.step_type as StepType));

  const renderStep = (step: FunnelStep, isActive: boolean, stepIndex: number) => {
    // Calculate current question number for this step
    const questionIndex = questionSteps.findIndex((q) => q.id === step.id);
    const currentQuestionNumber = questionIndex >= 0 ? questionIndex + 1 : undefined;
    const totalQuestions = questionSteps.length;

    const { termsUrl: resolvedStepTermsUrl, requireConsent: stepShowConsent } = getConsentRequirementForStep(step);

    const commonProps = {
      content: step.content,
      settings: funnel.settings,
      onNext: handleNext,
      isActive,
      currentStep: currentQuestionNumber,
      totalSteps: totalQuestions,
      onCalendlyBooking: handleCalendlyBooking,
    };

    const debugBadge =
      isActive && stepShowConsent ? (
        <div className="fixed top-2 left-2 z-[9999] rounded bg-black/80 px-3 py-2 text-xs text-white">
          <div>stepIndex: {stepIndex}</div>
          <div>stepId: {step.id}</div>
          <div>step_type: {step.step_type}</div>
          <div>showConsent: {String(stepShowConsent)}</div>
          <div>consentChecked: {String(consentChecked)}</div>
          <div>termsUrl: {resolvedStepTermsUrl ? "yes" : "no"}</div>
        </div>
      ) : null;

    const registryEntry = getStepRegistryEntry(step.step_type);
    if (!registryEntry) {
      return null;
    }

    const isActiveStep = step.id === currentStep?.id;
    const { termsUrl: baseTermsUrl, requireConsent: baseRequireConsent } = getConsentRequirementForStep(step);
    const activeStepTermsUrl = isActiveStep ? activeTermsUrl : baseTermsUrl;
    const stepShowConsentCheckbox = isActiveStep ? activeRequireConsent : baseRequireConsent;

    const consentContext =
      step.step_type === "opt_in"
        ? {
            termsUrl: activeStepTermsUrl,
            showConsentCheckbox: stepShowConsentCheckbox,
            consentChecked,
            consentError,
            onConsentChange: handleConsentChange,
          }
        : undefined;

    const embedContext =
      step.step_type === "embed"
        ? {
            teamCalendlyUrl: teamCalendlySettings?.calendly_enabled_for_funnels
              ? teamCalendlySettings.calendly_funnel_scheduling_url
              : null,
          }
        : undefined;

    return registryEntry.renderPublic({
      commonProps,
      debugBadge,
      consent: consentContext,
      embed: embedContext,
    });
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-x-hidden overflow-y-auto"
      style={{ backgroundColor: funnel.settings.background_color }}
    >
      {/* Logo */}
      {funnel.settings.logo_url && (
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
          <img src={funnel.settings.logo_url} alt="Logo" className="h-6 md:h-8 w-auto object-contain" />
        </div>
      )}

      {/* Progress Dots */}
      {!isThankYouStep && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
          <ProgressDots total={steps.length} current={currentStepIndex} primaryColor={funnel.settings.primary_color} />
        </div>
      )}

      {/* Steps Container - scrollable on each step */}
      <div className="min-h-screen w-full pt-16 md:pt-20 pb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "min-h-[calc(100vh-5rem)] w-full flex flex-col items-center justify-start py-4 md:py-8 px-4 md:px-6 transition-all duration-500 ease-out",
              index === currentStepIndex ? "block opacity-100" : "hidden opacity-0",
            )}
          >
            <div className="w-full max-w-2xl mx-auto">{renderStep(step, index === currentStepIndex, index)}</div>
          </div>
        ))}
      </div>

      {/* Loading overlay during submission */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
