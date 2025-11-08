import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errorUtils';

interface FollowUpSetting {
  id?: string;
  team_id: string;
  pipeline_stage: string;
  default_days: number;
  default_time: string;
  suggest_follow_up: boolean;
}

interface FollowUpSettingsProps {
  teamId: string;
}

const STAGE_LABELS: Record<string, string> = {
  no_show: 'No Show',
  canceled: 'Cancelled',
  disqualified: 'Disqualified',
};

export function FollowUpSettings({ teamId }: FollowUpSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<FollowUpSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('team_follow_up_settings')
        .select('*')
        .eq('team_id', teamId)
        .order('pipeline_stage');

      if (error) throw error;

      // Ensure we have settings for all stages
      const stages = ['no_show', 'canceled', 'disqualified'];
      const existingStages = new Set(data?.map(s => s.pipeline_stage) || []);
      
      const allSettings: FollowUpSetting[] = stages.map(stage => {
        const existing = data?.find(s => s.pipeline_stage === stage);
        return existing || {
          team_id: teamId,
          pipeline_stage: stage,
          default_days: stage === 'no_show' ? 1 : stage === 'canceled' ? 2 : 7,
          default_time: '10:00:00',
          suggest_follow_up: true,
        };
      });

      setSettings(allSettings);
    } catch (error) {
      toast({
        title: 'Error loading settings',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (stage: string, field: keyof FollowUpSetting, value: any) => {
    setSettings(prev =>
      prev.map(s =>
        s.pipeline_stage === stage ? { ...s, [field]: value } : s
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from('team_follow_up_settings')
          .upsert({
            id: setting.id,
            team_id: teamId,
            pipeline_stage: setting.pipeline_stage,
            default_days: setting.default_days,
            default_time: setting.default_time,
            suggest_follow_up: setting.suggest_follow_up,
          }, {
            onConflict: 'team_id,pipeline_stage'
          });

        if (error) throw error;
      }

      toast({
        title: 'Settings saved',
        description: 'Follow-up defaults have been updated successfully',
      });

      loadSettings(); // Reload to get IDs
    } catch (error) {
      toast({
        title: 'Error saving settings',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Follow-Up Defaults
        </CardTitle>
        <CardDescription>
          Configure default follow-up timing for each pipeline stage. Users can always override these when moving deals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.map((setting) => (
          <div
            key={setting.pipeline_stage}
            className="p-4 rounded-lg border bg-card space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {STAGE_LABELS[setting.pipeline_stage] || setting.pipeline_stage}
              </h3>
              <div className="flex items-center gap-2">
                <Label htmlFor={`suggest-${setting.pipeline_stage}`} className="text-sm">
                  Auto-suggest follow-up
                </Label>
                <Switch
                  id={`suggest-${setting.pipeline_stage}`}
                  checked={setting.suggest_follow_up}
                  onCheckedChange={(checked) =>
                    updateSetting(setting.pipeline_stage, 'suggest_follow_up', checked)
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`days-${setting.pipeline_stage}`}>
                  Default Days Until Follow-Up
                </Label>
                <Input
                  id={`days-${setting.pipeline_stage}`}
                  type="number"
                  min={1}
                  max={30}
                  value={setting.default_days}
                  onChange={(e) =>
                    updateSetting(setting.pipeline_stage, 'default_days', parseInt(e.target.value) || 1)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`time-${setting.pipeline_stage}`}>
                  Default Time
                </Label>
                <Input
                  id={`time-${setting.pipeline_stage}`}
                  type="time"
                  value={setting.default_time.slice(0, 5)}
                  onChange={(e) =>
                    updateSetting(setting.pipeline_stage, 'default_time', e.target.value + ':00')
                  }
                />
              </div>
            </div>
          </div>
        ))}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Follow-Up Defaults'}
        </Button>
      </CardContent>
    </Card>
  );
}
