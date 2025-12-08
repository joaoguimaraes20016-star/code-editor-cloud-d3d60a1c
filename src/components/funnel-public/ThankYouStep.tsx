import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface ThankYouStepProps {
  content: {
    headline?: string;
    subtext?: string;
    redirect_url?: string;
  };
  settings: {
    primary_color: string;
  };
  onNext: () => void;
  isActive: boolean;
}

export function ThankYouStep({ content, settings, isActive }: ThankYouStepProps) {
  useEffect(() => {
    if (isActive && content.redirect_url) {
      const timer = setTimeout(() => {
        window.location.href = content.redirect_url!;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isActive, content.redirect_url]);

  return (
    <div className="w-full max-w-xl text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
        style={{ backgroundColor: `${settings.primary_color}20` }}
      >
        <CheckCircle
          className="w-10 h-10"
          style={{ color: settings.primary_color }}
        />
      </div>

      {content.headline && (
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {content.headline}
        </h2>
      )}

      {content.subtext && (
        <p className="text-lg md:text-xl text-white/70">
          {content.subtext}
        </p>
      )}

      {content.redirect_url && (
        <p className="mt-8 text-white/40 text-sm">
          Redirecting in 3 seconds...
        </p>
      )}
    </div>
  );
}
