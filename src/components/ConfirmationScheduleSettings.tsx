import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, GripVertical, Plus, AlertCircle, Calendar, Clock } from "lucide-react";

interface ConfirmationWindow {
  sequence: number;
  hours_before: number;
  label: string;
}

interface WindowWithUnit extends ConfirmationWindow {
  displayValue: number;
  displayUnit: 'minutes' | 'hours' | 'days';
}

const PRESETS = {
  standard: [
    { hours_before: 24, label: "24 Hours Before" },
    { hours_before: 1, label: "1 Hour Before" },
    { hours_before: 0.17, label: "10 Minutes Before" }
  ],
  aggressive: [
    { hours_before: 48, label: "2 Days Before" },
    { hours_before: 24, label: "24 Hours Before" },
    { hours_before: 2, label: "2 Hours Before" },
    { hours_before: 0.17, label: "10 Minutes Before" }
  ],
  light: [
    { hours_before: 24, label: "24 Hours Before" }
  ]
};

interface ConfirmationScheduleSettingsProps {
  teamId: string;
}

const hoursToDisplayUnit = (hours: number): { value: number; unit: 'minutes' | 'hours' | 'days' } => {
  if (hours >= 24 && hours % 24 === 0) {
    return { value: hours / 24, unit: 'days' };
  } else if (hours >= 1) {
    return { value: hours, unit: 'hours' };
  } else {
    return { value: Math.round(hours * 60), unit: 'minutes' };
  }
};

const displayUnitToHours = (value: number, unit: 'minutes' | 'hours' | 'days'): number => {
  switch (unit) {
    case 'days':
      return value * 24;
    case 'hours':
      return value;
    case 'minutes':
      return value / 60;
  }
};

export function ConfirmationScheduleSettings({ teamId }: ConfirmationScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<WindowWithUnit[]>([
    { sequence: 1, hours_before: 24, label: "24 Hours Before", displayValue: 24, displayUnit: 'hours' },
    { sequence: 2, hours_before: 1, label: "1 Hour Before", displayValue: 1, displayUnit: 'hours' },
    { sequence: 3, hours_before: 0.17, label: "10 Minutes Before", displayValue: 10, displayUnit: 'minutes' }
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
          const windows = data.confirmation_schedule as unknown as ConfirmationWindow[];
          const withUnits = windows.map(w => {
            const { value, unit } = hoursToDisplayUnit(w.hours_before);
            return { ...w, displayValue: value, displayUnit: unit };
          });
          setSchedule(withUnits);
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
    const newWindow: WindowWithUnit = {
      sequence: schedule.length + 1,
      hours_before: 1,
      label: "New Reminder",
      displayValue: 1,
      displayUnit: 'hours'
    };
    setSchedule([...schedule, newWindow]);
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const presetWindows = PRESETS[preset].map((w, idx) => {
      const { value, unit } = hoursToDisplayUnit(w.hours_before);
      return {
        sequence: idx + 1,
        hours_before: w.hours_before,
        label: w.label,
        displayValue: value,
        displayUnit: unit
      };
    });
    setSchedule(presetWindows);
    toast.success('Preset applied');
  };

  const removeWindow = (index: number) => {
    if (schedule.length <= 1) {
      toast.error('Must have at least one confirmation window');
      return;
    }
    setSchedule(schedule.filter((_, idx) => idx !== index));
  };

  const updateWindow = (index: number, field: keyof WindowWithUnit, value: any) => {
    const updated = [...schedule];
    
    if (field === 'displayValue' || field === 'displayUnit') {
      const displayValue = field === 'displayValue' ? value : updated[index].displayValue;
      const displayUnit = field === 'displayUnit' ? value : updated[index].displayUnit;
      const hours_before = displayUnitToHours(displayValue, displayUnit);
      
      updated[index] = {
        ...updated[index],
        displayValue,
        displayUnit,
        hours_before
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setSchedule(updated);
  };

  const getValidationWarnings = () => {
    const warnings: string[] = [];
    const sortedSchedule = [...schedule].sort((a, b) => b.hours_before - a.hours_before);
    
    for (let i = 0; i < sortedSchedule.length - 1; i++) {
      const diff = sortedSchedule[i].hours_before - sortedSchedule[i + 1].hours_before;
      if (diff < 0.083) { // Less than 5 minutes
        warnings.push(`Reminders "${sortedSchedule[i].label}" and "${sortedSchedule[i + 1].label}" are very close together (less than 5 minutes apart)`);
      }
    }
    
    sortedSchedule.forEach(w => {
      if (w.hours_before < 0) {
        warnings.push(`"${w.label}" has a negative time - this will create reminders after the appointment`);
      }
    });
    
    return warnings;
  };

  const getExampleTimes = () => {
    const appointmentTime = new Date();
    appointmentTime.setHours(15, 0, 0, 0); // 3:00 PM today
    
    return schedule
      .sort((a, b) => b.hours_before - a.hours_before)
      .map(w => {
        const reminderTime = new Date(appointmentTime);
        reminderTime.setTime(reminderTime.getTime() - (w.hours_before * 60 * 60 * 1000));
        return {
          label: w.label,
          time: reminderTime.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        };
      });
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

  const warnings = getValidationWarnings();
  const exampleTimes = getExampleTimes();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment Confirmation Reminders</CardTitle>
        <CardDescription>
          Set up when setters should confirm appointments. Setters will be reminded at each time you configure below, and must confirm at each reminder before the appointment is marked as CONFIRMED.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual Example */}
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">Example: For a 3:00 PM appointment</div>
            <div className="space-y-1 text-sm">
              {exampleTimes.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="text-muted-foreground">{ex.label}:</span>
                  <span className="font-medium">Reminder on {ex.time}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        {/* Preset Buttons */}
        <div className="space-y-2">
          <Label className="text-sm">Quick Presets</Label>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => applyPreset('standard')}
              type="button"
            >
              Standard (3 reminders)
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => applyPreset('aggressive')}
              type="button"
            >
              Aggressive (4 reminders)
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => applyPreset('light')}
              type="button"
            >
              Light Touch (1 reminder)
            </Button>
          </div>
        </div>

        {/* Validation Warnings */}
        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Configuration Issues:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {/* Reminder Schedule */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Reminder Schedule</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Setters will confirm once at each reminder time. After all confirmations, the appointment is marked as CONFIRMED.
            </p>
          </div>
          <div className="space-y-3">
            {schedule.map((window, idx) => (
              <div key={idx} className="flex gap-3 items-start p-3 border rounded-lg bg-card">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-2" />
                <Badge variant="secondary" className="mt-2">{idx + 1}</Badge>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="number" 
                      value={window.displayValue}
                      onChange={(e) => updateWindow(idx, 'displayValue', parseFloat(e.target.value) || 0)}
                      className="w-20"
                      min="0"
                    />
                    <Select 
                      value={window.displayUnit}
                      onValueChange={(value) => updateWindow(idx, 'displayUnit', value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">before appointment</span>
                  </div>
                  <Input 
                    value={window.label}
                    onChange={(e) => updateWindow(idx, 'label', e.target.value)}
                    placeholder="Display name (shown to setters)"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {window.hours_before.toFixed(2)} hours before
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeWindow(idx)}
                  disabled={schedule.length <= 1}
                  className="mt-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button onClick={addWindow} variant="outline" size="sm" className="w-full" type="button">
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        </div>

        {/* Grace Period */}
        <div className="space-y-2 pt-4 border-t">
          <Label htmlFor="overdue-threshold" className="text-base font-medium">
            Grace Period
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            How long after a reminder time before it's marked as overdue (e.g., 30 = half an hour, 60 = one hour)
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

        {/* Task Preview */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-base font-medium">What Setters Will See</Label>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">📞 Confirm Appointment</div>
                    <div className="text-sm text-muted-foreground">Client: John Doe</div>
                    <div className="text-sm text-muted-foreground">Due: {exampleTimes[0]?.time || 'Nov 10, 7:00 PM'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default">Confirm</Button>
                  <Button size="sm" variant="outline">No Answer</Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Confirmed: 1 of {schedule.length} ✓
                </div>
              </div>
            </CardContent>
          </Card>
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