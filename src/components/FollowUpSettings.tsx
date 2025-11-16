import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errorUtils';
import { Plus, X, Clock } from 'lucide-react';

interface FollowUpSettingsProps {
  teamId: string;
}

interface FollowUpAttempt {
  sequence: number;
  enabled: boolean;
  timeValue: number;
  timeUnit: 'hours' | 'days';
  role: string;
  requireNoStatusChange: boolean;
}

const DEFAULT_STAGES = [
  { value: 'no_show', label: 'No Show Follow-Ups', icon: '🚫' },
  { value: 'canceled', label: 'Canceled Follow-Ups', icon: '❌' },
  { value: 'rescheduled', label: 'Rescheduled Follow-Ups', icon: '📅' },
  { value: 'disqualified', label: 'Disqualified Follow-Ups', icon: '⛔' },
];

const HOUR_OPTIONS = [1, 2, 6, 12, 24, 48, 72];
const DAY_OPTIONS = [1, 2, 3, 5, 7, 14, 30];

const DEFAULT_ATTEMPTS: Record<string, FollowUpAttempt[]> = {
  no_show: [
    { sequence: 1, enabled: true, timeValue: 24, timeUnit: 'hours', role: 'setter', requireNoStatusChange: true },
    { sequence: 2, enabled: true, timeValue: 3, timeUnit: 'days', role: 'closer', requireNoStatusChange: true },
  ],
  canceled: [
    { sequence: 1, enabled: true, timeValue: 2, timeUnit: 'days', role: 'setter', requireNoStatusChange: true },
  ],
  rescheduled: [
    { sequence: 1, enabled: true, timeValue: 1, timeUnit: 'days', role: 'setter', requireNoStatusChange: true },
  ],
  disqualified: [
    { sequence: 1, enabled: true, timeValue: 7, timeUnit: 'days', role: 'setter', requireNoStatusChange: true },
  ],
};

export function FollowUpSettings({ teamId }: FollowUpSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, FollowUpAttempt[]>>(DEFAULT_ATTEMPTS);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadCustomStages();
    loadSettings();
  }, [teamId]);

  const loadCustomStages = async () => {
    try {
      const { data, error } = await supabase
        .from('team_pipeline_stages')
        .select('stage_id, stage_label')
        .eq('team_id', teamId)
        .order('order_index');

      if (error) throw error;

      if (data && data.length > 0) {
        // Add custom stages to the default ones
        const customStages = data
          .filter(stage => !DEFAULT_STAGES.some(ds => ds.value === stage.stage_id))
          .map(stage => ({
            value: stage.stage_id,
            label: `${stage.stage_label} Follow-Ups`,
            icon: '🎯'
          }));

        setStages([...DEFAULT_STAGES, ...customStages]);

        // Initialize default attempts for custom stages
        const customDefaults: Record<string, FollowUpAttempt[]> = {};
        customStages.forEach(stage => {
          if (!DEFAULT_ATTEMPTS[stage.value]) {
            customDefaults[stage.value] = [
              { sequence: 1, enabled: false, timeValue: 1, timeUnit: 'days', role: 'setter', requireNoStatusChange: true }
            ];
          }
        });

        setSettings(prev => ({ ...DEFAULT_ATTEMPTS, ...customDefaults, ...prev }));
      }
    } catch (error) {
      console.error('Error loading custom stages:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('team_follow_up_flow_config')
        .select('*')
        .eq('team_id', teamId)
        .order('pipeline_stage')
        .order('sequence');

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings: Record<string, FollowUpAttempt[]> = {};
        
        data.forEach(config => {
          if (!loadedSettings[config.pipeline_stage]) {
            loadedSettings[config.pipeline_stage] = [];
          }
          
          const hours = config.hours_after;
          let timeValue: number;
          let timeUnit: 'hours' | 'days';
          
          if (hours % 24 === 0 && hours >= 24) {
            timeValue = hours / 24;
            timeUnit = 'days';
          } else {
            timeValue = hours;
            timeUnit = 'hours';
          }
          
        loadedSettings[config.pipeline_stage].push({
          sequence: config.sequence,
          enabled: config.enabled,
          timeValue,
          timeUnit,
          role: config.assigned_role,
          requireNoStatusChange: config.require_no_status_change_for_next ?? true,
        });
        });
        
        setSettings(prev => ({ ...DEFAULT_ATTEMPTS, ...loadedSettings }));
      }
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

  const updateAttempt = (stage: string, index: number, field: keyof FollowUpAttempt, value: any) => {
    setSettings(prev => ({
      ...prev,
      [stage]: (prev[stage] || []).map((attempt, i) => 
        i === index ? { ...attempt, [field]: value } : attempt
      ),
    }));
  };

  const addAttempt = (stage: string) => {
    setSettings(prev => ({
      ...prev,
      [stage]: [
        ...(prev[stage] || []),
        {
          sequence: (prev[stage] || []).length + 1,
          enabled: true,
          timeValue: 1,
          timeUnit: 'days',
          role: 'setter',
          requireNoStatusChange: true,
        },
      ],
    }));
  };

  const removeAttempt = (stage: string, index: number) => {
    if ((settings[stage] || []).length <= 1) return;
    
    setSettings(prev => ({
      ...prev,
      [stage]: (prev[stage] || [])
        .filter((_, i) => i !== index)
        .map((attempt, i) => ({ ...attempt, sequence: i + 1 })),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing configs for this team
      const { error: deleteError } = await supabase
        .from('team_follow_up_flow_config')
        .delete()
        .eq('team_id', teamId);

      if (deleteError) throw deleteError;

      // Insert all new configs
      const configs = Object.entries(settings).flatMap(([stage, attempts]) =>
        attempts.map(attempt => ({
          team_id: teamId,
          pipeline_stage: stage,
          sequence: attempt.sequence,
          label: `${attempt.sequence === 1 ? '1st' : attempt.sequence === 2 ? '2nd' : attempt.sequence === 3 ? '3rd' : `${attempt.sequence}th`} Follow-Up`,
          hours_after: attempt.timeUnit === 'days' ? attempt.timeValue * 24 : attempt.timeValue,
          assigned_role: attempt.role,
          enabled: attempt.enabled,
          require_no_status_change_for_next: attempt.requireNoStatusChange,
        }))
      );

      const { error } = await supabase
        .from('team_follow_up_flow_config')
        .insert(configs);

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Follow-up flow updated successfully',
      });
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
    <Card>
      <CardHeader>
        <CardTitle>Follow-Up Settings</CardTitle>
        <CardDescription>
          Configure multiple follow-up attempts for each pipeline stage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {stages.map(stage => (
          <div key={stage.value} className="space-y-3">
            <h3 className="font-semibold text-base">{stage.label}</h3>
            
            <div className="space-y-2">
              {(settings[stage.value] || []).map((attempt, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  <Switch
                    checked={attempt.enabled}
                    onCheckedChange={(checked) => updateAttempt(stage.value, index, 'enabled', checked)}
                  />
                  
                  <span className="text-sm font-medium min-w-[100px]">
                    {attempt.sequence === 1 ? '1st' : attempt.sequence === 2 ? '2nd' : attempt.sequence === 3 ? '3rd' : `${attempt.sequence}th`} Follow-Up
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">After:</Label>
                    <Select
                      value={attempt.timeValue.toString()}
                      onValueChange={(value) => updateAttempt(stage.value, index, 'timeValue', parseInt(value))}
                    >
                      <SelectTrigger className="w-[80px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(attempt.timeUnit === 'hours' ? HOUR_OPTIONS : DAY_OPTIONS).map(val => (
                          <SelectItem key={val} value={val.toString()}>{val}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={attempt.timeUnit}
                      onValueChange={(value: 'hours' | 'days') => {
                        updateAttempt(stage.value, index, 'timeUnit', value);
                        updateAttempt(stage.value, index, 'timeValue', value === 'hours' ? 24 : 1);
                      }}
                    >
                      <SelectTrigger className="w-[90px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select
                      value={attempt.role}
                      onValueChange={(value) => updateAttempt(stage.value, index, 'role', value)}
                    >
                      <SelectTrigger className="w-[120px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="offer_owner">Offer Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttempt(stage.value, index)}
                    disabled={(settings[stage.value] || []).length <= 1}
                    className="ml-auto h-9 w-9"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAttempt(stage.value)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Follow-Up
            </Button>
          </div>
        ))}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
