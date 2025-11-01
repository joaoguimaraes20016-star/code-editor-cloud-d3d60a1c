import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, GripVertical, Plus } from "lucide-react";

interface ConfirmationWindow {
  sequence: number;
  hours_before: number;
  label: string;
}

interface ConfirmationScheduleSettingsProps {
  teamId: string;
}

export function ConfirmationScheduleSettings({ teamId }: ConfirmationScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ConfirmationWindow[]>([
    { sequence: 1, hours_before: 24, label: "24h Before" },
    { sequence: 2, hours_before: 1, label: "1h Before" },
    { sequence: 3, hours_before: 0.17, label: "10min Before" }
  ]);
  const [overdueThreshold, setOverdueThreshold] = useState(30);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('confirmation_schedule, overdue_threshold_minutes')
        .eq('id', teamId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        if (data.confirmation_schedule) {
          setSchedule(data.confirmation_schedule as unknown as ConfirmationWindow[]);
        }
        if (data.overdue_threshold_minutes) {
          setOverdueThreshold(data.overdue_threshold_minutes);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load confirmation settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update sequence numbers before saving
      const updatedSchedule = schedule.map((window, idx) => ({
        ...window,
        sequence: idx + 1
      }));

      const { error } = await supabase
        .from('teams')
        .update({
          confirmation_schedule: updatedSchedule,
          overdue_threshold_minutes: overdueThreshold
        })
        .eq('id', teamId);
      
      if (error) throw error;
      
      setSchedule(updatedSchedule);
      toast.success('Confirmation schedule updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save confirmation schedule');
    } finally {
      setSaving(false);
    }
  };

  const addWindow = () => {
    const newWindow: ConfirmationWindow = {
      sequence: schedule.length + 1,
      hours_before: 1,
      label: "New Window"
    };
    setSchedule([...schedule, newWindow]);
  };

  const removeWindow = (index: number) => {
    if (schedule.length <= 1) {
      toast.error('Must have at least one confirmation window');
      return;
    }
    setSchedule(schedule.filter((_, idx) => idx !== index));
  };

  const updateWindow = (index: number, field: keyof ConfirmationWindow, value: any) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmation Schedule</CardTitle>
        <CardDescription>
          Configure how many times setters must confirm each appointment before it happens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Confirmation Windows */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Confirmation Windows</Label>
          <div className="space-y-3">
            {schedule.map((window, idx) => (
              <div key={idx} className="flex gap-3 items-center p-3 border rounded-lg bg-card">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{idx + 1}</Badge>
                <Input 
                  type="number" 
                  value={window.hours_before}
                  onChange={(e) => updateWindow(idx, 'hours_before', parseFloat(e.target.value))}
                  className="w-24"
                  min="0"
                  step="0.01"
                />
                <span className="text-sm text-muted-foreground">hours before</span>
                <Input 
                  value={window.label}
                  onChange={(e) => updateWindow(idx, 'label', e.target.value)}
                  placeholder="Label"
                  className="flex-1"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeWindow(idx)}
                  disabled={schedule.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button onClick={addWindow} variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Window
          </Button>
        </div>

        {/* Overdue Threshold */}
        <div className="space-y-2 pt-4 border-t">
          <Label htmlFor="overdue-threshold" className="text-base font-medium">
            Overdue Threshold
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Mark tasks as overdue if not confirmed within this time after the due time
          </p>
          <div className="flex gap-2 items-center">
            <Input 
              id="overdue-threshold"
              type="number"
              value={overdueThreshold}
              onChange={(e) => setOverdueThreshold(parseInt(e.target.value))}
              className="w-32"
              min="1"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}