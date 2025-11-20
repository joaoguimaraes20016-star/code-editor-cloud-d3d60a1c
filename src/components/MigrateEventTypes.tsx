import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, AlertCircle } from "lucide-react";

export function MigrateEventTypes() {
  const [migrating, setMigrating] = useState(false);

  const handleMigrate = async () => {
    setMigrating(true);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-event-type-urls', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Migration completed successfully');
        // Reload page after a short delay to show updated event types
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data?.error || 'Migration failed');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Failed to run migration');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            Round Robin events not showing?
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
            Click to migrate your event types to the correct format.
          </p>
        </div>
        <Button 
          onClick={handleMigrate} 
          disabled={migrating}
          size="sm"
          variant="outline"
          className="border-yellow-300 hover:bg-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900/30 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${migrating ? 'animate-spin' : ''}`} />
          {migrating ? "Migrating..." : "Fix Now"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
