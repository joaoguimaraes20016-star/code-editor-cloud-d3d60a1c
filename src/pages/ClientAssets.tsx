import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FolderKey, User, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [hasOwnAsset, setHasOwnAsset] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  
  // Check if we should open the onboard tab
  const defaultTab = searchParams.get('tab') === 'onboard' ? 'onboard' : 'assets';

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadTeams();
  }, [user, navigate]);

  const loadTeams = async () => {
    try {
      // Check if user has creator or super_admin global role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .maybeSingle();

      setIsCreator(userRole?.role === 'creator' || userRole?.role === 'super_admin');

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
      const { data: ownAssets } = await supabase
        .from('client_assets')
        .select('id')
        .eq('client_email', user?.email);

      setHasOwnAsset((ownAssets?.length || 0) > 0);
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

  // Only show agency management interface to creators (users who signed up with creator code)
  // Everyone else sees the My Assets (client) view
  if (!isCreator || hasOwnAsset) {
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
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FolderKey className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {defaultTab === 'onboard' ? 'Onboard New Client' : 'Client Assets'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {defaultTab === 'onboard' 
                    ? 'Create secure onboarding forms for new clients'
                    : 'View and manage existing client information'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on tab */}
        {teams.length > 0 && (
          defaultTab === 'onboard' ? (
            // Onboard New Client View with Tabs
            <Tabs defaultValue="create" className="space-y-6">
              <TabsList className="bg-card/50 backdrop-blur-sm border border-border">
                <TabsTrigger value="create">Create New Onboarding</TabsTrigger>
                <TabsTrigger value="templates">Form Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-sm border-2 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4 mb-6">
                      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Create Client Onboarding</h2>
                        <p className="text-muted-foreground mt-2">
                          Generate a secure form to collect client information
                        </p>
                      </div>
                    </div>
                    
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">📋 Secure Forms</h3>
                          <p className="text-sm text-muted-foreground">
                            Custom forms with encrypted storage for sensitive data
                          </p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">🔗 Share Links</h3>
                          <p className="text-sm text-muted-foreground">
                            Send unique onboarding links to clients via email
                          </p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">📊 Track Progress</h3>
                          <p className="text-sm text-muted-foreground">
                            Monitor completion status in real-time
                          </p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">🔐 Auto Accounts</h3>
                          <p className="text-sm text-muted-foreground">
                            Automatically create client accounts upon completion
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => setShowNewDialog(true)} 
                        className="w-full h-12 text-lg gap-2"
                        size="lg"
                      >
                        <Plus className="h-5 w-5" />
                        Create New Client Onboarding
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="templates" className="space-y-6">
                <OnboardingTemplateManager teamId={teams[0].id} />
              </TabsContent>
            </Tabs>
          ) : (
            // Client Assets View - Assets only
            <div className="space-y-6">
              <ClientAssetsDashboard teamIds={teams.map(t => t.id)} />
              <ClientAssetsList teamIds={teams.map(t => t.id)} />
            </div>
          )
        )}
      </div>

      <NewClientAssetDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
      />
    </div>
  );
}
