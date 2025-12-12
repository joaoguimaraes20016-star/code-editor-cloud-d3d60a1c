import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WelcomeStep } from './WelcomeStep';
import { TextQuestionStep } from './TextQuestionStep';
import { MultiChoiceStep } from './MultiChoiceStep';
import { EmailCaptureStep } from './EmailCaptureStep';
import { PhoneCaptureStep } from './PhoneCaptureStep';
import { VideoStep } from './VideoStep';
import { ThankYouStep } from './ThankYouStep';
import { OptInStep } from './OptInStep';
import { EmbedStep } from './EmbedStep';
import { ProgressDots } from './ProgressDots';
import { cn } from '@/lib/utils';
import type { CalendlyBookingData } from './DynamicElementRenderer';

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
  const calendlyBookingRef = useRef<CalendlyBookingData | null>(null);
  const pendingSaveRef = useRef(false);
  const pixelsInitializedRef = useRef(false);
  const firedEventsRef = useRef<Set<string>>(new Set()); // Track fired events to prevent duplicates
  const externalIdRef = useRef<string>(crypto.randomUUID()); // Consistent ID for cross-device tracking

  // Fetch team's Calendly settings for funnel embed override
  // This is read-only and uses safe fallback if fetch fails
  useEffect(() => {
    const fetchTeamCalendlySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('calendly_enabled_for_funnels, calendly_funnel_scheduling_url')
          .eq('id', funnel.team_id)
          .single();

        if (error) {
          console.warn('Failed to fetch team Calendly settings, using step defaults:', error.message);
          return; // Keep null - will use step's embed_url
        }

        setTeamCalendlySettings({
          calendly_enabled_for_funnels: data.calendly_enabled_for_funnels ?? false,
          calendly_funnel_scheduling_url: data.calendly_funnel_scheduling_url ?? null,
        });
      } catch (err) {
        console.warn('Error fetching team Calendly settings:', err);
        // Keep null - will use step's embed_url as fallback
      }
    };

    fetchTeamCalendlySettings();
  }, [funnel.team_id]);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isThankYouStep = currentStep?.step_type === 'thank_you';

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
      const script = document.createElement('script');
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
      const gtagScript = document.createElement('script');
      gtagScript.async = true;
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${google_analytics_id}`;
      document.head.appendChild(gtagScript);

      const configScript = document.createElement('script');
      configScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${google_analytics_id}', {
          'send_page_view': true,
          'allow_enhanced_conversions': true,
          'user_id': '${externalIdRef.current}'
        });
        ${google_ads_id ? `gtag('config', '${google_ads_id}');` : ''}
      `;
      document.head.appendChild(configScript);
    }

    // TikTok Pixel with identify
    if (tiktok_pixel_id && !(window as any).ttq) {
      const ttScript = document.createElement('script');
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
  const firePixelEvent = useCallback((
    eventType: 'ViewContent' | 'Lead' | 'CompleteRegistration' | 'Schedule',
    data?: Record<string, any>,
    dedupeKey?: string
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
        content_category: 'funnel',
        external_id: externalIdRef.current,
      };
      (window as any).fbq('track', eventType, fbData, { eventID: eventId });
      console.log(`Meta Pixel [${eventId}]: ${eventType}`, fbData);
    }

    // Google Analytics 4 with proper event mapping
    if (google_analytics_id && (window as any).gtag) {
      const gaEventMap: Record<string, string> = {
        'ViewContent': 'view_item',
        'Lead': 'generate_lead',
        'CompleteRegistration': 'sign_up',
        'Schedule': 'schedule_appointment',
      };
      const gaEvent = gaEventMap[eventType] || eventType.toLowerCase();
      const gaData = {
        ...data,
        event_id: eventId,
        funnel_name: funnel.name,
        currency: 'USD',
        value: data?.value || 0,
      };
      (window as any).gtag('event', gaEvent, gaData);
      
      // Also send to Google Ads if configured
      if (google_ads_id && eventType === 'Lead') {
        (window as any).gtag('event', 'conversion', {
          send_to: google_ads_id,
          ...gaData,
        });
      }
      console.log(`GA4 [${eventId}]: ${gaEvent}`, gaData);
    }

    // TikTok Pixel with proper event mapping
    if (tiktok_pixel_id && (window as any).ttq) {
      const ttEventMap: Record<string, string> = {
        'ViewContent': 'ViewContent',
        'Lead': 'SubmitForm',
        'CompleteRegistration': 'CompleteRegistration',
        'Schedule': 'Schedule',
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
  }, [funnel.settings, funnel.name, generateEventId]);

  // Fire ViewContent on step change
  useEffect(() => {
    if (currentStep) {
      firePixelEvent('ViewContent', {
        content_type: currentStep.step_type,
        step_index: currentStepIndex,
        step_name: currentStep.content?.headline || currentStep.step_type,
      }, `view_step_${currentStepIndex}`);
    }
  }, [currentStepIndex, currentStep, firePixelEvent]);

  // Store Calendly booking data when detected
  const handleCalendlyBooking = useCallback((bookingData?: CalendlyBookingData) => {
    if (bookingData) {
      calendlyBookingRef.current = bookingData;
      console.log('Stored Calendly booking data:', bookingData);
      
      // Fire Schedule pixel event for Calendly booking
      firePixelEvent('Schedule', {
        event_start_time: bookingData.event_start_time,
        invitee_email: bookingData.invitee_email,
        value: 100, // Default conversion value
      }, `schedule_${bookingData.event_start_time}`);
    }
  }, [firePixelEvent]);

  // Progressive lead save - creates or updates lead
  // Uses pendingSaveRef as a mutex to prevent concurrent/duplicate submissions
  const saveLead = useCallback(async (allAnswers: Record<string, any>, isComplete: boolean = false) => {
    // Prevent duplicate submissions - if already submitting, ignore this call
    if (pendingSaveRef.current) {
      console.log('Ignoring duplicate save request - submission in progress');
      return;
    }
    pendingSaveRef.current = true;
    
    // Generate unique client request ID for debugging duplicate calls
    const clientRequestId = crypto.randomUUID();
    console.log(`[saveLead] clientRequestId=${clientRequestId}, isComplete=${isComplete}`);

    try {
      const { data, error } = await supabase.functions.invoke('submit-funnel-lead', {
        body: {
          funnel_id: funnel.id,
          lead_id: leadId, // Pass existing lead ID for updates
          answers: allAnswers,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          calendly_booking: calendlyBookingRef.current,
          is_complete: isComplete,
          clientRequestId, // For debugging
        },
      });

      if (error) {
        console.error('Failed to save lead:', error);
      } else if (data?.lead_id) {
        setLeadId(data.lead_id);
        console.log('Lead saved:', data.lead_id, isComplete ? '(complete)' : '(partial)');
      }
    } catch (err) {
      console.error('Error saving lead:', err);
    } finally {
      pendingSaveRef.current = false;
    }
  }, [funnel.id, leadId, utmSource, utmMedium, utmCampaign]);

  // Check if answer contains meaningful data worth saving
  const hasMeaningfulData = useCallback((value: any, stepType: string): boolean => {
    if (!value) return false;
    
    // Always save opt-in, email, phone captures immediately
    if (['opt_in', 'email_capture', 'phone_capture'].includes(stepType)) {
      return true;
    }
    
    // For opt_in step, check if it has name, email, or phone
    if (stepType === 'opt_in' && typeof value === 'object') {
      return !!(value.email || value.phone || value.name);
    }
    
    // For text questions, save if it looks like a name or has content
    if (stepType === 'text_question' && typeof value === 'string') {
      return value.trim().length > 0;
    }
    
    // For multi-choice, always save selections
    if (stepType === 'multi_choice') {
      return true;
    }
    
    return false;
  }, []);

  const handleNext = useCallback(async (value?: any) => {
    let updatedAnswers = { ...answers };
    
    // Save answer if value provided
    if (value !== undefined && currentStep) {
      updatedAnswers = {
        ...answers,
        [currentStep.id]: {
          value,
          step_type: currentStep.step_type,
          content: currentStep.content,
        },
      };
      setAnswers(updatedAnswers);
      
      // Progressive save on meaningful data
      if (hasMeaningfulData(value, currentStep.step_type)) {
        // Don't wait for save to complete before moving to next step
        saveLead(updatedAnswers, false);
        
        // Fire Lead pixel event when contact info is captured (with deduplication)
        if (['opt_in', 'email_capture', 'phone_capture'].includes(currentStep.step_type)) {
          const eventData = typeof value === 'object' ? value : { value };
          // Use email or phone as deduplication key to prevent duplicate Lead events
          const dedupeKey = eventData.email ? `lead_${eventData.email}` 
            : eventData.phone ? `lead_${eventData.phone}` 
            : `lead_step_${currentStepIndex}`;
          firePixelEvent('Lead', {
            ...eventData,
            value: 10, // Default lead value
            currency: 'USD',
          }, dedupeKey);
        }
      }
    }

    // If this is the step before thank you, do final complete save
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep?.step_type === 'thank_you') {
      setIsSubmitting(true);
      await saveLead(updatedAnswers, true);
      setIsSubmitting(false);
      
      // Fire CompleteRegistration pixel event
      firePixelEvent('CompleteRegistration', { 
        funnel_id: funnel.id, 
        funnel_name: funnel.name,
        value: 50, // Default completion value
        currency: 'USD',
      }, `complete_${funnel.id}`);
    }

    // Move to next step
    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentStep, currentStepIndex, steps, answers, isLastStep, saveLead, hasMeaningfulData]);

  // Calculate question number for multi_choice steps (excluding welcome, thank_you, video)
  const questionSteps = steps.filter(s => 
    ['text_question', 'multi_choice', 'email_capture', 'phone_capture', 'opt_in'].includes(s.step_type)
  );

  const renderStep = (step: FunnelStep, isActive: boolean, stepIndex: number) => {
    // Calculate current question number for this step
    const questionIndex = questionSteps.findIndex(q => q.id === step.id);
    const currentQuestionNumber = questionIndex >= 0 ? questionIndex + 1 : undefined;
    const totalQuestions = questionSteps.length;

    const commonProps = {
      content: step.content,
      settings: funnel.settings,
      onNext: handleNext,
      isActive,
      currentStep: currentQuestionNumber,
      totalSteps: totalQuestions,
      onCalendlyBooking: handleCalendlyBooking,
    };

    switch (step.step_type) {
      case 'welcome':
        return <WelcomeStep {...commonProps} />;
      case 'text_question':
        return <TextQuestionStep {...commonProps} />;
      case 'multi_choice':
        return <MultiChoiceStep {...commonProps} />;
      case 'email_capture':
        return <EmailCaptureStep {...commonProps} />;
      case 'phone_capture':
        return <PhoneCaptureStep {...commonProps} />;
      case 'opt_in':
        return <OptInStep {...commonProps} />;
      case 'video':
        return <VideoStep {...commonProps} />;
      case 'embed':
        // Pass team Calendly URL if calendly_enabled_for_funnels is true and URL is configured
        const teamCalendlyUrl = teamCalendlySettings?.calendly_enabled_for_funnels 
          ? teamCalendlySettings.calendly_funnel_scheduling_url 
          : null;
        return <EmbedStep {...commonProps} teamCalendlyUrl={teamCalendlyUrl} />;
      case 'thank_you':
        return <ThankYouStep {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-x-hidden overflow-y-auto"
      style={{ backgroundColor: funnel.settings.background_color }}
    >
      {/* Logo */}
      {funnel.settings.logo_url && (
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
          <img
            src={funnel.settings.logo_url}
            alt="Logo"
            className="h-6 md:h-8 w-auto object-contain"
          />
        </div>
      )}

      {/* Progress Dots */}
      {!isThankYouStep && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
          <ProgressDots
            total={steps.length}
            current={currentStepIndex}
            primaryColor={funnel.settings.primary_color}
          />
        </div>
      )}

      {/* Steps Container - scrollable on each step */}
      <div className="min-h-screen w-full pt-16 md:pt-20 pb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'min-h-[calc(100vh-5rem)] w-full flex flex-col items-center justify-start py-4 md:py-8 px-4 md:px-6 transition-all duration-500 ease-out',
              index === currentStepIndex
                ? 'block opacity-100'
                : 'hidden opacity-0'
            )}
          >
            <div className="w-full max-w-2xl mx-auto">
              {renderStep(step, index === currentStepIndex, index)}
            </div>
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