import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FunnelStep } from '@/lib/funnel/editorTypes';

interface StepSettings {
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  skipEnabled?: boolean;
  progressBar?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  animationDuration?: number;
  animationEasing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

interface SettingsEditorProps {
  step: FunnelStep;
  settings: StepSettings;
  onUpdateSettings: (settings: StepSettings) => void;
}

export function SettingsEditor({ step, settings, onUpdateSettings }: SettingsEditorProps) {
  const updateField = (field: keyof StepSettings, value: any) => {
    onUpdateSettings({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">
          Settings
        </h3>
        <p className="text-xs text-muted-foreground">
          Configure page behavior
        </p>
      </div>

      {/* Auto Advance */}
      <div className="flex items-center justify-between p-3 -mx-3 rounded-lg bg-secondary/30">
        <div>
          <Label className="text-sm">Auto Advance</Label>
          <p className="text-xs text-muted-foreground">Automatically go to next page</p>
        </div>
        <Switch
          checked={settings.autoAdvance ?? false}
          onCheckedChange={(checked) => updateField('autoAdvance', checked)}
        />
      </div>

      {settings.autoAdvance && (
        <div className="space-y-2">
          <Label className="text-xs">Delay (seconds)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={settings.autoAdvanceDelay ?? 3}
            onChange={(e) => updateField('autoAdvanceDelay', parseInt(e.target.value))}
          />
        </div>
      )}

      {/* Skip Button */}
      <div className="flex items-center justify-between p-3 -mx-3 rounded-lg bg-secondary/30">
        <div>
          <Label className="text-sm">Allow Skip</Label>
          <p className="text-xs text-muted-foreground">Show a skip button on this page</p>
        </div>
        <Switch
          checked={settings.skipEnabled ?? false}
          onCheckedChange={(checked) => updateField('skipEnabled', checked)}
        />
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between p-3 -mx-3 rounded-lg bg-secondary/30">
        <div>
          <Label className="text-sm">Show Progress</Label>
          <p className="text-xs text-muted-foreground">Display progress bar</p>
        </div>
        <Switch
          checked={settings.progressBar ?? true}
          onCheckedChange={(checked) => updateField('progressBar', checked)}
        />
      </div>

      {/* Animation Type */}
      <div className="space-y-2">
        <Label className="text-xs">Page Transition</Label>
        <Select
          value={settings.animation ?? 'fade'}
          onValueChange={(value) => updateField('animation', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fade">Fade</SelectItem>
            <SelectItem value="slide">Slide Up</SelectItem>
            <SelectItem value="scale">Scale</SelectItem>
            <SelectItem value="none">None (Instant)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Animation Duration */}
      {settings.animation !== 'none' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Duration</Label>
            <span className="text-xs text-muted-foreground">{settings.animationDuration ?? 300}ms</span>
          </div>
          <Slider
            value={[settings.animationDuration ?? 300]}
            onValueChange={([value]) => updateField('animationDuration', value)}
            min={100}
            max={800}
            step={50}
          />
        </div>
      )}

      {/* Animation Easing */}
      {settings.animation !== 'none' && (
        <div className="space-y-2">
          <Label className="text-xs">Easing</Label>
          <Select
            value={settings.animationEasing ?? 'ease-out'}
            onValueChange={(value) => updateField('animationEasing', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ease">Ease</SelectItem>
              <SelectItem value="ease-in">Ease In</SelectItem>
              <SelectItem value="ease-out">Ease Out</SelectItem>
              <SelectItem value="ease-in-out">Ease In Out</SelectItem>
              <SelectItem value="linear">Linear</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Step Type Info */}
      <div className="pt-4 border-t">
        <Label className="text-xs text-muted-foreground">Step Type</Label>
        <p className="text-sm font-medium capitalize mt-1">{step.step_type.replace('_', ' ')}</p>
      </div>
    </div>
  );
}
