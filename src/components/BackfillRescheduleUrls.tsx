import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BackfillRescheduleUrlsProps {
  teamId: string;
}

export const BackfillRescheduleUrls = ({ teamId }: BackfillRescheduleUrlsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleBackfill = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-reschedule-urls', {
        body: { teamId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Backfill complete: ${data.updated} appointments updated, ${data.failed} failed`,
          { duration: 5000 }
        );
      } else {
        toast.error('Backfill failed');
      }
    } catch (error: any) {
      console.error('Error backfilling reschedule URLs:', error);
      toast.error(error.message || 'Failed to backfill reschedule URLs');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill Reschedule URLs</CardTitle>
        <CardDescription>
          Fetch and update reschedule URLs for all existing appointments that are missing them
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleBackfill}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Backfilling...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Backfill Reschedule URLs
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
