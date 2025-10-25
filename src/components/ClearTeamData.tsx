import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

interface ClearTeamDataProps {
  teamId: string;
}

export function ClearTeamData({ teamId }: ClearTeamDataProps) {
  const [clearing, setClearing] = useState(false);

  const handleClearData = async () => {
    setClearing(true);
    try {
      // Delete in order due to foreign key constraints
      
      // 1. Delete activity logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('team_id', teamId);
      if (activityError) throw activityError;

      // 2. Delete MRR follow-up tasks
      const { error: mrrTasksError } = await supabase
        .from('mrr_follow_up_tasks')
        .delete()
        .eq('team_id', teamId);
      if (mrrTasksError) throw mrrTasksError;

      // 3. Delete MRR schedules
      const { error: mrrSchedulesError } = await supabase
        .from('mrr_schedules')
        .delete()
        .eq('team_id', teamId);
      if (mrrSchedulesError) throw mrrSchedulesError;

      // 4. Delete MRR commissions
      const { error: mrrCommissionsError } = await supabase
        .from('mrr_commissions')
        .delete()
        .eq('team_id', teamId);
      if (mrrCommissionsError) throw mrrCommissionsError;

      // 5. Delete confirmation tasks
      const { error: tasksError } = await supabase
        .from('confirmation_tasks')
        .delete()
        .eq('team_id', teamId);
      if (tasksError) throw tasksError;

      // 6. Delete appointments
      const { error: appointmentsError } = await supabase
        .from('appointments')
        .delete()
        .eq('team_id', teamId);
      if (appointmentsError) throw appointmentsError;

      // 7. Delete sales
      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .eq('team_id', teamId);
      if (salesError) throw salesError;

      toast.success('All operational data cleared successfully!');
      
      // Reload the page to refresh all data
      window.location.reload();
    } catch (error: any) {
      console.error('Error clearing team data:', error);
      toast.error(error.message || 'Failed to clear team data');
    } finally {
      setClearing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={clearing}>
          {clearing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear All Operational Data?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-semibold text-foreground">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All appointments and tasks</li>
              <li>All sales records</li>
              <li>All MRR schedules and follow-ups</li>
              <li>All commission records</li>
              <li>All activity logs</li>
            </ul>
            <p className="font-semibold text-foreground mt-4">This will keep:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Team members and their roles</li>
              <li>Team settings and configurations</li>
              <li>Pipeline stages</li>
              <li>Commission settings</li>
            </ul>
            <p className="text-destructive font-bold mt-4">This action cannot be undone!</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90">
            Yes, Clear All Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
