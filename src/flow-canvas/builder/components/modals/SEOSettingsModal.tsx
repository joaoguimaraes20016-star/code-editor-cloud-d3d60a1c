import React from 'react';
import { Globe, Search, Share2, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SEOSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: {
    title?: string;
    description?: string;
    og_image?: string;
  };
  onUpdateMeta: (key: string, value: string) => void;
}

export const SEOSettingsModal: React.FC<SEOSettingsModalProps> = ({
  isOpen,
  onClose,
  meta,
  onUpdateMeta,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Globe className="w-5 h-5 text-builder-accent" />
            SEO Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Page Title */}
          <div className="space-y-2">
            <Label className="text-builder-text flex items-center gap-2">
              <Search className="w-4 h-4 text-builder-text-muted" />
              Page Title
            </Label>
            <Input
              value={meta.title || ''}
              onChange={(e) => onUpdateMeta('title', e.target.value)}
              placeholder="My Awesome Page"
              className="builder-input"
            />
            <p className="text-xs text-builder-text-dim">
              Recommended: 50-60 characters. Currently: {(meta.title || '').length}
            </p>
          </div>

          {/* Meta Description */}
          <div className="space-y-2">
            <Label className="text-builder-text flex items-center gap-2">
              <Share2 className="w-4 h-4 text-builder-text-muted" />
              Meta Description
            </Label>
            <Textarea
              value={meta.description || ''}
              onChange={(e) => onUpdateMeta('description', e.target.value)}
              placeholder="A brief description of your page for search engines..."
              className="builder-input resize-none"
              rows={3}
            />
            <p className="text-xs text-builder-text-dim">
              Recommended: 150-160 characters. Currently: {(meta.description || '').length}
            </p>
          </div>

          {/* Social Image */}
          <div className="space-y-2">
            <Label className="text-builder-text flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-builder-text-muted" />
              Social Share Image
            </Label>
            <Input
              value={meta.og_image || ''}
              onChange={(e) => onUpdateMeta('og_image', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="builder-input"
            />
            <p className="text-xs text-builder-text-dim">
              Recommended size: 1200 × 630 pixels
            </p>
            {meta.og_image && (
              <div className="mt-2 aspect-video bg-builder-bg border border-builder-border rounded-lg overflow-hidden">
                <img 
                  src={meta.og_image} 
                  alt="Social preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-builder-text">Search Preview</Label>
            <div className="p-4 bg-[#fff] rounded-lg border border-[hsl(220,13%,85%)]">
              <div className="text-[#1a0dab] text-lg hover:underline cursor-pointer">
                {meta.title || 'Page Title'}
              </div>
              <div className="text-[#006621] text-sm">
                yoursite.app/your-page
              </div>
              <div className="text-[#545454] text-sm mt-1">
                {meta.description || 'Add a meta description to improve your search ranking...'}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
