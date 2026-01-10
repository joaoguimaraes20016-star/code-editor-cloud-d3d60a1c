import React, { useState } from 'react';
import { Share2, Copy, Check, Twitter, Facebook, Linkedin, Mail, Code, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageSlug: string;
  pageTitle: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  pageSlug,
  pageTitle,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const shareUrl = `https://yoursite.app/${pageSlug}`;
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    toast.success('Embed code copied!');
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleOpenPreview = () => {
    window.open(shareUrl, '_blank');
  };

  const shareLinks = [
    {
      name: 'Twitter',
      icon: <Twitter className="w-5 h-5" />,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(pageTitle)}`,
      color: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]',
    },
    {
      name: 'Facebook',
      icon: <Facebook className="w-5 h-5" />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: 'bg-[#4267B2] hover:bg-[#365899]',
    },
    {
      name: 'LinkedIn',
      icon: <Linkedin className="w-5 h-5" />,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: 'bg-[#0077B5] hover:bg-[#006097]',
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      url: `mailto:?subject=${encodeURIComponent(pageTitle)}&body=${encodeURIComponent(`Check this out: ${shareUrl}`)}`,
      color: 'bg-gray-600 hover:bg-gray-700',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Share2 className="w-5 h-5 text-builder-accent" />
            Share "{pageTitle}"
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="w-full bg-builder-bg border border-builder-border">
            <TabsTrigger value="link" className="flex-1 data-[state=active]:bg-builder-accent data-[state=active]:text-white">
              Link
            </TabsTrigger>
            <TabsTrigger value="social" className="flex-1 data-[state=active]:bg-builder-accent data-[state=active]:text-white">
              Social
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 data-[state=active]:bg-builder-accent data-[state=active]:text-white">
              Embed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            {/* Copy Link */}
            <div className="flex items-center gap-2 p-3 bg-builder-bg border border-builder-border rounded-lg">
              <Input
                value={shareUrl}
                readOnly
                className="builder-input flex-1 text-sm"
              />
              <Button
                onClick={handleCopyLink}
                size="sm"
                className="bg-builder-accent text-white hover:brightness-110 shrink-0"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            
            {/* Preview Button */}
            <Button
              onClick={handleOpenPreview}
              variant="outline"
              className="w-full border-builder-border text-builder-text hover:bg-builder-surface-hover"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Preview in New Tab
            </Button>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            {/* Social Share Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg text-white transition-all ${link.color}`}
                >
                  {link.icon}
                  <span className="text-sm font-medium">{link.name}</span>
                </a>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 mt-4">
            {/* Embed Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-builder-text flex items-center gap-2">
                <Code className="w-4 h-4 text-builder-accent" />
                Embed Code
              </label>
              <div className="relative">
                <textarea
                  value={embedCode}
                  readOnly
                  className="w-full h-24 p-3 bg-builder-bg border border-builder-border rounded-lg text-xs font-mono text-builder-text-secondary resize-none"
                />
                <Button
                  onClick={handleCopyEmbed}
                  size="sm"
                  className="absolute top-2 right-2 bg-builder-accent text-white hover:brightness-110"
                >
                  {copiedEmbed ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <p className="text-xs text-builder-text-dim">
                Paste this code into your website's HTML to embed this page.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
