import { Button } from '@/components/ui/button';
import { 
  Play, 
  MessageSquare, 
  List, 
  Mail, 
  Phone, 
  Video, 
  CheckCircle,
  UserCheck,
  Code
} from 'lucide-react';

interface StepTypePaletteProps {
  onAddStep: (stepType: 'welcome' | 'text_question' | 'multi_choice' | 'email_capture' | 'phone_capture' | 'video' | 'thank_you' | 'opt_in' | 'embed') => void;
}

const stepTypes = [
  { type: 'welcome' as const, label: 'Welcome Screen', icon: Play, description: 'Hero text with CTA' },
  { type: 'text_question' as const, label: 'Text Question', icon: MessageSquare, description: 'Open text input' },
  { type: 'multi_choice' as const, label: 'Multi Choice', icon: List, description: 'Clickable options' },
  { type: 'email_capture' as const, label: 'Email Capture', icon: Mail, description: 'Email input field' },
  { type: 'phone_capture' as const, label: 'Phone Capture', icon: Phone, description: 'Phone input field' },
  { type: 'opt_in' as const, label: 'Opt-In Form', icon: UserCheck, description: 'Contact form with consent' },
  { type: 'video' as const, label: 'Video', icon: Video, description: 'Embed a video' },
  { type: 'embed' as const, label: 'Embed/iFrame', icon: Code, description: 'Embed any URL (Calendly, etc.)' },
  { type: 'thank_you' as const, label: 'Thank You', icon: CheckCircle, description: 'Confirmation screen' },
];

export function StepTypePalette({ onAddStep }: StepTypePaletteProps) {
  return (
    <div className="space-y-2">
      {stepTypes.map((step) => (
        <Button
          key={step.type}
          variant="ghost"
          className="w-full justify-start h-auto py-3 px-3"
          onClick={() => onAddStep(step.type)}
        >
          <step.icon className="h-5 w-5 mr-3 text-primary" />
          <div className="text-left">
            <div className="font-medium">{step.label}</div>
            <div className="text-xs text-muted-foreground">{step.description}</div>
          </div>
        </Button>
      ))}
    </div>
  );
}
