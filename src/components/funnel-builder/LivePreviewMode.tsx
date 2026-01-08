// @ts-nocheck - Legacy funnel builder types need refactoring
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Smartphone, 
  Tablet, 
  Monitor,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FunnelStep, FunnelSettings, StepDesign } from '@/lib/funnel/editorTypes';
import { DynamicElementRenderer } from '@/components/funnel-public/DynamicElementRenderer';
import { getDefaultElementOrder } from '@/lib/funnel/stepRegistry';

interface LivePreviewModeProps {
  open: boolean;
  onClose: () => void;
  funnel: {
    id: string;
    team_id: string;
    name: string;
    slug: string;
    settings: FunnelSettings;
  };
  steps: FunnelStep[];
  dynamicElements?: Record<string, Record<string, any>>;
  stepDesigns?: Record<string, StepDesign>;
  elementOrders?: Record<string, string[]>;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const DEVICE_SIZES: Record<DeviceType, { width: string; height: string; label: string }> = {
  mobile: { width: '375px', height: '667px', label: 'Mobile' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
};

export function LivePreviewMode({ 
  open, 
  onClose, 
  funnel, 
  steps,
  dynamicElements: externalDynamicElements,
  stepDesigns: externalStepDesigns,
  elementOrders: externalElementOrders,
}: LivePreviewModeProps) {
  const [device, setDevice] = useState<DeviceType>('mobile');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1);
      }
      if (e.key === 'ArrowRight' && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, currentStepIndex, steps.length]);

  if (!open) return null;

  const currentStep = steps[currentStepIndex];
  const stepContent = currentStep?.content || {};
  
  // Use external state if provided, fallback to step content
  const stepDesign = (externalStepDesigns?.[currentStep?.id] || stepContent.design || {}) as Record<string, any>;
  const currentDynamicElements = externalDynamicElements?.[currentStep?.id] || stepContent.dynamic_elements || {};
  const elementOrder =
    externalElementOrders?.[currentStep?.id] ||
    stepContent.element_order ||
    getDefaultElementOrder(currentStep?.step_type);
  
  // Get background style for the step
  const getBackgroundStyle = () => {
    if (stepDesign.useGradient && stepDesign.gradientFrom && stepDesign.gradientTo) {
      return {
        background: `linear-gradient(${stepDesign.gradientDirection || 'to bottom'}, ${stepDesign.gradientFrom}, ${stepDesign.gradientTo})`
      };
    }
    return { backgroundColor: stepDesign.backgroundColor || funnel.settings.background_color };
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close Preview
          </Button>
          
          <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
            <Button
              variant={device === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setDevice('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variant={device === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setDevice('tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={device === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentStepIndex + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStepIndex === steps.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" asChild>
          <a href={`/f/${funnel.slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </a>
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center bg-zinc-900/50 overflow-hidden p-8">
        <div
          className={cn(
            "bg-background overflow-hidden transition-all duration-300",
            device !== 'desktop' && "rounded-3xl border-8 border-zinc-800 shadow-2xl"
          )}
          style={{
            width: DEVICE_SIZES[device].width,
            height: device === 'desktop' ? '100%' : DEVICE_SIZES[device].height,
            maxHeight: device === 'desktop' ? '100%' : '85vh',
          }}
        >
          <div 
            className="w-full h-full overflow-auto"
            style={getBackgroundStyle()}
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

            {/* Current Step Preview using DynamicElementRenderer */}
            <div className="min-h-full w-full flex items-center justify-center py-8 px-4">
              <div className="w-full max-w-lg mx-auto text-center">
                {/* Question progress indicator for multi-choice and question steps */}
                {['multi_choice', 'text_question', 'email_capture', 'phone_capture'].includes(currentStep?.step_type) && (() => {
                  const questionSteps = steps.filter(s => 
                    ['text_question', 'multi_choice', 'email_capture', 'phone_capture'].includes(s.step_type)
                  );
                  const questionIndex = questionSteps.findIndex(q => q.id === currentStep?.id);
                  if (questionIndex >= 0) {
                    return (
                      <p 
                        className="text-sm font-semibold mb-6 tracking-wide"
                        style={{ color: funnel.settings.primary_color }}
                      >
                        Question {questionIndex + 1} of {questionSteps.length}
                      </p>
                    );
                  }
                  return null;
                })()}
                
                <DynamicElementRenderer
                  elementOrder={elementOrder}
                  dynamicElements={currentDynamicElements}
                  content={stepContent}
                  settings={funnel.settings}
                  design={stepDesign}
                  stepType={currentStep?.step_type || 'welcome'}
                  isPreview={device === 'mobile'}
                  onButtonClick={() => {
                    if (currentStepIndex < steps.length - 1) {
                      setCurrentStepIndex(prev => prev + 1);
                    }
                  }}
                  renderInput={() => {
                    // Use the design settings for input styling
                    const inputBg = stepDesign.inputBg || '#ffffff';
                    const inputTextColor = stepDesign.inputTextColor || '#000000';
                    const inputBorder = stepDesign.inputBorder || '#e5e5e5';
                    const inputRadius = stepDesign.inputRadius ?? 12;
                    
                    return (
                      <div className="w-full max-w-xs mx-auto">
                        <input
                          type="text"
                          placeholder={stepContent.placeholder || 'Type your answer here...'}
                          className="w-full px-4 py-3 text-center outline-none transition-all"
                          style={{ 
                            backgroundColor: inputBg,
                            color: inputTextColor,
                            borderRadius: `${inputRadius}px`,
                            border: `1px solid ${inputBorder}`,
                          }}
                          readOnly
                        />
                        <button
                          className="w-full max-w-xs mt-4 px-6 py-3 font-semibold transition-all"
                          style={{ 
                            background: stepDesign.useButtonGradient && stepDesign.buttonGradientFrom 
                              ? `linear-gradient(${stepDesign.buttonGradientDirection || '135deg'}, ${stepDesign.buttonGradientFrom}, ${stepDesign.buttonGradientTo || stepDesign.buttonGradientFrom})`
                              : (stepDesign.buttonColor || funnel.settings.primary_color),
                            color: stepDesign.buttonTextColor || '#ffffff',
                            borderRadius: `${stepDesign.borderRadius ?? 12}px`,
                          }}
                        >
                          {stepContent.button_text || 'Continue'}
                        </button>
                      </div>
                    );
                  }}
                  renderOptions={() => {
                    const showNextBtn = stepContent.show_next_button !== false;
                    const nextBtnText = stepContent.next_button_text || 'Next Question';
                    
                    return (
                      <div className="space-y-3 w-full max-w-sm mx-auto">
                        {(stepContent.options || []).map((option: string | { text: string; emoji?: string }, i: number) => {
                          const optionText = typeof option === 'string' ? option : option.text;
                          const optionEmoji = typeof option === 'string' ? undefined : option.emoji;
                          
                          return (
                            <button
                              key={i}
                              className="w-full p-4 text-left rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 hover:scale-[1.02] flex items-center gap-4"
                            >
                              {/* Emoji on left */}
                              {optionEmoji && (
                                <span className="text-2xl shrink-0">{optionEmoji}</span>
                              )}
                              
                              {/* Text in middle */}
                              <span 
                                className="flex-1 font-medium text-base leading-snug"
                                style={{ color: stepDesign.textColor || '#ffffff' }}
                              >
                                {optionText}
                              </span>
                              
                              {/* Radio circle on right */}
                              <div className="w-6 h-6 rounded-full border-2 border-white/40 shrink-0" />
                            </button>
                          );
                        })}
                        
                        {/* Next Question Button */}
                        {showNextBtn && (
                          <button
                            className="w-full p-4 mt-2 rounded-xl font-semibold text-base transition-all opacity-50"
                            style={{ 
                              background: `linear-gradient(135deg, ${funnel.settings.primary_color}, ${funnel.settings.primary_color}dd)`,
                              color: stepDesign.buttonTextColor || '#ffffff'
                            }}
                          >
                            {nextBtnText}
                          </button>
                        )}
                      </div>
                    );
                  }}
                  renderForm={() => {
                    const inputBg = stepDesign.inputBg || '#ffffff';
                    const inputTextColor = stepDesign.inputTextColor || '#000000';
                    const inputBorder = stepDesign.inputBorder || '#e5e5e5';
                    const inputRadius = stepDesign.inputRadius ?? 12;
                    
                    return (
                      <div className="space-y-3 w-full max-w-sm mx-auto">
                        <div 
                          className="px-4 py-3 flex items-center gap-3"
                          style={{ 
                            backgroundColor: inputBg, 
                            borderRadius: `${inputRadius}px`,
                            border: `1px solid ${inputBorder}`,
                          }}
                        >
                          <span>{(stepContent as any).name_emoji || '👋'}</span>
                          <input 
                            type="text" 
                            placeholder={stepContent.name_placeholder || 'Your name'} 
                            className="flex-1 bg-transparent outline-none" 
                            style={{ color: inputTextColor }}
                            readOnly 
                          />
                        </div>
                        <div 
                          className="px-4 py-3 flex items-center gap-3"
                          style={{ 
                            backgroundColor: inputBg, 
                            borderRadius: `${inputRadius}px`,
                            border: `1px solid ${inputBorder}`,
                          }}
                        >
                          <span>{(stepContent as any).email_emoji || '✉️'}</span>
                          <input 
                            type="text" 
                            placeholder={stepContent.email_placeholder || 'Your email'} 
                            className="flex-1 bg-transparent outline-none" 
                            style={{ color: inputTextColor }}
                            readOnly 
                          />
                        </div>
                        <div 
                          className="px-4 py-3 flex items-center gap-3"
                          style={{ 
                            backgroundColor: inputBg, 
                            borderRadius: `${inputRadius}px`,
                            border: `1px solid ${inputBorder}`,
                          }}
                        >
                          <span>{(stepContent as any).phone_emoji || '📱'}</span>
                          <input 
                            type="text" 
                            placeholder={stepContent.phone_placeholder || 'Your phone'} 
                            className="flex-1 bg-transparent outline-none" 
                            style={{ color: inputTextColor }}
                            readOnly 
                          />
                        </div>
                        <button
                          className="w-full p-4 font-semibold transition-all"
                          style={{ 
                            background: stepDesign.useButtonGradient && stepDesign.buttonGradientFrom 
                              ? `linear-gradient(${stepDesign.buttonGradientDirection || '135deg'}, ${stepDesign.buttonGradientFrom}, ${stepDesign.buttonGradientTo || stepDesign.buttonGradientFrom})`
                              : (stepDesign.buttonColor || funnel.settings.primary_color),
                            color: stepDesign.buttonTextColor || '#ffffff',
                            borderRadius: `${stepDesign.borderRadius ?? 12}px`,
                          }}
                        >
                          {stepContent.submit_button_text || 'Continue'}
                        </button>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2 py-4 bg-card border-t">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStepIndex(index)}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              index === currentStepIndex 
                ? "bg-primary scale-110" 
                : "bg-muted hover:bg-muted-foreground/50"
            )}
            title={step.content.headline || `Step ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
