import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FunnelStep } from '@/pages/FunnelEditor';
import { PartyPopper, Link, Code, SkipForward, Timer, Eye } from 'lucide-react';

interface PageSettings {
  customSlug?: string;
  trackingPixels?: string;
  autoRedirect?: {
    enabled: boolean;
    url: string;
    delay: number;
  };
  confetti?: boolean;
  skipLogic?: {
    enabled: boolean;
    condition: string;
    skipToStep: string;
  };
  seoTitle?: string;
  seoDescription?: string;
  hideProgressBar?: boolean;
}

interface PageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: FunnelStep;
  allSteps: FunnelStep[];
  settings: PageSettings;
  onSave: (settings: PageSettings) => void;
}

export function PageSettingsDialog({
  open,
  onOpenChange,
  step,
  allSteps,
  settings,
  onSave,
}: PageSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<PageSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>
            Configure settings for "{step.content.headline || 'this page'}"
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Custom URL Slug */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Custom Page URL
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/f/funnel-slug/</span>
                <Input
                  value={localSettings.customSlug || ''}
                  onChange={(e) => updateSetting('customSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="page-name"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to use default page number
              </p>
            </div>

            {/* SEO Title */}
            <div className="space-y-2">
              <Label>SEO Title</Label>
              <Input
                value={localSettings.seoTitle || ''}
                onChange={(e) => updateSetting('seoTitle', e.target.value)}
                placeholder="Page title for search engines"
              />
            </div>

            {/* SEO Description */}
            <div className="space-y-2">
              <Label>SEO Description</Label>
              <Textarea
                value={localSettings.seoDescription || ''}
                onChange={(e) => updateSetting('seoDescription', e.target.value)}
                placeholder="Brief description for search engines"
                rows={2}
              />
            </div>

            {/* Hide Progress Bar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Hide Progress Bar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hide the progress indicator on this page
                </p>
              </div>
              <Switch
                checked={localSettings.hideProgressBar || false}
                onCheckedChange={(checked) => updateSetting('hideProgressBar', checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-4 mt-4">
            {/* Confetti */}
            {step.step_type === 'thank_you' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4" />
                    Confetti Celebration
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show confetti animation when this page loads
                  </p>
                </div>
                <Switch
                  checked={localSettings.confetti || false}
                  onCheckedChange={(checked) => updateSetting('confetti', checked)}
                />
              </div>
            )}

            {/* Auto Redirect */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Auto Redirect
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically redirect after a delay
                  </p>
                </div>
                <Switch
                  checked={localSettings.autoRedirect?.enabled || false}
                  onCheckedChange={(checked) => updateSetting('autoRedirect', {
                    ...localSettings.autoRedirect,
                    enabled: checked,
                    url: localSettings.autoRedirect?.url || '',
                    delay: localSettings.autoRedirect?.delay || 5,
                  })}
                />
              </div>

              {localSettings.autoRedirect?.enabled && (
                <div className="pl-6 space-y-3 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label className="text-xs">Redirect URL</Label>
                    <Input
                      value={localSettings.autoRedirect?.url || ''}
                      onChange={(e) => updateSetting('autoRedirect', {
                        ...localSettings.autoRedirect!,
                        url: e.target.value,
                      })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={localSettings.autoRedirect?.delay || 5}
                      onChange={(e) => updateSetting('autoRedirect', {
                        ...localSettings.autoRedirect!,
                        delay: parseInt(e.target.value) || 5,
                      })}
                      min={1}
                      max={60}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Skip Logic */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4" />
                    Skip Logic
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Conditionally skip this page
                  </p>
                </div>
                <Switch
                  checked={localSettings.skipLogic?.enabled || false}
                  onCheckedChange={(checked) => updateSetting('skipLogic', {
                    ...localSettings.skipLogic,
                    enabled: checked,
                    condition: localSettings.skipLogic?.condition || '',
                    skipToStep: localSettings.skipLogic?.skipToStep || '',
                  })}
                />
              </div>

              {localSettings.skipLogic?.enabled && (
                <div className="pl-6 space-y-3 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label className="text-xs">Skip to Page</Label>
                    <Select
                      value={localSettings.skipLogic?.skipToStep || ''}
                      onValueChange={(value) => updateSetting('skipLogic', {
                        ...localSettings.skipLogic!,
                        skipToStep: value,
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select page" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSteps
                          .filter(s => s.id !== step.id)
                          .map((s, i) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.content.headline || `Page ${i + 1}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4 mt-4">
            {/* Tracking Pixels */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Tracking Code
              </Label>
              <Textarea
                value={localSettings.trackingPixels || ''}
                onChange={(e) => updateSetting('trackingPixels', e.target.value)}
                placeholder="<!-- Paste your tracking code here -->"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Add Facebook Pixel, Google Analytics, or other tracking scripts
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}