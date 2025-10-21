import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FolderKey, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { ClientAssetsDashboard } from '@/components/client-assets/ClientAssetsDashboard';
import { ClientAssetsList } from '@/components/client-assets/ClientAssetsList';
import { NewClientAssetDialog } from '@/components/client-assets/NewClientAssetDialog';
import { OnboardingTemplateManager } from '@/components/client-assets/OnboardingTemplateManager';
import { MyAssets } from '@/components/client-assets/MyAssets';

interface Team {
  id: string;
  name: string;
  role: string;
}

export default function ClientAssets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [hasOwnAsset, setHasOwnAsset] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadTeams();
  }, [user, navigate]);

  const loadTeams = async () => {
    try {
      // Get all teams for the user
      const { data: teamMembers, error } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name)')
        .eq('user_id', user?.id);

      if (error) throw error;

      const teamsData = teamMembers
        ?.map((tm) => ({
          id: (tm.teams as any).id,
          name: (tm.teams as any).name,
          role: tm.role,
        }))
        .filter((t) => t.id && t.name) || [];

      setTeams(teamsData);

      // Check if user has their own client asset (invited as a client)
      const { data: ownAsset } = await supabase
        .from('client_assets')
        .select('id')
        .eq('client_email', user?.email)
        .maybeSingle();

      setHasOwnAsset(!!ownAsset);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="bg-card/50 backdrop-blur-sm border-2 border-border">
            <CardContent className="py-12 text-center">
              <FolderKey className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Access</h2>
              <p className="text-muted-foreground">
                You haven't been added to any teams yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if user is a growth operator (offer_owner, admin, or owner)
  const isGrowthOperator = teams.some(t => 
    ['owner', 'admin', 'offer_owner'].includes(t.role)
  );

  // If user has their own client asset (was invited as a client), show My Assets view
  // regardless of their role
  if (hasOwnAsset || !isGrowthOperator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  My Information
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage your onboarding information and track your progress
                </p>
              </div>
            </div>
          </div>

          <MyAssets />
        </div>
      </div>
    );
  }

  // Growth operator view - show admin interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FolderKey className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Client Assets Management
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Securely collect and manage client onboarding information
                  </p>
                </div>
              </div>

              <Button onClick={() => setShowNewDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {teams.length > 0 && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card/50 backdrop-blur-sm border border-border">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="clients">Active Clients</TabsTrigger>
              <TabsTrigger value="templates">Form Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <ClientAssetsDashboard teamIds={teams.map(t => t.id)} />
            </TabsContent>

            <TabsContent value="clients" className="space-y-6">
              <ClientAssetsList teamIds={teams.map(t => t.id)} />
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              <OnboardingTemplateManager teamId={teams[0].id} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <NewClientAssetDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
      />
    </div>
  );
}
