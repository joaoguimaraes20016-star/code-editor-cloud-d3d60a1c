import type { ComponentType } from 'react';
import type { StepComponentProps } from './types';
import { WelcomeStep } from './WelcomeStep';
import { TextQuestionStep } from './TextQuestionStep';
import { MultiChoiceStep } from './MultiChoiceStep';
import { EmailCaptureStep } from './EmailCaptureStep';
import { PhoneCaptureStep } from './PhoneCaptureStep';
import { OptInStep } from './OptInStep';
import { VideoStep } from './VideoStep';
import { EmbedStep } from './EmbedStep';
import { ThankYouStep } from './ThankYouStep';

export const STEP_COMPONENT_MAP: Record<string, ComponentType<StepComponentProps>> = {
  welcome: WelcomeStep,
  text_question: TextQuestionStep,
  multi_choice: MultiChoiceStep,
  email_capture: EmailCaptureStep,
  phone_capture: PhoneCaptureStep,
  opt_in: OptInStep,
  video: VideoStep,
  embed: EmbedStep,
  thank_you: ThankYouStep,
};

export function getStepComponent(stepType: string): ComponentType<StepComponentProps> | null {
  return STEP_COMPONENT_MAP[stepType] ?? null;
}
