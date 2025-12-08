import { useEffect, useState } from 'react';
import { DynamicElementRenderer } from './DynamicElementRenderer';

interface VideoStepProps {
  content: {
    headline?: string;
    video_url?: string;
    button_text?: string;
    element_order?: string[];
    dynamic_elements?: Record<string, any>;
    design?: any;
  };
  settings: {
    primary_color: string;
    button_text: string;
  };
  onNext: () => void;
  isActive: boolean;
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }

  // Wistia
  const wistiaMatch = url.match(/wistia\.com\/medias\/([^\s&]+)/);
  if (wistiaMatch) {
    return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}?autoPlay=true`;
  }

  // If it's already an embed URL, return as-is
  if (url.includes('embed') || url.includes('player')) {
    return url;
  }

  return null;
}

export function VideoStep({ content, settings, onNext, isActive }: VideoStepProps) {
  const [showVideo, setShowVideo] = useState(false);
  const embedUrl = getEmbedUrl(content.video_url || '');

  useEffect(() => {
    if (isActive) {
      // Slight delay before loading video for smoother transition
      const timer = setTimeout(() => setShowVideo(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowVideo(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          onNext();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, onNext]);

  // Check if we have dynamic content
  const hasElementOrder = content.element_order && content.element_order.length > 0;

  if (hasElementOrder) {
    return (
      <div className="w-full max-w-3xl text-center px-4">
        <DynamicElementRenderer
          elementOrder={content.element_order || []}
          dynamicElements={content.dynamic_elements || {}}
          content={content}
          settings={settings}
          design={content.design}
          stepType="video"
          onButtonClick={onNext}
        />
      </div>
    );
  }

  // Fallback to original rendering
  return (
    <div className="w-full max-w-3xl text-center px-4">
      {content.headline && (
        <h2 
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 md:mb-6"
          dangerouslySetInnerHTML={{ __html: content.headline }}
        />
      )}

      {embedUrl && showVideo ? (
        <div className="relative w-full aspect-video mb-6 md:mb-8 rounded-lg overflow-hidden bg-black/50">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="w-full aspect-video mb-6 md:mb-8 rounded-lg bg-white/10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <button
        onClick={onNext}
        className="px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
        style={{ backgroundColor: settings.primary_color }}
      >
        {content.button_text || settings.button_text || 'Continue'}
      </button>

      <p className="mt-4 text-white/40 text-xs md:text-sm">
        Press Enter ↵
      </p>
    </div>
  );
}
