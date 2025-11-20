import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MigrateEventTypes() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMigration = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-event-type-urls', {
        body: {}
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'Migration failed');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Failed to run migration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Migrate Calendly Event Types</CardTitle>
        <CardDescription>
          Convert existing scheduling URLs to API URIs for proper Round Robin event detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleMigration} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Running Migration...
            </>
          ) : (
            'Run Migration'
          )}
        </Button>

        {result && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 font-semibold">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span>{result.message}</span>
            </div>
            
            {result.success && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Teams migrated: {result.migrated}</p>
                <p>• Teams skipped: {result.skipped}</p>
                <p>• Total teams: {result.total}</p>
              </div>
            )}

            {result.results && result.results.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  View Details
                </summary>
                <div className="mt-2 space-y-2 text-xs">
                  {result.results.map((r: any, i: number) => (
                    <div key={i} className="rounded border p-2">
                      <p><strong>Team:</strong> {r.team_id}</p>
                      <p><strong>Status:</strong> {r.status}</p>
                      {r.error && <p className="text-destructive"><strong>Error:</strong> {r.error}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
