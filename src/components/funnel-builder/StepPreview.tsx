import { FunnelStep, FunnelSettings } from '@/pages/FunnelEditor';
import { cn } from '@/lib/utils';

interface StepDesign {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  borderRadius?: number;
  padding?: number;
  imageUrl?: string;
  imageSize?: 'S' | 'M' | 'L' | 'XL';
  imagePosition?: 'top' | 'bottom' | 'background';
}

interface StepPreviewProps {
  step: FunnelStep;
  settings: FunnelSettings;
  selectedElement: string | null;
  onSelectElement: (element: string | null) => void;
  design?: StepDesign;
}

const IMAGE_ASPECT_RATIOS = {
  S: '16/9',
  M: '4/3',
  L: '5/4',
  XL: '1/1',
};

const FONT_SIZE_MAP = {
  small: { headline: 'text-lg', subtext: 'text-xs' },
  medium: { headline: 'text-xl', subtext: 'text-sm' },
  large: { headline: 'text-2xl', subtext: 'text-base' },
};

export function StepPreview({ step, settings, selectedElement, onSelectElement, design }: StepPreviewProps) {
  const content = step.content;

  const textColor = design?.textColor || '#ffffff';
  const buttonColor = design?.buttonColor || settings.primary_color;
  const buttonTextColor = design?.buttonTextColor || '#ffffff';
  const fontFamily = design?.fontFamily || 'system-ui';
  const fontSize = design?.fontSize || 'medium';
  const borderRadius = design?.borderRadius ?? 12;

  const getEditableClass = (elementId: string) => cn(
    "cursor-pointer transition-all relative",
    selectedElement === elementId 
      ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded" 
      : "hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 hover:ring-offset-transparent rounded"
  );

  const renderImage = () => {
    if (!design?.imageUrl || design?.imagePosition === 'background') return null;
    
    const aspectRatio = IMAGE_ASPECT_RATIOS[design.imageSize || 'M'];
    
    return (
      <div 
        className="w-full max-w-[200px] mx-auto mb-4 rounded-lg overflow-hidden"
        style={{ aspectRatio }}
      >
        <img 
          src={design.imageUrl} 
          alt="" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  const renderWelcome = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center relative"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'background' && design?.imageUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${design.imageUrl})` }}
        />
      )}
      
      <div className="relative z-10">
        {design?.imagePosition === 'top' && renderImage()}
        
        {content.headline && (
          <h1 
            className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-4 leading-tight", getEditableClass('headline'))}
            style={{ color: textColor }}
            onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
          >
            {content.headline}
          </h1>
        )}

        {content.subtext && (
          <p 
            className={cn(FONT_SIZE_MAP[fontSize].subtext, "mb-6 opacity-70", getEditableClass('subtext'))}
            style={{ color: textColor }}
            onClick={(e) => { e.stopPropagation(); onSelectElement('subtext'); }}
          >
            {content.subtext}
          </p>
        )}

        {design?.imagePosition === 'bottom' && renderImage()}

        <button
          className={cn(
            "px-6 py-3 text-sm font-semibold transition-all",
            getEditableClass('button_text')
          )}
          style={{ 
            backgroundColor: buttonColor, 
            color: buttonTextColor,
            borderRadius: `${borderRadius}px`
          }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('button_text'); }}
        >
          {content.button_text || settings.button_text || 'Get Started'}
        </button>

        <p className="mt-3 text-xs" style={{ color: textColor, opacity: 0.4 }}>Press Enter ↵</p>
      </div>
    </div>
  );

  const renderTextQuestion = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'top' && renderImage()}
      
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-6 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      <div 
        className={cn("w-full max-w-xs", getEditableClass('placeholder'))}
        onClick={(e) => { e.stopPropagation(); onSelectElement('placeholder'); }}
      >
        <input
          type="text"
          placeholder={content.placeholder || 'Type here...'}
          className="w-full bg-white/10 border border-white/20 px-4 py-3 text-center"
          style={{ 
            color: textColor, 
            borderRadius: `${borderRadius}px`,
            '--tw-placeholder-opacity': '0.4'
          } as React.CSSProperties}
          readOnly
        />
      </div>

      {design?.imagePosition === 'bottom' && renderImage()}

      <p className="mt-3 text-xs" style={{ color: textColor, opacity: 0.4 }}>Press Enter ↵</p>
    </div>
  );

  const renderMultiChoice = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'top' && renderImage()}
      
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-6 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      <div 
        className={cn("w-full max-w-xs space-y-2", getEditableClass('options'))}
        onClick={(e) => { e.stopPropagation(); onSelectElement('options'); }}
      >
        {(content.options || []).map((option, index) => (
          <button
            key={index}
            className="w-full px-4 py-3 hover:opacity-80 transition-colors text-sm font-medium"
            style={{ 
              backgroundColor: buttonColor,
              color: buttonTextColor,
              borderRadius: `${borderRadius}px`
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {design?.imagePosition === 'bottom' && renderImage()}
    </div>
  );

  const renderEmailCapture = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'top' && renderImage()}
      
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-4 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      {content.subtext && (
        <p 
          className={cn(FONT_SIZE_MAP[fontSize].subtext, "mb-6 opacity-70", getEditableClass('subtext'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('subtext'); }}
        >
          {content.subtext}
        </p>
      )}

      <div 
        className={cn("w-full max-w-xs", getEditableClass('placeholder'))}
        onClick={(e) => { e.stopPropagation(); onSelectElement('placeholder'); }}
      >
        <input
          type="email"
          placeholder={content.placeholder || 'email@example.com'}
          className="w-full bg-white/10 border border-white/20 px-4 py-3 text-center"
          style={{ 
            color: textColor, 
            borderRadius: `${borderRadius}px`
          }}
          readOnly
        />
      </div>

      {design?.imagePosition === 'bottom' && renderImage()}

      <p className="mt-3 text-xs" style={{ color: textColor, opacity: 0.4 }}>Press Enter ↵</p>
    </div>
  );

  const renderPhoneCapture = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'top' && renderImage()}
      
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-4 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      {content.subtext && (
        <p 
          className={cn(FONT_SIZE_MAP[fontSize].subtext, "mb-6 opacity-70", getEditableClass('subtext'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('subtext'); }}
        >
          {content.subtext}
        </p>
      )}

      <div 
        className={cn("w-full max-w-xs", getEditableClass('placeholder'))}
        onClick={(e) => { e.stopPropagation(); onSelectElement('placeholder'); }}
      >
        <input
          type="tel"
          placeholder={content.placeholder || '(555) 123-4567'}
          className="w-full bg-white/10 border border-white/20 px-4 py-3 text-center"
          style={{ 
            color: textColor, 
            borderRadius: `${borderRadius}px`
          }}
          readOnly
        />
      </div>

      {design?.imagePosition === 'bottom' && renderImage()}

      <p className="mt-3 text-xs" style={{ color: textColor, opacity: 0.4 }}>Press Enter ↵</p>
    </div>
  );

  const renderVideo = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-4 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      <div 
        className={cn("w-full aspect-video bg-white/10 flex items-center justify-center mb-4", getEditableClass('video_url'))}
        style={{ borderRadius: `${borderRadius}px` }}
        onClick={(e) => { e.stopPropagation(); onSelectElement('video_url'); }}
      >
        {content.video_url ? (
          <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>Video Preview</span>
        ) : (
          <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>No video URL</span>
        )}
      </div>

      <button
        className={cn(
          "px-6 py-3 text-sm font-semibold",
          getEditableClass('button_text')
        )}
        style={{ 
          backgroundColor: buttonColor, 
          color: buttonTextColor,
          borderRadius: `${borderRadius}px`
        }}
        onClick={(e) => { e.stopPropagation(); onSelectElement('button_text'); }}
      >
        {content.button_text || 'Continue'}
      </button>
    </div>
  );

  const renderThankYou = () => (
    <div 
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      style={{ fontFamily }}
    >
      {design?.imagePosition === 'top' && renderImage()}
      
      {content.headline && (
        <h1 
          className={cn(FONT_SIZE_MAP[fontSize].headline, "font-bold mb-4 leading-tight", getEditableClass('headline'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('headline'); }}
        >
          {content.headline}
        </h1>
      )}

      {content.subtext && (
        <p 
          className={cn(FONT_SIZE_MAP[fontSize].subtext, "opacity-70", getEditableClass('subtext'))}
          style={{ color: textColor }}
          onClick={(e) => { e.stopPropagation(); onSelectElement('subtext'); }}
        >
          {content.subtext}
        </p>
      )}

      {design?.imagePosition === 'bottom' && renderImage()}
    </div>
  );

  const renderStep = () => {
    switch (step.step_type) {
      case 'welcome':
        return renderWelcome();
      case 'text_question':
        return renderTextQuestion();
      case 'multi_choice':
        return renderMultiChoice();
      case 'email_capture':
        return renderEmailCapture();
      case 'phone_capture':
        return renderPhoneCapture();
      case 'video':
        return renderVideo();
      case 'thank_you':
        return renderThankYou();
      default:
        return <div className="text-center" style={{ color: textColor, opacity: 0.5 }}>Unknown step type</div>;
    }
  };

  return (
    <div 
      className="w-full h-full" 
      onClick={() => onSelectElement(null)}
    >
      {/* Logo */}
      {settings.logo_url && (
        <div className="absolute top-14 left-4 z-10">
          <img
            src={settings.logo_url}
            alt="Logo"
            className="h-5 w-auto object-contain"
          />
        </div>
      )}

      {renderStep()}
    </div>
  );
}
