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
import { FunnelStep, FunnelSettings } from '@/pages/FunnelEditor';
import { DynamicElementRenderer } from '@/components/funnel-public/DynamicElementRenderer';

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
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const DEVICE_SIZES: Record<DeviceType, { width: string; height: string; label: string }> = {
  mobile: { width: '375px', height: '667px', label: 'Mobile' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
};

const DEFAULT_ELEMENT_ORDERS: Record<string, string[]> = {
  welcome: ['headline', 'subtext', 'video', 'button'],
  text_question: ['headline', 'input'],
  multi_choice: ['headline', 'options'],
  email_capture: ['headline', 'subtext', 'input'],
  phone_capture: ['headline', 'subtext', 'input'],
  video: ['headline', 'video', 'button'],
  thank_you: ['headline', 'subtext'],
};

export function LivePreviewMode({ open, onClose, funnel, steps }: LivePreviewModeProps) {
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
  const stepDesign = (stepContent.design || {}) as Record<string, any>;
  
  // Get background style for the step
  const getBackgroundStyle = () => {
    if (stepDesign.useGradient && stepDesign.gradientFrom && stepDesign.gradientTo) {
      return {
        background: `linear-gradient(${stepDesign.gradientDirection || 'to bottom'}, ${stepDesign.gradientFrom}, ${stepDesign.gradientTo})`
      };
    }
    return { backgroundColor: stepDesign.backgroundColor || funnel.settings.background_color };
  };

  // Determine element order
  const elementOrder = stepContent.element_order?.length > 0 
    ? stepContent.element_order 
    : DEFAULT_ELEMENT_ORDERS[currentStep?.step_type] || ['headline', 'subtext', 'button'];

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
                <DynamicElementRenderer
                  elementOrder={elementOrder}
                  dynamicElements={stepContent.dynamic_elements || {}}
                  content={stepContent}
                  settings={funnel.settings}
                  design={stepDesign}
                  stepType={currentStep?.step_type || 'welcome'}
                  onButtonClick={() => {
                    if (currentStepIndex < steps.length - 1) {
                      setCurrentStepIndex(prev => prev + 1);
                    }
                  }}
                  renderInput={() => (
                    <input
                      type="text"
                      placeholder={stepContent.placeholder || 'Enter your answer...'}
                      className="w-full max-w-xs mx-auto bg-white/10 border border-white/20 px-4 py-3 rounded-xl text-center"
                      style={{ color: stepDesign.textColor || '#ffffff' }}
                      readOnly
                    />
                  )}
                  renderOptions={() => (
                    <div className="space-y-2 w-full max-w-xs mx-auto">
                      {(stepContent.options || []).map((option: string, i: number) => (
                        <button
                          key={i}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                          style={{ 
                            backgroundColor: stepDesign.buttonColor || funnel.settings.primary_color, 
                            color: stepDesign.buttonTextColor || '#ffffff',
                            borderRadius: `${stepDesign.borderRadius ?? 12}px`
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
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