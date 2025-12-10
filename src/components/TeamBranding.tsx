import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function TeamBranding() {
  const { teamId } = useParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [teamName, setTeamName] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: team, isLoading } = useQuery({
    queryKey: ["team-branding", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("name, logo_url")
        .eq("id", teamId)
        .single();
      
      if (error) throw error;
      if (data) {
        setTeamName(data.name);
      }
      return data;
    },
    enabled: !!teamId,
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ name, logoUrl }: { name?: string; logoUrl?: string | null }) => {
      const updates: Record<string, string | null> = {};
      if (name !== undefined) updates.name = name;
      if (logoUrl !== undefined) updates.logo_url = logoUrl;
      
      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-branding", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success("Team branding updated");
    },
    onError: () => {
      toast.error("Failed to update team branding");
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamId) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${teamId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("team-logos")
        .getPublicUrl(filePath);

      await updateTeamMutation.mutateAsync({ logoUrl: publicUrl });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    await updateTeamMutation.mutateAsync({ logoUrl: null });
  };

  const handleSave = () => {
    updateTeamMutation.mutate({ name: teamName });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Branding</CardTitle>
        <CardDescription>Customize your team's logo and display name</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Section */}
        <div className="space-y-4">
          <Label>Team Logo</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 rounded-lg">
              <AvatarImage src={team?.logo_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xl">
                {getInitials(team?.name || "T")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Logo
              </Button>
              {team?.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended: Square image, at least 200x200px
          </p>
        </div>

        {/* Team Name */}
        <div className="space-y-2">
          <Label htmlFor="teamName">Team Name</Label>
          <Input
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter team name"
          />
        </div>

        <Button 
          onClick={handleSave} 
          disabled={updateTeamMutation.isPending}
          className="w-full sm:w-auto"
        >
          {updateTeamMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
