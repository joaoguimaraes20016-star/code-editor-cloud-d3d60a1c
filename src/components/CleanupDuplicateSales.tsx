import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

interface CleanupDuplicateSalesProps {
  teamId: string;
  onComplete?: () => void;
}

export function CleanupDuplicateSales({ teamId, onComplete }: CleanupDuplicateSalesProps) {
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      // Delete ALL sales records for this team
      // Sales are now auto-created from appointments, so we can safely delete them
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('team_id', teamId);

      if (error) throw error;

      toast.success('Duplicate sales records cleaned up successfully!');
      onComplete?.();
    } catch (error: any) {
      console.error('Error cleaning up sales:', error);
      toast.error(error.message || 'Failed to clean up sales records');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={cleaning}>
          {cleaning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cleaning...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Clean Duplicate Sales
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clean Up Duplicate Sales Records?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete all sales records for this team. Don't worry - your appointment data is safe and will be used for accurate metrics.
            <br /><br />
            <strong>Why do this?</strong> Sales are now automatically tracked through appointments. Deleting old sales records will fix any duplicate counting issues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup}>
            Yes, Clean Up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
