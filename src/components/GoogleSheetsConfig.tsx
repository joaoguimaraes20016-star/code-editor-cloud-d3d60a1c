import { useState } from "react";
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
      toast({
        title: "Error",
        description: "Please save a Google Sheets URL first before syncing",
        variant: "destructive",
      });
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

      toast({
        title: "Success",
        description: response.message || "Appointments synced successfully",
      });
      onUpdate();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync appointments. Please check your Google Sheets URL.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

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
            Publish your Google Sheet as CSV and paste the URL here. The sheet should have columns: Lead Name, Lead Email, Start At UTC
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
