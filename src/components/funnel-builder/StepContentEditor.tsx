import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Type, Video, Image, Square, Minus, AlertTriangle, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FunnelStep } from '@/pages/FunnelEditor';
import { cn } from '@/lib/utils';
import { EmojiPicker } from './EmojiPicker';
import { 
  getDefaultIntent, 
  getAllowedIntents, 
  isIntentLocked,
  getStepTypeLabel,
  INTENT_LABELS,
  INTENT_DESCRIPTIONS,
  getStepDefinition,
} from '@/lib/funnel/stepDefinitions';
import type { StepIntent } from '@/lib/funnel/types';
import getStepIntent from '@/lib/funnels/stepIntent';
import { getPreviewElementOrder } from '@/lib/funnel/stepRegistry';

// Strip HTML tags and decode entities for display in input fields
const stripHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

interface StepContentEditorProps {
  step: FunnelStep;
  onUpdate: (patch: Partial<FunnelStep['content']>) => void;
  selectedElement?: string | null;
  elementOrder?: string[];
  dynamicContent?: Record<string, any>;
  onUpdateDynamicContent?: (elementId: string, value: any) => void;
}

const getElementTypeLabel = (elementId: string) => {
  if (elementId.startsWith('text_')) return 'Text Block';
  if (elementId.startsWith('headline_')) return 'Headline';
  if (elementId.startsWith('video_')) return 'Video';
  if (elementId.startsWith('image_')) return 'Image';
  if (elementId.startsWith('button_')) return 'Button';
  if (elementId.startsWith('divider_')) return 'Divider';
  if (elementId.startsWith('embed_')) return 'Embed';
  return elementId;
};

const getElementIcon = (elementId: string) => {
  if (elementId.startsWith('text_')) return Type;
  if (elementId.startsWith('headline_')) return Type;
  if (elementId.startsWith('video_')) return Video;
  if (elementId.startsWith('image_')) return Image;
  if (elementId.startsWith('button_')) return Square;
  if (elementId.startsWith('divider_')) return Minus;
  if (elementId.startsWith('embed_')) return Square;
  return Type;
};

export function StepContentEditor({ 
  step, 
  onUpdate, 
  selectedElement,
  elementOrder = [],
  dynamicContent = {},
  onUpdateDynamicContent
}: StepContentEditorProps) {
  const content = step.content;
  const headlineRef = useRef<HTMLInputElement>(null);
  const subtextRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLInputElement>(null);
  const placeholderRef = useRef<HTMLInputElement>(null);

  // Get step definition for this step type
  const stepDefinition = getStepDefinition(step.step_type);
  
  // Current intent (from content or inferred via helper) - using canonical source
  // We initialize using `getStepIntent` so existing funnels get reasonable defaults
  // but we still persist only when the user explicitly changes the dropdown.
  const currentIntent: StepIntent = (content.intent as StepIntent) || getStepIntent(step);
  
  // Get allowed intents and locked status from step definition
  const allowedIntents = getAllowedIntents(step.step_type);
  const intentLocked = isIntentLocked(step.step_type);
  const effectiveElementOrder = elementOrder.length > 0
    ? elementOrder
    : content.element_order && content.element_order.length > 0
      ? content.element_order
      : getPreviewElementOrder(step.step_type);
  const hasHeadline = effectiveElementOrder.includes('headline') || effectiveElementOrder.some(id => id.startsWith('headline_'));
  const hasSubtext = effectiveElementOrder.includes('subtext');
  const hasButton = effectiveElementOrder.includes('button') || effectiveElementOrder.some(id => id.startsWith('button_'));
  const hasInput = effectiveElementOrder.includes('input') || effectiveElementOrder.includes('opt_in_form');
  const hasVideo = effectiveElementOrder.includes('video') || effectiveElementOrder.some(id => id.startsWith('video_'));
  const hasOptions = effectiveElementOrder.includes('options');
  const hasEmbed = effectiveElementOrder.includes('embed') || effectiveElementOrder.some(id => id.startsWith('embed_'));
  const requiresInput = stepDefinition?.validation?.requiresInput === true;

  // Auto-focus based on selected element
  useEffect(() => {
    if (selectedElement === 'headline') headlineRef.current?.focus();
    if (selectedElement === 'subtext') subtextRef.current?.focus();
    if (selectedElement === 'button_text') buttonRef.current?.focus();
    if (selectedElement === 'placeholder') placeholderRef.current?.focus();
  }, [selectedElement]);

  const updateField = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const isHighlighted = (field: string) => selectedElement === field;

  // Filter dynamic elements from the element order
  const dynamicElementIds = effectiveElementOrder.filter(id => 
    id.startsWith('text_') || 
    id.startsWith('headline_') || 
    id.startsWith('video_') || 
    id.startsWith('image_') || 
    id.startsWith('button_') || 
    id.startsWith('divider_') ||
    id.startsWith('embed_')
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">
          Content
        </h3>
        <p className="text-xs text-muted-foreground">
          {getStepTypeLabel(step.step_type)}
        </p>
      </div>

      {/* Step Intent Selector - Uses canonical step definitions */}
      <div className="space-y-2 p-3 -mx-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Step Intent</Label>
          {intentLocked && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
        </div>
        
        {intentLocked ? (
          <div className="px-3 py-2 rounded-md bg-muted text-sm">
            {INTENT_LABELS[currentIntent]}
          </div>
        ) : (
          <Select
            value={currentIntent}
            onValueChange={(value: StepIntent) => updateField('intent', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedIntents.map((intent) => (
                <SelectItem key={intent} value={intent}>
                  <div className="flex flex-col">
                    <span>{INTENT_LABELS[intent]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <p className="text-xs text-muted-foreground">
          {INTENT_DESCRIPTIONS[currentIntent]}
        </p>
        
        {/* Submit authority warning */}
        {currentIntent === 'capture' && stepDefinition?.capabilities.canFinalizeLead && (
          <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This step will submit the lead. Only one step per funnel should be set to Submit.
            </p>
          </div>
        )}
      </div>

      {/* Headline - all types */}
      {hasHeadline && (
        <div 
          id="editor-section-headline"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('headline') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Headline</Label>
          <Input
            ref={headlineRef}
            // Display stripped text but preserve HTML on change
            value={stripHtml(content.headline || '')}
            onChange={(e) => updateField('headline', e.target.value)}
            placeholder="Enter headline..."
          />
        </div>
      )}

      {/* Subtext - most types */}
      {hasSubtext && step.step_type !== 'multi_choice' && (
        <div 
          id="editor-section-subtext"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('subtext') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Subtext</Label>
          <Textarea
            ref={subtextRef}
            value={content.subtext || ''}
            onChange={(e) => updateField('subtext', e.target.value)}
            placeholder="Additional text (optional)..."
            rows={2}
          />
        </div>
      )}

      {/* Button text - welcome, video */}
      {hasButton && (step.step_type === 'welcome' || step.step_type === 'video') && (
        <div 
          id="editor-section-button"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('button_text') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Button Text</Label>
          <Input
            ref={buttonRef}
            value={content.button_text || ''}
            onChange={(e) => updateField('button_text', e.target.value)}
            placeholder="Continue"
          />
        </div>
      )}

      {/* Placeholder - text_question, email, phone */}
      {hasInput && (step.step_type === 'text_question' || step.step_type === 'email_capture' || step.step_type === 'phone_capture') && (
        <div 
          id="editor-section-placeholder"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('placeholder') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Placeholder</Label>
          <Input
            ref={placeholderRef}
            value={content.placeholder || ''}
            onChange={(e) => updateField('placeholder', e.target.value)}
            placeholder="Type here..."
          />
        </div>
      )}

      {/* Submit Button Text - text_question, email, phone */}
      {hasInput && (step.step_type === 'text_question' || step.step_type === 'email_capture' || step.step_type === 'phone_capture') && (
        <div 
          id="editor-section-submit-button"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('submit_button') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Submit Button Text</Label>
          <Input
            value={content.submit_button_text || 'Submit'}
            onChange={(e) => updateField('submit_button_text', e.target.value)}
            placeholder="Submit"
          />
        </div>
      )}

      {/* Video URL */}
      {hasVideo && step.step_type === 'video' && (
        <div 
          id="editor-section-video"
          className={cn(
          "space-y-2 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('video_url') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Video URL</Label>
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
      {hasOptions && step.step_type === 'multi_choice' && (
        <div 
          id="editor-section-options"
          className={cn(
          "space-y-3 p-3 -mx-3 rounded-lg transition-colors",
          isHighlighted('options') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <Label className="text-xs">Answer Options</Label>
          <div className="space-y-2">
            {(content.options || []).map((option: string | { text: string; emoji?: string }, index: number) => {
              const optionText = typeof option === 'string' ? option : option.text;
              const optionEmoji = typeof option === 'string' ? undefined : option.emoji;
              
              return (
                <div key={index} className="flex items-center gap-2">
                  <EmojiPicker
                    value={optionEmoji}
                    onChange={(emoji) => {
                      const newOptions = [...(content.options || [])];
                      newOptions[index] = { text: optionText, emoji };
                      updateField('options', newOptions);
                    }}
                  />
                  <Input
                    value={optionText}
                    onChange={(e) => {
                      const newOptions = [...(content.options || [])];
                      newOptions[index] = { text: e.target.value, emoji: optionEmoji };
                      updateField('options', newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  {(content.options || []).length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        const newOptions = (content.options || []).filter((_: any, i: number) => i !== index);
                        updateField('options', newOptions);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOptions = [...(content.options || []), { text: `Option ${(content.options || []).length + 1}`, emoji: undefined }];
              updateField('options', newOptions);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
          
          {/* Next Question Button Settings */}
          <div className="border-t pt-3 mt-3 space-y-2">
            <Label className="text-xs">Next Button Text</Label>
            <Input
              value={content.next_button_text || 'Next Question'}
              onChange={(e) => updateField('next_button_text', e.target.value)}
              placeholder="Next Question"
            />
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Show Next Button</Label>
              <Switch
                checked={content.show_next_button !== false}
                onCheckedChange={(checked) => updateField('show_next_button', checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Shows after an option is selected
            </p>
          </div>
        </div>
      )}

      {/* Required toggle - questions only */}
      {requiresInput && (
        <div className="flex items-center justify-between p-3 -mx-3 rounded-lg">
          <Label className="text-xs">Required</Label>
          <Switch
            checked={content.is_required !== false}
            onCheckedChange={(checked) => updateField('is_required', checked)}
          />
        </div>
      )}

      {/* Opt-In Form Fields */}
      {step.step_type === 'opt_in' && hasInput && (
        <div 
          id="editor-section-optin"
          className={cn(
          "space-y-4 p-3 -mx-3 rounded-lg border-t pt-4",
          isHighlighted('optin') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
            Form Fields
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Name Icon</Label>
              <Input
                value={content.name_icon || '👋'}
                onChange={(e) => updateField('name_icon', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Name Placeholder</Label>
              <Input
                value={content.name_placeholder || ''}
                onChange={(e) => updateField('name_placeholder', e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Email Icon</Label>
              <Input
                value={content.email_icon || '✉️'}
                onChange={(e) => updateField('email_icon', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Email Placeholder</Label>
              <Input
                value={content.email_placeholder || ''}
                onChange={(e) => updateField('email_placeholder', e.target.value)}
                placeholder="Your email address"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Phone Icon</Label>
              <Input
                value={content.phone_icon || '🇺🇸'}
                onChange={(e) => updateField('phone_icon', e.target.value)}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Phone Placeholder</Label>
              <Input
                value={content.phone_placeholder || ''}
                onChange={(e) => updateField('phone_placeholder', e.target.value)}
                placeholder="Your phone number"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Privacy Checkbox Text</Label>
            <Input
              value={content.privacy_text || ''}
              onChange={(e) => updateField('privacy_text', e.target.value)}
              placeholder="I have read and accept the"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Privacy Policy Link (required if consent is required)</Label>
            <Input
              value={content.privacy_link || ''}
              onChange={(e) => {
                const value = e.target.value;
                const next = {
                  privacy_link: value,
                  // If a privacy link is provided on an opt-in step,
                  // treat it as consent-gated by default.
                  requires_consent: value ? true : content.requires_consent,
                  show_consent_checkbox: value ? true : content.show_consent_checkbox,
                };
                onUpdate(next);
              }}
              placeholder="https://yoursite.com/privacy"
            />
          </div>
          
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
            <div className="space-y-0.5">
              <Label className="text-xs">Require consent to submit</Label>
              <p className="text-[11px] text-muted-foreground">
                Step will be treated as consent-gated and blocked if unchecked.
              </p>
            </div>
            <Switch
              checked={content.requires_consent === true}
              onCheckedChange={(checked) => {
                const next = {
                  requires_consent: checked,
                  // When consent is required, always show checkbox.
                  show_consent_checkbox: checked ? true : content.show_consent_checkbox,
                };
                onUpdate(next);
              }}
            />
          </div>
          
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-xs">Show consent checkbox (UI only)</Label>
              <p className="text-[11px] text-muted-foreground">
                When consent is not required, this only shows the checkbox UI.
              </p>
            </div>
            <Switch
              checked={content.show_consent_checkbox !== false}
              disabled={content.requires_consent === true}
              onCheckedChange={(checked) => {
                const next = {
                  show_consent_checkbox: checked,
                };
                onUpdate(next);
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Consent Mode</Label>
            <Select
              value={content.consent_mode || ''}
              onValueChange={(value) => updateField('consent_mode', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Implicit (default if link present)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="implicit">Implicit (link present)</SelectItem>
                <SelectItem value="explicit">Explicit (stronger wording)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Submit Button Text</Label>
            <Input
              value={content.submit_button_text || 'Submit and proceed'}
              onChange={(e) => updateField('submit_button_text', e.target.value)}
              placeholder="Submit and proceed"
            />
          </div>
        </div>
      )}

      {/* Redirect URL - thank_you only */}
      {step.step_type === 'thank_you' && (
        <div className="space-y-2 p-3 -mx-3 rounded-lg">
          <Label className="text-xs">Redirect URL (optional)</Label>
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

      {/* Embed URL and Height - embed only */}
      {hasEmbed && step.step_type === 'embed' && (
        <div 
          id="editor-section-embed"
          className={cn(
          "space-y-4 p-3 -mx-3 rounded-lg",
          isHighlighted('embed_url') && "bg-primary/10 ring-1 ring-primary/30"
        )}>
          <div className="space-y-2">
            <Label className="text-xs">Embed URL</Label>
            <Input
              value={content.embed_url || ''}
              onChange={(e) => updateField('embed_url', e.target.value)}
              placeholder="https://calendly.com/your-link"
            />
            <p className="text-xs text-muted-foreground">
              Paste any URL to embed (Calendly, Typeform, YouTube, etc.)
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Scale ({Math.round((content.embed_scale || 0.75) * 100)}%)</Label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={content.embed_scale || 0.75}
              onChange={(e) => updateField('embed_scale', parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust to fit Calendly without scrolling
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Continue Button Text (optional)</Label>
            <Input
              value={content.button_text || ''}
              onChange={(e) => updateField('button_text', e.target.value)}
              placeholder="Continue"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to hide the button
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Elements Section */}
      {dynamicElementIds.length > 0 && (
        <div id="dynamic-elements-section" className="border-t pt-4 mt-4">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Added Elements
          </h4>
          <div className="space-y-3">
            {dynamicElementIds.map((elementId) => {
              const Icon = getElementIcon(elementId);
              const elementData = dynamicContent[elementId] || {};
              
              return (
                <div 
                  key={elementId}
                  className={cn(
                    "p-3 -mx-3 rounded-lg border border-border/50 transition-colors",
                    isHighlighted(elementId) && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">{getElementTypeLabel(elementId)}</Label>
                  </div>
                  
                  {/* Text/Headline inputs - strip HTML for display */}
                  {(elementId.startsWith('text_') || elementId.startsWith('headline_') || elementId.startsWith('button_')) && (
                    <Input
                      value={stripHtml(elementData.text || '')}
                      onChange={(e) => onUpdateDynamicContent?.(elementId, { text: e.target.value })}
                      placeholder="Enter text..."
                      className="text-sm"
                    />
                  )}
                  
                  {/* Video URL input */}
                  {elementId.startsWith('video_') && (
                    <Input
                      value={elementData.video_url || ''}
                      onChange={(e) => onUpdateDynamicContent?.(elementId, { video_url: e.target.value })}
                      placeholder="https://youtube.com/..."
                      className="text-sm"
                    />
                  )}
                  
                  {/* Image URL input */}
                  {elementId.startsWith('image_') && (
                    <Input
                      value={elementData.image_url || ''}
                      onChange={(e) => onUpdateDynamicContent?.(elementId, { image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="text-sm"
                    />
                  )}
                  
                  {/* Divider - no input needed */}
                  {elementId.startsWith('divider_') && (
                    <p className="text-xs text-muted-foreground">Horizontal divider line</p>
                  )}
                  
                  {/* Embed URL and height inputs */}
                  {elementId.startsWith('embed_') && (
                    <div className="space-y-2">
                      <Input
                        value={elementData.embed_url || ''}
                        onChange={(e) => onUpdateDynamicContent?.(elementId, { ...elementData, embed_url: e.target.value })}
                        placeholder="https://calendly.com/your-link"
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Scale:</Label>
                        <input
                          type="range"
                          min="0.5"
                          max="1"
                          step="0.05"
                          value={elementData.embed_scale || 0.75}
                          onChange={(e) => onUpdateDynamicContent?.(elementId, { ...elementData, embed_scale: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-10">{Math.round((elementData.embed_scale || 0.75) * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
