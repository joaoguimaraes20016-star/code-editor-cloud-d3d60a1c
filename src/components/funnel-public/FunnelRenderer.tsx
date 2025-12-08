import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WelcomeStep } from './WelcomeStep';
import { TextQuestionStep } from './TextQuestionStep';
import { MultiChoiceStep } from './MultiChoiceStep';
import { EmailCaptureStep } from './EmailCaptureStep';
import { PhoneCaptureStep } from './PhoneCaptureStep';
import { VideoStep } from './VideoStep';
import { ThankYouStep } from './ThankYouStep';
import { ProgressDots } from './ProgressDots';
import { cn } from '@/lib/utils';

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
}

interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  settings: FunnelSettings;
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

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isThankYouStep = currentStep?.step_type === 'thank_you';

  const handleNext = useCallback(async (value?: any) => {
    // Save answer if value provided
    if (value !== undefined && currentStep) {
      setAnswers((prev) => ({
        ...prev,
        [currentStep.id]: {
          value,
          step_type: currentStep.step_type,
          content: currentStep.content,
        },
      }));
    }

    // If this is the step before thank you, submit the form
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep?.step_type === 'thank_you') {
      setIsSubmitting(true);
      try {
        // Collect all answers including current
        const allAnswers = {
          ...answers,
          ...(value !== undefined && currentStep
            ? {
                [currentStep.id]: {
                  value,
                  step_type: currentStep.step_type,
                  content: currentStep.content,
                },
              }
            : {}),
        };

        // Submit to edge function
        const { error } = await supabase.functions.invoke('submit-funnel-lead', {
          body: {
            funnel_id: funnel.id,
            answers: allAnswers,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
          },
        });

        if (error) {
          console.error('Failed to submit lead:', error);
        }
      } catch (err) {
        console.error('Error submitting lead:', err);
      } finally {
        setIsSubmitting(false);
      }
    }

    // Move to next step
    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentStep, currentStepIndex, steps, answers, funnel.id, utmSource, utmMedium, utmCampaign, isLastStep]);

  const renderStep = (step: FunnelStep, isActive: boolean) => {
    const commonProps = {
      content: step.content,
      settings: funnel.settings,
      onNext: handleNext,
      isActive,
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
      case 'video':
        return <VideoStep {...commonProps} />;
      case 'thank_you':
        return <ThankYouStep {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{ backgroundColor: funnel.settings.background_color }}
    >
      {/* Logo */}
      {funnel.settings.logo_url && (
        <div className="absolute top-6 left-6 z-10">
          <img
            src={funnel.settings.logo_url}
            alt="Logo"
            className="h-8 w-auto object-contain"
          />
        </div>
      )}

      {/* Progress Dots */}
      {!isThankYouStep && (
        <div className="absolute top-6 right-6 z-10">
          <ProgressDots
            total={steps.length}
            current={currentStepIndex}
            primaryColor={funnel.settings.primary_color}
          />
        </div>
      )}

      {/* Steps Container - All steps rendered, visibility controlled by CSS */}
      <div className="relative min-h-screen w-full">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'absolute inset-0 flex items-center justify-center p-6 transition-all duration-500 ease-out',
              index === currentStepIndex
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : index < currentStepIndex
                ? 'opacity-0 -translate-y-8 pointer-events-none'
                : 'opacity-0 translate-y-8 pointer-events-none'
            )}
          >
            {renderStep(step, index === currentStepIndex)}
          </div>
        ))}
      </div>

      {/* Loading overlay during submission */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
