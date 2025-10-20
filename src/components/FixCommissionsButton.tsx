import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface FixCommissionsButtonProps {
  teamId: string;
  onComplete: () => void;
}

export function FixCommissionsButton({ teamId, onComplete }: FixCommissionsButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { teamId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Cleanup Complete",
          description: `Removed ${data.deletedCount} duplicate sales. ${data.remainingCount} unique sales remaining.`,
        });
        // Force page reload to clear any cached data
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "Error cleaning up duplicates",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Remove Duplicates
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Duplicate Sales</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove duplicate sales records (same customer, date, and sales rep), keeping only the first occurrence of each sale.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup} disabled={isProcessing}>
            {isProcessing ? "Cleaning..." : "Remove Duplicates"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}