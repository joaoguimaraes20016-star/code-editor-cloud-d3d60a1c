import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import type { StepComponentProps } from './types';
import { FONT_SIZE_MAP, DEFAULT_DESIGN } from './types';

function getVideoEmbedUrl(url?: string): string | null {
  if (!url) return null;
  
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  
  if (url.includes('/embed/') || url.includes('player.vimeo.com')) return url;
  
  return null;
}

export function VideoStep({
  content,
  design,
  isSelected,
  onSelect,
}: StepComponentProps) {
  const d = { ...DEFAULT_DESIGN, ...design, ...content.design };
  const fontSize = d.fontSize || 'medium';
  const sizes = FONT_SIZE_MAP[fontSize];
  const embedUrl = getVideoEmbedUrl(content.video_url);

  const backgroundStyle = d.useGradient && d.gradientFrom && d.gradientTo
    ? { background: `linear-gradient(${d.gradientDirection || 'to bottom'}, ${d.gradientFrom}, ${d.gradientTo})` }
    : { backgroundColor: d.backgroundColor };

  return (
    <div
      className={cn(
        "step-card step-card--video",
        isSelected && "step-card--selected"
      )}
      data-step-type="Video"
      style={{
        ...backgroundStyle,
        color: d.textColor,
      }}
      onClick={onSelect}
    >
      <div className="step-content">
        {content.headline && (
          <h2 className={cn("step-headline", sizes.headline)}>
            {content.headline}
          </h2>
        )}
        <div
          className="step-video-container"
          style={{ borderRadius: `${d.borderRadius}px` }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="step-video-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="step-video-placeholder">
              <Play size={48} strokeWidth={1.5} />
              <span>Add video URL</span>
            </div>
          )}
        </div>
        {content.button_text && (
          <button
            className={cn("step-button", sizes.button)}
            style={{
              backgroundColor: d.buttonColor,
              color: d.buttonTextColor,
              borderRadius: `${d.borderRadius}px`,
            }}
          >
            {content.button_text}
          </button>
        )}
      </div>
    </div>
  );
}
