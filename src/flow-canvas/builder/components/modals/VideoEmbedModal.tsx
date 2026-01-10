import React, { useState, useEffect } from 'react';
import { Video, Link as LinkIcon, Youtube, Play, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface VideoSettings {
  url: string;
  platform: 'youtube' | 'vimeo' | 'loom' | 'wistia' | 'custom';
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  thumbnail?: string;
}

interface VideoEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VideoSettings | null;
  onSave: (settings: VideoSettings) => void;
}

interface PlatformOption {
  id: VideoSettings['platform'];
  name: string;
  icon: React.ReactNode;
  placeholder: string;
  example: string;
}

const platforms: PlatformOption[] = [
  { 
    id: 'youtube', 
    name: 'YouTube', 
    icon: <Youtube className="w-5 h-5" />,
    placeholder: 'https://www.youtube.com/watch?v=...',
    example: 'Paste any YouTube video URL'
  },
  { 
    id: 'vimeo', 
    name: 'Vimeo', 
    icon: <Play className="w-5 h-5" />,
    placeholder: 'https://vimeo.com/...',
    example: 'Paste any Vimeo video URL'
  },
  { 
    id: 'loom', 
    name: 'Loom', 
    icon: <Video className="w-5 h-5" />,
    placeholder: 'https://www.loom.com/share/...',
    example: 'Paste your Loom share link'
  },
  { 
    id: 'wistia', 
    name: 'Wistia', 
    icon: <Video className="w-5 h-5" />,
    placeholder: 'https://...wistia.com/medias/...',
    example: 'Paste your Wistia embed URL'
  },
  { 
    id: 'custom', 
    name: 'Direct URL', 
    icon: <LinkIcon className="w-5 h-5" />,
    placeholder: 'https://example.com/video.mp4',
    example: 'Direct link to MP4, WebM, or other video file'
  },
];

const detectPlatform = (url: string): VideoSettings['platform'] => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('loom.com')) return 'loom';
  if (url.includes('wistia.com') || url.includes('wistia.net')) return 'wistia';
  return 'custom';
};

const extractVideoId = (url: string, platform: VideoSettings['platform']): string | null => {
  try {
    switch (platform) {
      case 'youtube': {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
        return match?.[1] || null;
      }
      case 'vimeo': {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match?.[1] || null;
      }
      case 'loom': {
        const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
        return match?.[1] || null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
};

const getEmbedUrl = (url: string, platform: VideoSettings['platform'], settings: VideoSettings): string => {
  const videoId = extractVideoId(url, platform);
  
  switch (platform) {
    case 'youtube':
      if (!videoId) return '';
      const ytParams = new URLSearchParams();
      if (settings.autoplay) ytParams.set('autoplay', '1');
      if (settings.muted) ytParams.set('mute', '1');
      if (settings.loop) ytParams.set('loop', '1');
      if (!settings.controls) ytParams.set('controls', '0');
      return `https://www.youtube.com/embed/${videoId}?${ytParams.toString()}`;
    
    case 'vimeo':
      if (!videoId) return '';
      const vimeoParams = new URLSearchParams();
      if (settings.autoplay) vimeoParams.set('autoplay', '1');
      if (settings.muted) vimeoParams.set('muted', '1');
      if (settings.loop) vimeoParams.set('loop', '1');
      return `https://player.vimeo.com/video/${videoId}?${vimeoParams.toString()}`;
    
    case 'loom':
      if (!videoId) return '';
      return `https://www.loom.com/embed/${videoId}`;
    
    case 'wistia':
      return url; // Wistia URLs are used directly
    
    default:
      return url;
  }
};

export const VideoEmbedModal: React.FC<VideoEmbedModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [url, setUrl] = useState(settings?.url || '');
  const [platform, setPlatform] = useState<VideoSettings['platform']>(settings?.platform || 'youtube');
  const [autoplay, setAutoplay] = useState(settings?.autoplay || false);
  const [muted, setMuted] = useState(settings?.muted || false);
  const [loop, setLoop] = useState(settings?.loop || false);
  const [controls, setControls] = useState(settings?.controls ?? true);
  const [thumbnail, setThumbnail] = useState(settings?.thumbnail || '');

  useEffect(() => {
    if (url) {
      const detected = detectPlatform(url);
      setPlatform(detected);
    }
  }, [url]);

  const selectedPlatform = platforms.find(p => p.id === platform);
  const embedUrl = url ? getEmbedUrl(url, platform, { url, platform, autoplay, muted, loop, controls }) : '';

  const handleSave = () => {
    onSave({
      url,
      platform,
      autoplay,
      muted,
      loop,
      controls,
      thumbnail,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Video className="w-5 h-5 text-builder-accent" />
            Embed Video
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="w-full bg-builder-bg">
            <TabsTrigger value="url" className="flex-1">Video URL</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 py-4">
            {/* Platform Selector */}
            <div className="flex gap-2 flex-wrap">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border flex items-center gap-2 text-sm transition-all',
                    platform === p.id
                      ? 'border-builder-accent bg-builder-accent/10 text-builder-accent'
                      : 'border-builder-border text-builder-text-muted hover:border-builder-text-muted'
                  )}
                >
                  {p.icon}
                  {p.name}
                </button>
              ))}
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <Label className="text-sm text-builder-text-muted">Video URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-builder-text-muted" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={selectedPlatform?.placeholder}
                  className="builder-input pl-10"
                />
              </div>
              <p className="text-xs text-builder-text-dim">{selectedPlatform?.example}</p>
            </div>

            {/* Preview */}
            {embedUrl && platform !== 'custom' && (
              <div className="aspect-video bg-builder-bg rounded-lg overflow-hidden border border-builder-border">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 py-4">
            <div className="flex items-center gap-2 px-1 py-2 border-b border-builder-border">
              <Settings2 className="w-4 h-4 text-builder-text-muted" />
              <span className="text-sm font-medium text-builder-text">Playback Options</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm text-builder-text">Autoplay</Label>
                  <p className="text-xs text-builder-text-muted">Start playing automatically</p>
                </div>
                <Switch checked={autoplay} onCheckedChange={setAutoplay} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm text-builder-text">Muted</Label>
                  <p className="text-xs text-builder-text-muted">Start without sound</p>
                </div>
                <Switch checked={muted} onCheckedChange={setMuted} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm text-builder-text">Loop</Label>
                  <p className="text-xs text-builder-text-muted">Repeat when finished</p>
                </div>
                <Switch checked={loop} onCheckedChange={setLoop} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm text-builder-text">Show Controls</Label>
                  <p className="text-xs text-builder-text-muted">Display player controls</p>
                </div>
                <Switch checked={controls} onCheckedChange={setControls} />
              </div>
            </div>

            {/* Custom Thumbnail */}
            <div className="space-y-2 pt-2">
              <Label className="text-sm text-builder-text-muted">Custom Thumbnail URL (optional)</Label>
              <Input
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://example.com/thumbnail.jpg"
                className="builder-input"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-builder-text-muted hover:text-builder-text"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!url}
            className="bg-builder-accent text-white hover:brightness-110 disabled:opacity-50"
          >
            Save Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { getEmbedUrl, detectPlatform, extractVideoId };
