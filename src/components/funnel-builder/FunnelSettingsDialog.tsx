// @ts-nocheck - Legacy funnel builder types need refactoring
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Trash2, Zap, Link2, TestTube, CheckCircle, AlertCircle, 
  Image, Palette, BarChart3, Share2, Globe, Archive, Settings2,
  Check, Upload, ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { Funnel, FunnelSettings } from '@/lib/funnel/editorTypes';
import { ImagePicker } from './ImagePicker';
import { cn } from '@/lib/utils';

interface FunnelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnel: Funnel;
  onSave: () => void;
}

type SettingsSection = 'overview' | 'social' | 'favicon' | 'logo' | 'colors' | 'progress' | 'tracking' | 'integrations' | 'archive';

const sidebarItems: { id: SettingsSection; label: string; icon: React.ReactNode; danger?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'social', label: 'Social Preview', icon: <Share2 className="w-4 h-4" /> },
  { id: 'favicon', label: 'Favicon', icon: <Globe className="w-4 h-4" /> },
  { id: 'logo', label: 'Logo', icon: <Image className="w-4 h-4" /> },
  { id: 'colors', label: 'Colors & Style', icon: <Palette className="w-4 h-4" /> },
  { id: 'progress', label: 'Progress bar', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'tracking', label: 'Tracking', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Link2 className="w-4 h-4" /> },
  { id: 'archive', label: 'Archive funnel', icon: <Archive className="w-4 h-4" />, danger: true },
];

export function FunnelSettingsDialog({ open, onOpenChange, funnel, onSave }: FunnelSettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview');
  const [settings, setSettings] = useState<FunnelSettings>(funnel.settings);
  const [slug, setSlug] = useState(funnel.slug);
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState(funnel.zapier_webhook_url || '');
  const [customWebhooks, setCustomWebhooks] = useState<string[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [webhookResults, setWebhookResults] = useState<Record<string, 'success' | 'error'>>({});
  const [showProgressBar, setShowProgressBar] = useState(settings.show_progress_bar !== false);
  
  // ImagePicker states
  const [showOgImagePicker, setShowOgImagePicker] = useState(false);
  const [showFaviconPicker, setShowFaviconPicker] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);

  useEffect(() => {
    setSettings(funnel.settings);
    setSlug(funnel.slug);
    setZapierWebhookUrl(funnel.zapier_webhook_url || '');
    const urls = Array.isArray(funnel.webhook_urls) ? funnel.webhook_urls : [];
    setCustomWebhooks(urls.filter(u => typeof u === 'string'));
    setWebhookResults({});
    setShowProgressBar(funnel.settings.show_progress_bar !== false);
  }, [funnel]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updatedSettings = { ...settings, show_progress_bar: showProgressBar };
      const { error } = await supabase
        .from('funnels')
        .update({ 
          settings: JSON.parse(JSON.stringify(updatedSettings)), 
          slug,
          zapier_webhook_url: zapierWebhookUrl || null,
          webhook_urls: customWebhooks.length > 0 ? customWebhooks : null,
        })
        .eq('id', funnel.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      onSave();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key')) {
        toast({ title: 'URL slug already exists', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
      }
    },
  });

  const updateSetting = (key: keyof FunnelSettings, value: string | boolean | null) => {
    setSettings({ ...settings, [key]: value });
  };

  const addCustomWebhook = () => {
    if (!newWebhookUrl) return;
    try {
      new URL(newWebhookUrl);
      setCustomWebhooks([...customWebhooks, newWebhookUrl]);
      setNewWebhookUrl('');
    } catch {
      toast({ title: 'Invalid URL', variant: 'destructive' });
    }
  };

  const removeCustomWebhook = (index: number) => {
    setCustomWebhooks(customWebhooks.filter((_, i) => i !== index));
  };

  const testWebhook = async (url: string, type: string) => {
    if (!url) return;
    setTestingWebhook(type);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          test: true,
          funnel_id: funnel.id,
          funnel_name: funnel.name,
          timestamp: new Date().toISOString(),
          message: 'Test webhook from funnel settings',
        }),
      });
      setWebhookResults({ ...webhookResults, [type]: 'success' });
      toast({ title: 'Test sent', description: 'Check your webhook endpoint for the test payload' });
    } catch {
      setWebhookResults({ ...webhookResults, [type]: 'error' });
      toast({ title: 'Test failed', description: 'Could not reach the webhook URL', variant: 'destructive' });
    } finally {
      setTestingWebhook(null);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Overview</h3>
              <p className="text-sm text-muted-foreground">General funnel settings</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/f/</span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your funnel URL will be: {window.location.origin}/f/{slug}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Button Text</Label>
                <Input
                  value={settings.button_text}
                  onChange={(e) => updateSetting('button_text', e.target.value)}
                  placeholder="Continue"
                />
              </div>
            </div>
          </div>
        );

      case 'social':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Social Preview</h3>
              <p className="text-sm text-muted-foreground">
                Control how your funnel looks when shared on social media
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Share Image</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Recommended size: 1200 x 630 pixels (1.91:1 ratio)
                </p>
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setShowOgImagePicker(true)}
                >
                  {settings.seo_image ? (
                    <div className="space-y-3">
                      <img 
                        src={settings.seo_image} 
                        alt="Social preview" 
                        className="w-full max-h-48 object-cover rounded-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate flex-1">{settings.seo_image}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); updateSetting('seo_image', null); }}
                          className="text-destructive ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click to upload image</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, WebP up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Title</Label>
                  <span className="text-xs text-muted-foreground">
                    {(settings.seo_title || '').length}/60
                  </span>
                </div>
                <Input
                  value={settings.seo_title || ''}
                  onChange={(e) => updateSetting('seo_title', e.target.value || null)}
                  placeholder="Your Funnel Title"
                  maxLength={60}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <span className="text-xs text-muted-foreground">
                    {(settings.seo_description || '').length}/255
                  </span>
                </div>
                <Textarea
                  value={settings.seo_description || ''}
                  onChange={(e) => updateSetting('seo_description', e.target.value || null)}
                  placeholder="A compelling description of your funnel..."
                  maxLength={255}
                  rows={3}
                />
              </div>

              {/* Preview */}
              <div className="pt-4 border-t">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div className="mt-2 border rounded-lg overflow-hidden bg-card">
                  {settings.seo_image && (
                    <img 
                      src={settings.seo_image} 
                      alt="Preview" 
                      className="w-full h-32 object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">yourdomain.com</p>
                    <p className="font-medium text-sm line-clamp-1">
                      {settings.seo_title || 'Your Funnel Title'}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {settings.seo_description || 'Your funnel description will appear here...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ImagePicker
              open={showOgImagePicker}
              onOpenChange={setShowOgImagePicker}
              onSelect={(url) => updateSetting('seo_image', url)}
              aspectRatio="L"
            />
          </div>
        );

      case 'favicon':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Favicon</h3>
              <p className="text-sm text-muted-foreground">
                The small icon shown in browser tabs
              </p>
            </div>

            <div className="space-y-4">
              <div 
                className="flex items-start gap-4 p-4 border-2 border-dashed border-border rounded-lg bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setShowFaviconPicker(true)}
              >
                <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-background">
                  {settings.favicon_url ? (
                    <img 
                      src={settings.favicon_url} 
                      alt="Favicon" 
                      className="w-8 h-8 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <Globe className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {settings.favicon_url ? 'Change favicon' : 'Upload favicon'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recommended: 32x32 or 64x64 PNG/ICO
                  </p>
                  {settings.favicon_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); updateSetting('favicon_url', null); }}
                      className="text-destructive mt-2 -ml-2"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <ImagePicker
              open={showFaviconPicker}
              onOpenChange={setShowFaviconPicker}
              onSelect={(url) => updateSetting('favicon_url', url)}
              aspectRatio="XL"
            />
          </div>
        );

      case 'logo':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Logo</h3>
              <p className="text-sm text-muted-foreground">
                Your brand logo displayed in the funnel
              </p>
            </div>

            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setShowLogoPicker(true)}
              >
                {settings.logo_url ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img 
                        src={settings.logo_url} 
                        alt="Logo" 
                        className="max-h-24 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); updateSetting('logo_url', null); }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Remove logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Image className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, WebP up to 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <ImagePicker
              open={showLogoPicker}
              onOpenChange={setShowLogoPicker}
              onSelect={(url) => updateSetting('logo_url', url)}
              aspectRatio="M"
            />
          </div>
        );

      case 'colors':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Colors & Style</h3>
              <p className="text-sm text-muted-foreground">
                Customize the look of your funnel
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for buttons, links, and accents
                </p>
              </div>

              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.background_color}
                    onChange={(e) => updateSetting('background_color', e.target.value)}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={settings.background_color}
                    onChange={(e) => updateSetting('background_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Privacy Policy URL</Label>
                <Input
                  value={settings.privacy_policy_url || ''}
                  onChange={(e) => updateSetting('privacy_policy_url', e.target.value || null)}
                  placeholder="https://yourdomain.com/privacy"
                />
              </div>
            </div>
          </div>
        );

      case 'progress':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Progress bar</h3>
              <p className="text-sm text-muted-foreground">
                Show visitors how far they are in the funnel
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Show Progress Bar Card */}
              <button
                onClick={() => setShowProgressBar(true)}
                className={cn(
                  "relative border-2 rounded-xl p-4 text-left transition-all",
                  showProgressBar 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                {showProgressBar && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                {/* Visual mockup */}
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <div className="w-full h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-primary rounded-full" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
                    <div className="h-2 bg-muted-foreground/20 rounded w-1/2" />
                  </div>
                </div>
                <p className="font-medium text-sm">Show progress bar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display a progress indicator at the top
                </p>
              </button>

              {/* No Progress Bar Card */}
              <button
                onClick={() => setShowProgressBar(false)}
                className={cn(
                  "relative border-2 rounded-xl p-4 text-left transition-all",
                  !showProgressBar 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                {!showProgressBar && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                {/* Visual mockup */}
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <div className="mt-3 space-y-2">
                    <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
                    <div className="h-2 bg-muted-foreground/20 rounded w-1/2" />
                    <div className="h-2 bg-muted-foreground/20 rounded w-2/3" />
                  </div>
                </div>
                <p className="font-medium text-sm">No progress bar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hide the progress indicator
                </p>
              </button>
            </div>
          </div>
        );

      case 'tracking':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Connect your analytics and tracking pixels
              </p>
            </div>

            <div className="space-y-5">
              {/* Meta Pixel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-blue-600/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <Label>Meta Pixel (Facebook)</Label>
                </div>
                <Input
                  value={settings.meta_pixel_id || ''}
                  onChange={(e) => updateSetting('meta_pixel_id', e.target.value || null)}
                  placeholder="123456789012345"
                />
              </div>

              {/* Google Analytics */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-yellow-500/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-yellow-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.84 2.998v17.958a3.035 3.035 0 01-3.035 3.035h-.068a3.035 3.035 0 01-3.035-3.035V2.998a3.035 3.035 0 013.035-3.035h.068a3.035 3.035 0 013.035 3.035zM14.67 10.142v10.814a3.035 3.035 0 01-3.035 3.035h-.068a3.035 3.035 0 01-3.035-3.035V10.142a3.035 3.035 0 013.035-3.035h.068a3.035 3.035 0 013.035 3.035zM3.101 20.957a3.035 3.035 0 100-6.07 3.035 3.035 0 000 6.07z"/>
                    </svg>
                  </div>
                  <Label>Google Analytics 4</Label>
                </div>
                <Input
                  value={settings.google_analytics_id || ''}
                  onChange={(e) => updateSetting('google_analytics_id', e.target.value || null)}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>

              {/* Google Ads */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.2 8.5l4.5 7.6c.6 1 1.4 1.6 2.4 1.9l-3.3 5.6c-1.2-.1-2.4-.7-3.2-1.8L.3 16.1c-1-1.7-.4-3.8 1.3-4.8l1.6-2.8zm7.6 13.1l3.3-5.6c.7-.3 1.4-.9 1.8-1.6l4.3-7.4-4.8-2.8L11.1 12c-.4.7-.6 1.5-.5 2.3l-.6 1c-.1.2-.2.4-.3.5l-4.3 7.6 5.4-1.8zm5.4-9.3l4.3-7.4c1-1.7 3.2-2.3 4.9-1.3.8.5 1.4 1.2 1.6 2.1.2.9.1 1.8-.4 2.6l-4.3 7.4-6.1-3.4z"/>
                    </svg>
                  </div>
                  <Label>Google Ads Conversion</Label>
                </div>
                <Input
                  value={settings.google_ads_id || ''}
                  onChange={(e) => updateSetting('google_ads_id', e.target.value || null)}
                  placeholder="AW-XXXXXXXXX"
                />
              </div>

              {/* TikTok Pixel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-pink-500/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-pink-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                    </svg>
                  </div>
                  <Label>TikTok Pixel</Label>
                </div>
                <Input
                  value={settings.tiktok_pixel_id || ''}
                  onChange={(e) => updateSetting('tiktok_pixel_id', e.target.value || null)}
                  placeholder="XXXXXXXXXXXXXXXXX"
                />
              </div>

              <p className="text-xs text-muted-foreground pt-2 border-t">
                Pixels fire automatically on page load, lead capture, and funnel completion.
              </p>
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Integrations</h3>
              <p className="text-sm text-muted-foreground">
                Connect to your favorite tools
              </p>
            </div>

            <div className="space-y-5">
              {/* GHL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <Label>GoHighLevel (GHL)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={settings.ghl_webhook_url || ''}
                    onChange={(e) => updateSetting('ghl_webhook_url', e.target.value || null)}
                    placeholder="https://services.leadconnectorhq.com/hooks/..."
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testWebhook(settings.ghl_webhook_url || '', 'ghl')}
                    disabled={!settings.ghl_webhook_url || testingWebhook === 'ghl'}
                  >
                    {testingWebhook === 'ghl' ? '...' : webhookResults['ghl'] === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : webhookResults['ghl'] === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Zapier */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-orange-500" />
                  </div>
                  <Label>Zapier</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={zapierWebhookUrl}
                    onChange={(e) => setZapierWebhookUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testWebhook(zapierWebhookUrl, 'zapier')}
                    disabled={!zapierWebhookUrl || testingWebhook === 'zapier'}
                  >
                    {testingWebhook === 'zapier' ? '...' : webhookResults['zapier'] === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : webhookResults['zapier'] === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Custom Webhooks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                      <Link2 className="h-4 w-4 text-blue-500" />
                    </div>
                    <Label>Custom Webhooks</Label>
                  </div>
                  {customWebhooks.length > 0 && (
                    <Badge variant="secondary">{customWebhooks.length}</Badge>
                  )}
                </div>

                {customWebhooks.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={url}
                      onChange={(e) => {
                        const updated = [...customWebhooks];
                        updated[index] = e.target.value;
                        setCustomWebhooks(updated);
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook(url, `custom-${index}`)}
                      disabled={testingWebhook === `custom-${index}`}
                    >
                      {testingWebhook === `custom-${index}` ? '...' : webhookResults[`custom-${index}`] === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : webhookResults[`custom-${index}`] === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCustomWebhook(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Input
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://your-webhook-endpoint.com/..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomWebhook()}
                  />
                  <Button size="sm" variant="outline" onClick={addCustomWebhook} disabled={!newWebhookUrl}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'archive':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1 text-destructive">Archive Funnel</h3>
              <p className="text-sm text-muted-foreground">
                Archiving will hide this funnel from your list
              </p>
            </div>

            <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
              <p className="text-sm text-muted-foreground mb-4">
                This action will archive the funnel. Archived funnels will no longer be accessible to visitors and won't appear in your funnel list.
              </p>
              <Button variant="destructive" size="sm">
                <Archive className="w-4 h-4 mr-2" />
                Archive this funnel
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Funnel settings</DialogTitle>
          <DialogDescription>Manage global settings for this funnel.</DialogDescription>
        </DialogHeader>
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-56 border-r bg-muted/30 p-4 flex flex-col">
            <h2 className="font-semibold text-lg px-2 mb-4">Settings</h2>
            <nav className="space-y-1 flex-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    activeSection === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : item.danger
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              {renderContent()}
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex justify-end gap-2 bg-background">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
