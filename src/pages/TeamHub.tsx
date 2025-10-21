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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{teamName}</h1>
                <p className="text-sm text-muted-foreground">Team Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={() => navigate(`/team/${teamId}/sales`)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Sales Dashboard
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(`/team/${teamId}/settings`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assets">Team Assets</TabsTrigger>
            <TabsTrigger value="chat">Team Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="space-y-4">
            <TeamAssets teamId={teamId!} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <TeamChat teamId={teamId!} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
