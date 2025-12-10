import { useParams } from "react-router-dom";
import { ProfileSettings } from "@/components/ProfileSettings";
import { TeamBranding } from "@/components/TeamBranding";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Palette } from "lucide-react";

export default function PersonalSettings() {
  const { teamId } = useParams();
  const { isAdmin } = useTeamRole(teamId);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="profile" className="gap-2">
              <UserCircle className="h-4 w-4" />
              Profile
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="h-4 w-4" />
                Branding
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettings />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="branding" className="space-y-6">
              <TeamBranding />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}