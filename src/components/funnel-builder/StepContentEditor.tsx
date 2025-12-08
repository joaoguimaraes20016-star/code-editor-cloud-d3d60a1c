import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { FunnelStep } from '@/pages/FunnelEditor';

interface StepContentEditorProps {
  step: FunnelStep;
  onUpdate: (content: FunnelStep['content']) => void;
}

export function StepContentEditor({ step, onUpdate }: StepContentEditorProps) {
  const content = step.content;

  const updateField = (field: string, value: any) => {
    onUpdate({ ...content, [field]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Step Content
      </h3>

      {/* Headline - all types */}
      <div className="space-y-2">
        <Label>Headline</Label>
        <Input
          value={content.headline || ''}
          onChange={(e) => updateField('headline', e.target.value)}
          placeholder="Enter headline..."
        />
      </div>

      {/* Subtext - most types */}
      {step.step_type !== 'multi_choice' && (
        <div className="space-y-2">
          <Label>Subtext</Label>
          <Textarea
            value={content.subtext || ''}
            onChange={(e) => updateField('subtext', e.target.value)}
            placeholder="Additional text (optional)..."
            rows={2}
          />
        </div>
      )}

      {/* Button text - welcome, video */}
      {(step.step_type === 'welcome' || step.step_type === 'video') && (
        <div className="space-y-2">
          <Label>Button Text</Label>
          <Input
            value={content.button_text || ''}
            onChange={(e) => updateField('button_text', e.target.value)}
            placeholder="Continue"
          />
        </div>
      )}

      {/* Placeholder - text_question, email, phone */}
      {(step.step_type === 'text_question' || step.step_type === 'email_capture' || step.step_type === 'phone_capture') && (
        <div className="space-y-2">
          <Label>Placeholder</Label>
          <Input
            value={content.placeholder || ''}
            onChange={(e) => updateField('placeholder', e.target.value)}
            placeholder="Type here..."
          />
        </div>
      )}

      {/* Video URL */}
      {step.step_type === 'video' && (
        <div className="space-y-2">
          <Label>Video URL</Label>
          <Input
            value={content.video_url || ''}
            onChange={(e) => updateField('video_url', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-xs text-muted-foreground">
            Supports YouTube, Vimeo, and Wistia
          </p>
        </div>
      )}

      {/* Multi Choice Options */}
      {step.step_type === 'multi_choice' && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {(content.options || []).map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(content.options || [])];
                    newOptions[index] = e.target.value;
                    updateField('options', newOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                {(content.options || []).length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newOptions = (content.options || []).filter((_, i) => i !== index);
                      updateField('options', newOptions);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOptions = [...(content.options || []), `Option ${(content.options || []).length + 1}`];
              updateField('options', newOptions);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}

      {/* Required toggle - questions only */}
      {(step.step_type === 'text_question' || step.step_type === 'multi_choice' || step.step_type === 'email_capture' || step.step_type === 'phone_capture') && (
        <div className="flex items-center justify-between">
          <Label>Required</Label>
          <Switch
            checked={content.is_required !== false}
            onCheckedChange={(checked) => updateField('is_required', checked)}
          />
        </div>
      )}

      {/* Redirect URL - thank_you only */}
      {step.step_type === 'thank_you' && (
        <div className="space-y-2">
          <Label>Redirect URL (optional)</Label>
          <Input
            value={content.redirect_url || ''}
            onChange={(e) => updateField('redirect_url', e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-muted-foreground">
            Redirect to this URL after 3 seconds
          </p>
        </div>
      )}
    </div>
  );
}
