import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import { useTeamRole } from '@/hooks/useTeamRole';

interface SetterRotationSettingsProps {
  teamId: string;
}

interface Setter {
  user_id: string;
  profiles: {
    full_name: string | null;
  } | null;
  is_in_rotation: boolean;
  pending_tasks_count: number;
}

export function SetterRotationSettings({ teamId }: SetterRotationSettingsProps) {
  const { role: userRole } = useTeamRole(teamId);
  const [setters, setSetters] = useState<Setter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSetters();
  }, [teamId]);

  const loadSetters = async () => {
    try {
      // Get all setters for the team
      const { data: teamSetters, error: settersError } = await supabase
        .from('team_members')
        .select('user_id, profiles(full_name)')
        .eq('team_id', teamId)
        .eq('role', 'setter')
        .eq('is_active', true);

      if (settersError) throw settersError;

      // Get rotation settings
      const { data: rotationSettings, error: settingsError } = await supabase
        .from('setter_rotation_settings')
        .select('setter_id, is_in_rotation')
        .eq('team_id', teamId);

      if (settingsError) throw settingsError;

      // Get pending task counts for each setter
      const { data: taskCounts, error: taskCountsError } = await supabase
        .from('confirmation_tasks')
        .select('assigned_to')
        .eq('team_id', teamId)
        .eq('status', 'pending');

      if (taskCountsError) throw taskCountsError;

      // Count tasks per setter
      const taskCountMap = new Map<string, number>();
      taskCounts?.forEach(task => {
        if (task.assigned_to) {
          taskCountMap.set(task.assigned_to, (taskCountMap.get(task.assigned_to) || 0) + 1);
        }
      });

      // Merge the data - default to in rotation if no setting exists
      const settersWithRotation = teamSetters?.map(setter => {
        const setting = rotationSettings?.find(s => s.setter_id === setter.user_id);
        return {
          ...setter,
          is_in_rotation: setting ? setting.is_in_rotation : true,
          pending_tasks_count: taskCountMap.get(setter.user_id) || 0
        };
      }) || [];

      setSetters(settersWithRotation);
    } catch (error) {
      console.error('Error loading setters:', error);
      toast.error('Failed to load setter rotation settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleRotation = async (setterId: string, currentValue: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('setter_rotation_settings')
        .upsert({
          team_id: teamId,
          setter_id: setterId,
          is_in_rotation: !currentValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'team_id,setter_id'
        });

      if (error) throw error;

      // Update local state
      setSetters(prev => prev.map(setter => 
        setter.user_id === setterId 
          ? { ...setter, is_in_rotation: !currentValue }
          : setter
      ));

      toast.success(
        !currentValue 
          ? 'Added to round robin rotation' 
          : 'Removed from round robin rotation'
      );
    } catch (error) {
      console.error('Error updating rotation:', error);
      toast.error('Failed to update rotation settings');
    } finally {
      setSaving(false);
    }
  };

  // Only show to admins and offer owners
  if (userRole !== 'admin' && userRole !== 'offer_owner') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Round Robin Rotation Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select which setters should receive auto-assigned call confirmation tasks
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {setters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active setters found</p>
        ) : (
          <>
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Task Distribution</p>
              <p className="text-xs text-muted-foreground">
                Current pending tasks assigned to each setter
              </p>
            </div>
            {setters.map((setter) => (
              <div 
                key={setter.user_id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <Label htmlFor={`setter-${setter.user_id}`} className="cursor-pointer">
                    <span className="font-medium">
                      {setter.profiles?.full_name || 'Unknown'}
                    </span>
                    {setter.is_in_rotation && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Active in rotation)
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Pending tasks:
                    </span>
                    <Badge variant={setter.pending_tasks_count === 0 ? "secondary" : "default"} className="text-xs">
                      {setter.pending_tasks_count}
                    </Badge>
                  </div>
                </div>
                <Switch
                  id={`setter-${setter.user_id}`}
                  checked={setter.is_in_rotation}
                  onCheckedChange={() => toggleRotation(setter.user_id, setter.is_in_rotation)}
                  disabled={saving}
                />
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
