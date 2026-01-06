import type { ReactNode } from "react";
import type { StepType } from "@/lib/funnel/types";
import { WelcomeStep } from "@/components/funnel-public/WelcomeStep";
import { TextQuestionStep } from "@/components/funnel-public/TextQuestionStep";
import { MultiChoiceStep } from "@/components/funnel-public/MultiChoiceStep";
import { EmailCaptureStep } from "@/components/funnel-public/EmailCaptureStep";
import { PhoneCaptureStep } from "@/components/funnel-public/PhoneCaptureStep";
import { VideoStep } from "@/components/funnel-public/VideoStep";
import { ThankYouStep } from "@/components/funnel-public/ThankYouStep";
import { OptInStep } from "@/components/funnel-public/OptInStep";
import { EmbedStep } from "@/components/funnel-public/EmbedStep";

type StepContent = Record<string, any>;

export interface StepRenderCommonProps {
  content: StepContent;
  settings: Record<string, any>;
  onNext: (value?: any) => void;
  isActive: boolean;
  currentStep?: number;
  totalSteps?: number;
  onCalendlyBooking?: (data: any) => void;
}

export interface ConsentRenderContext {
  termsUrl: string;
  showConsentCheckbox: boolean;
  consentChecked: boolean;
  consentError: string | null;
  onConsentChange: (checked: boolean) => void;
}

export interface EmbedRenderContext {
  teamCalendlyUrl: string | null;
}

export interface StepRenderContext {
  commonProps: StepRenderCommonProps;
  debugBadge?: ReactNode;
  consent?: ConsentRenderContext;
  embed?: EmbedRenderContext;
}

export interface StepRegistryEntry {
  type: StepType;
  isQuestion: boolean;
  previewElementOrder: string[];
  renderPublic: (context: StepRenderContext) => React.ReactNode;
}

export const STEP_REGISTRY: Record<StepType, StepRegistryEntry> = {
  welcome: {
    type: "welcome",
    isQuestion: false,
    previewElementOrder: ["image_top", "headline", "subtext", "button", "hint"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <WelcomeStep {...commonProps} />
      </>
    ),
  },
  text_question: {
    type: "text_question",
    isQuestion: true,
    previewElementOrder: ["image_top", "headline", "input", "hint"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <TextQuestionStep {...commonProps} />
      </>
    ),
  },
  multi_choice: {
    type: "multi_choice",
    isQuestion: true,
    previewElementOrder: ["image_top", "headline", "options"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <MultiChoiceStep {...commonProps} />
      </>
    ),
  },
  email_capture: {
    type: "email_capture",
    isQuestion: true,
    previewElementOrder: ["image_top", "headline", "subtext", "input", "hint"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <EmailCaptureStep {...commonProps} />
      </>
    ),
  },
  phone_capture: {
    type: "phone_capture",
    isQuestion: true,
    previewElementOrder: ["image_top", "headline", "subtext", "input", "hint"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <PhoneCaptureStep {...commonProps} />
      </>
    ),
  },
  opt_in: {
    type: "opt_in",
    isQuestion: true,
    previewElementOrder: ["image_top", "headline", "opt_in_form"],
    renderPublic: ({ commonProps, debugBadge, consent }) => (
      <>
        {debugBadge}
        <OptInStep
          {...commonProps}
          termsUrl={consent?.termsUrl || ""}
          showConsentCheckbox={consent?.showConsentCheckbox || false}
          consentChecked={consent?.consentChecked || false}
          consentError={consent?.consentError || null}
          onConsentChange={consent?.onConsentChange || (() => {})}
        />
      </>
    ),
  },
  video: {
    type: "video",
    isQuestion: false,
    previewElementOrder: ["headline", "video", "button"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <VideoStep {...commonProps} />
      </>
    ),
  },
  embed: {
    type: "embed",
    isQuestion: false,
    previewElementOrder: ["headline", "embed", "button"],
    renderPublic: ({ commonProps, debugBadge, embed }) => (
      <>
        {debugBadge}
        <EmbedStep {...commonProps} teamCalendlyUrl={embed?.teamCalendlyUrl || null} />
      </>
    ),
  },
  thank_you: {
    type: "thank_you",
    isQuestion: false,
    previewElementOrder: ["image_top", "headline", "subtext"],
    renderPublic: ({ commonProps, debugBadge }) => (
      <>
        {debugBadge}
        <ThankYouStep {...commonProps} />
      </>
    ),
  },
};

export const getStepRegistryEntry = (stepType?: string): StepRegistryEntry | null => {
  if (!stepType) return null;
  return STEP_REGISTRY[stepType as StepType] ?? null;
};

export const getQuestionStepTypes = (): StepType[] =>
  Object.values(STEP_REGISTRY)
    .filter((entry) => entry.isQuestion)
    .map((entry) => entry.type);

export const getPreviewElementOrder = (stepType?: string): string[] => {
  const entry = getStepRegistryEntry(stepType);
  return entry?.previewElementOrder ?? ["headline", "subtext", "button"];
};

export const getDefaultElementOrder = (stepType?: string): string[] => {
  return getPreviewElementOrder(stepType);
};
