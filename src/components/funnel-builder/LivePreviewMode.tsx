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
import { FunnelRenderer } from '@/components/funnel-public/FunnelRenderer';

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

  const DeviceIcon = device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Monitor;

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
          <div className="w-full h-full overflow-auto">
            {/* Render single step based on index */}
            <div
              className="min-h-full w-full flex items-center justify-center"
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

              {/* Current Step Preview */}
              <div className="w-full max-w-lg mx-auto p-6 text-center">
                <PreviewStep 
                  step={steps[currentStepIndex]} 
                  settings={funnel.settings}
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

function PreviewStep({ step, settings }: { step: FunnelStep; settings: FunnelSettings }) {
  const textColor = '#ffffff';
  const buttonColor = settings.primary_color;

  switch (step.step_type) {
    case 'welcome':
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {step.content.headline || 'Welcome'}
          </h1>
          {step.content.subtext && (
            <p className="text-sm opacity-70" style={{ color: textColor }}>
              {step.content.subtext}
            </p>
          )}
          <button
            className="px-6 py-3 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: buttonColor }}
          >
            {step.content.button_text || settings.button_text || 'Get Started'}
          </button>
        </div>
      );
    case 'text_question':
    case 'email_capture':
    case 'phone_capture':
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {step.content.headline}
          </h1>
          <input
            type="text"
            placeholder={step.content.placeholder}
            className="w-full max-w-xs mx-auto bg-white/10 border border-white/20 px-4 py-3 rounded-xl text-center"
            style={{ color: textColor }}
            readOnly
          />
        </div>
      );
    case 'multi_choice':
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {step.content.headline}
          </h1>
          <div className="space-y-2 max-w-xs mx-auto">
            {(step.content.options || []).map((option: string, i: number) => (
              <button
                key={i}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: buttonColor }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    case 'video':
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {step.content.headline}
          </h1>
          <div 
            className="w-full aspect-video bg-white/10 rounded-xl flex items-center justify-center"
          >
            <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>
              Video Preview
            </span>
          </div>
          <button
            className="px-6 py-3 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: buttonColor }}
          >
            {step.content.button_text || 'Continue'}
          </button>
        </div>
      );
    case 'thank_you':
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {step.content.headline || 'Thank You!'}
          </h1>
          {step.content.subtext && (
            <p className="text-sm opacity-70" style={{ color: textColor }}>
              {step.content.subtext}
            </p>
          )}
        </div>
      );
    default:
      return null;
  }
}