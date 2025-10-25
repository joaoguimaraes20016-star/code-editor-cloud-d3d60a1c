import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  profiles: {
    full_name: string;
  };
}

interface OperatorControlsProps {
  teamId: string;
}

export function OperatorControls({ teamId }: OperatorControlsProps) {
  const [setters, setSetters] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSetters();
  }, [teamId]);

  const loadSetters = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          is_active,
          profiles:user_id (
            full_name
          )
        `)
        .eq('team_id', teamId)
        .eq('role', 'setter');

      if (error) throw error;
      setSetters(data || []);
    } catch (error) {
      console.error('Error loading setters:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const toggleSetterActive = async (memberId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: !currentState })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Setter ${!currentState ? 'activated' : 'deactivated'}`);
      loadSetters();
    } catch (error) {
      console.error('Error toggling setter:', error);
      toast.error('Failed to update setter status');
    }
  };

  const rebalanceTasks = async () => {
    try {
      // Get task counts per setter
      const { data: taskCounts, error: countError } = await supabase
        .from('confirmation_tasks')
        .select('assigned_to')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .not('assigned_to', 'is', null);

      if (countError) throw countError;

      // Find setter with most tasks
      const counts: Record<string, number> = {};
      taskCounts?.forEach(task => {
        if (task.assigned_to) {
          counts[task.assigned_to] = (counts[task.assigned_to] || 0) + 1;
        }
      });

      const busiestSetter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      
      if (!busiestSetter || busiestSetter[1] <= 1) {
        toast.info('Tasks are already balanced');
        return;
      }

      // Get oldest task from busiest setter
      const { data: taskToMove, error: taskError } = await supabase
        .from('confirmation_tasks')
        .select('id')
        .eq('team_id', teamId)
        .eq('assigned_to', busiestSetter[0])
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!taskToMove) {
        toast.info('No tasks to rebalance');
        return;
      }

      // Return task to queue
      const { error: updateError } = await supabase
        .from('confirmation_tasks')
        .update({
          assigned_to: null,
          assigned_at: null,
          auto_return_at: null
        })
        .eq('id', taskToMove.id);

      if (updateError) throw updateError;

      toast.success('Task rebalanced to queue');
    } catch (error) {
      console.error('Error rebalancing tasks:', error);
      toast.error('Failed to rebalance tasks');
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Operator Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Setters
            </Label>
            <Button variant="outline" size="sm" onClick={rebalanceTasks}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Rebalance Tasks
            </Button>
          </div>
          
          {setters.map((setter) => (
            <div key={setter.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">{setter.profiles.full_name}</p>
                <Badge variant={setter.is_active ? 'default' : 'secondary'}>
                  {setter.is_active ? 'Active in Round-Robin' : 'Inactive'}
                </Badge>
              </div>
              <Switch
                checked={setter.is_active}
                onCheckedChange={() => toggleSetterActive(setter.id, setter.is_active)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
