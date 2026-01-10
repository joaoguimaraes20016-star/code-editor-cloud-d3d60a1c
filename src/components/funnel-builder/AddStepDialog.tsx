import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, MessageSquare, List, Mail, Phone, Video, CheckCircle, UserCheck } from 'lucide-react';
import type { FunnelStep } from '@/lib/funnel/editorTypes';

interface AddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStep: (stepType: FunnelStep['step_type']) => void;
}

const stepTypes: { type: FunnelStep['step_type']; label: string; description: string; icon: typeof Play }[] = [
  { type: 'welcome', label: 'Welcome', description: 'Start with a headline and CTA', icon: Play },
  { type: 'text_question', label: 'Text Question', description: 'Ask an open-ended question', icon: MessageSquare },
  { type: 'multi_choice', label: 'Multi Choice', description: 'Multiple choice selection', icon: List },
  { type: 'email_capture', label: 'Email', description: 'Collect email address', icon: Mail },
  { type: 'phone_capture', label: 'Phone', description: 'Collect phone number', icon: Phone },
  { type: 'opt_in', label: 'Opt-In', description: 'Contact form with consent', icon: UserCheck },
  { type: 'video', label: 'Video', description: 'Embed a video with CTA', icon: Video },
  { type: 'thank_you', label: 'Thank You', description: 'Final confirmation step', icon: CheckCircle },
];

export function AddStepDialog({ open, onOpenChange, onAddStep }: AddStepDialogProps) {
  const handleAddStep = (type: FunnelStep['step_type']) => {
    onAddStep(type);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Page</DialogTitle>
          <DialogDescription>Select a step type to add to your funnel.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          {stepTypes.map(({ type, label, description, icon: Icon }) => (
            <Button
              key={type}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/10 hover:border-primary/50"
              onClick={() => handleAddStep(type)}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{label}</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">{description}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
