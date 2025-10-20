import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SyncFromUrlProps {
  teamId: string;
  onSync: () => void;
}

export function SyncFromUrl({ teamId, onSync }: SyncFromUrlProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL to sync from",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-from-url', {
        body: { url, teamId }
      });

      if (error) throw error;

      if (data.success) {
        const { successCount = 0, duplicateCount = 0, errorCount = 0 } = data;
        const messages = [];
        if (successCount > 0) messages.push(`${successCount} new records`);
        if (duplicateCount > 0) messages.push(`${duplicateCount} duplicates skipped`);
        if (errorCount > 0) messages.push(`${errorCount} failed`);
        
        toast({
          title: "Sync Complete",
          description: messages.join(', ') || "No changes made",
        });
        onSync();
        setOpen(false);
        setUrl("");
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Failed to sync data",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Error syncing data from URL",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync from URL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sync Sales from URL</DialogTitle>
          <DialogDescription>
            Paste a URL to a CSV file (Google Sheets export, hosted CSV, etc.) to sync your sales data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sync-url">CSV URL</Label>
            <Input
              id="sync-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">For Google Sheets:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>File → Share → Publish to web</li>
                <li>Select "Comma-separated values (.csv)"</li>
                <li>Click Publish and copy the URL</li>
              </ol>
              <p className="text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Don't use the edit link - it won't work!
              </p>
            </div>
          </div>

          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Expected CSV Format:</p>
            <code className="text-xs block bg-card p-2 rounded overflow-x-auto">
              Customer Name,Email,Closer,Setter,Offer Owner,Date,Revenue,Setter Commission,Closer Commission,Status,MRR,MRR Months
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              * Column order doesn't matter - auto-detected by name
            </p>
          </div>

          <Button
            onClick={handleSync}
            disabled={isProcessing || !url.trim()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Link className="mr-2 h-4 w-4" />
                Sync Data
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
