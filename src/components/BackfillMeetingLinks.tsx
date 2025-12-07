import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BackfillMeetingLinksProps {
  teamId: string;
}

export const BackfillMeetingLinks = ({ teamId }: BackfillMeetingLinksProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleBackfill = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-meeting-links', {
        body: { teamId }
      });

      if (error) {
        console.error('Backfill error:', error);
        toast.error('Failed to backfill meeting links');
        return;
      }

      if (data?.updated > 0) {
        toast.success(`Updated ${data.updated} appointments with meeting links`);
      } else {
        toast.info(data?.message || 'No appointments needed updating');
      }
    } catch (error) {
      console.error('Backfill error:', error);
      toast.error('Failed to backfill meeting links');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Backfill Meeting Links
        </CardTitle>
        <CardDescription>
          Fetch meeting links (Zoom, Google Meet, etc.) from Calendly for existing appointments that don't have them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleBackfill} 
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching Meeting Links...
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              Fetch Missing Meeting Links
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
