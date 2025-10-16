import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save } from "lucide-react";

interface GoogleSheetsConfigProps {
  teamId: string;
  currentUrl?: string | null;
  onUpdate: () => void;
}

export function GoogleSheetsConfig({ teamId, currentUrl, onUpdate }: GoogleSheetsConfigProps) {
  const [url, setUrl] = useState(currentUrl || "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ google_sheets_url: url })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Google Sheets URL saved successfully",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!currentUrl) {
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-appointments", {
        body: { teamId },
      });

      if (error) throw error;

      const response = data as { success?: boolean; count?: number; message?: string; error?: string };
      
      if (response.error) {
        throw new Error(response.error);
      }

      onUpdate();
    } catch (error: any) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync every 5 seconds
  useEffect(() => {
    if (!currentUrl) return;

    const intervalId = setInterval(() => {
      handleSync();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentUrl, teamId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments Database</CardTitle>
        <CardDescription>
          Configure your published Google Sheets URL to automatically sync appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sheets-url">Published Google Sheets URL</Label>
          <Input
            id="sheets-url"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Paste your Google Sheets URL (can be the edit link). The sheet should have columns: <strong>Lead Name, Lead Email, Start At UTC</strong>
            <br />
            <span className="text-xs">Date format example: 2025-10-16 14:30:00 or 2025-10-16T14:30:00Z</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !url}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save URL"}
          </Button>
          <Button 
            onClick={handleSync} 
            disabled={syncing || !currentUrl} 
            variant="secondary"
            title={!currentUrl ? "Please save a URL first" : "Sync appointments from Google Sheets"}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
