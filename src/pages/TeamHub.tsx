import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, Settings } from 'lucide-react';
import TeamAssets from '@/components/TeamAssets';
import TeamChat from '@/components/TeamChat';

export default function TeamHub() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, isOwner } = useTeamRole(teamId);
  const [teamName, setTeamName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const loadTeam = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();

        if (error) throw error;
        setTeamName(data.name);
      } catch (error) {
        console.error('Error loading team:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with glass effect */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 hover:text-primary transition-all"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {teamName}
                </h1>
                <p className="text-sm text-muted-foreground font-medium">Team Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                onClick={() => navigate(`/team/${teamId}/sales`)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Sales Dashboard
              </Button>
              {(isOwner || role === 'offer_owner' || role === 'admin') && (
                <Button
                  variant="outline"
                  size="icon"
                  className="hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                  onClick={() => navigate(`/team/${teamId}/settings`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="assets" className="space-y-8">
          <TabsList className="bg-muted/50 backdrop-blur-sm p-1">
            <TabsTrigger 
              value="assets"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
            >
              Team Assets
            </TabsTrigger>
            <TabsTrigger 
              value="chat"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
            >
              Team Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="animate-fade-in flex justify-center">
            <TeamAssets teamId={teamId!} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4 animate-fade-in">
            <TeamChat teamId={teamId!} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
