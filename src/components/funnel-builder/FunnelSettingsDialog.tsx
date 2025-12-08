import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Funnel, FunnelSettings } from '@/pages/FunnelEditor';

interface FunnelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnel: Funnel;
  onSave: () => void;
}

export function FunnelSettingsDialog({ open, onOpenChange, funnel, onSave }: FunnelSettingsDialogProps) {
  const [settings, setSettings] = useState<FunnelSettings>(funnel.settings);
  const [slug, setSlug] = useState(funnel.slug);

  useEffect(() => {
    setSettings(funnel.settings);
    setSlug(funnel.slug);
  }, [funnel]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('funnels')
        .update({ settings: settings as unknown as Record<string, unknown>, slug })
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

  const updateSetting = (key: keyof FunnelSettings, value: string | null) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Funnel Settings</DialogTitle>
          <DialogDescription>
            Configure your funnel appearance and integrations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">/f/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={settings.logo_url || ''}
              onChange={(e) => updateSetting('logo_url', e.target.value || null)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => updateSetting('primary_color', e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => updateSetting('primary_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.background_color}
                  onChange={(e) => updateSetting('background_color', e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={settings.background_color}
                  onChange={(e) => updateSetting('background_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Button Text</Label>
            <Input
              value={settings.button_text}
              onChange={(e) => updateSetting('button_text', e.target.value)}
              placeholder="Continue"
            />
          </div>

          <div className="space-y-2">
            <Label>GHL Webhook URL</Label>
            <Input
              value={settings.ghl_webhook_url || ''}
              onChange={(e) => updateSetting('ghl_webhook_url', e.target.value || null)}
              placeholder="https://services.leadconnectorhq.com/hooks/..."
            />
            <p className="text-xs text-muted-foreground">
              Leads will be automatically sent to this webhook
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
