import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, BarChart3, Layers, Settings, MessageSquare, 
  FolderOpen, Users, Plug, ChevronRight 
} from 'lucide-react';
import TeamAssets from '@/components/TeamAssets';
import TeamChat from '@/components/TeamChat';

export default function TeamHub() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { role, isAdmin } = useTeamRole(teamId);
  const [teamName, setTeamName] = useState<string>('');
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!teamId) return;

    const loadTeam = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('name, logo_url')
          .eq('id', teamId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setTeamName(data.name);
          setTeamLogo(data.logo_url);
        }
      } catch (error) {
        console.error('Error loading team:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId]);

  // Determine active tab from URL
  useEffect(() => {
    if (location.pathname.includes('/assets')) {
      setActiveTab('assets');
    } else if (location.pathname.includes('/chat')) {
      setActiveTab('chat');
    } else {
      setActiveTab('overview');
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      label: 'Sales CRM',
      description: 'Pipeline & appointments',
      icon: BarChart3,
      onClick: () => navigate(`/team/${teamId}/sales`),
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Funnels',
      description: 'Build & manage funnels',
      icon: Layers,
      onClick: () => navigate(`/team/${teamId}/funnels`),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Team Settings',
      description: 'Members & integrations',
      icon: Settings,
      onClick: () => navigate(`/team/${teamId}/settings`),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      adminOnly: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-lg">
                  <AvatarImage src={teamLogo || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold">
                    {teamName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="font-semibold text-foreground">{teamName}</h1>
                  <p className="text-xs text-muted-foreground">Team Workspace</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/team/${teamId}/funnels`)}
                className="hidden sm:flex"
              >
                <Layers className="h-4 w-4 mr-2" />
                Funnels
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`/team/${teamId}/sales`)}
                className="bg-primary hover:bg-primary/90"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sales CRM</span>
                <span className="sm:hidden">CRM</span>
              </Button>
              {(isAdmin || role === 'offer_owner' || role === 'admin' || role === 'owner') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => navigate(`/team/${teamId}/settings`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              Overview
            </TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:bg-background">
              <FolderOpen className="h-4 w-4 mr-2" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-background">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickActions
                  .filter(action => !action.adminOnly || isAdmin || role === 'offer_owner' || role === 'admin' || role === 'owner')
                  .map((action) => (
                  <Card 
                    key={action.label}
                    className="group cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
                    onClick={action.onClick}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${action.bgColor} group-hover:scale-110 transition-transform`}>
                          <action.icon className={`h-5 w-5 ${action.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {action.label}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {action.description}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Team Chat Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Team Chat</h2>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('chat')}>
                  View All
                </Button>
              </div>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-[300px] overflow-hidden">
                    <TeamChat teamId={teamId!} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-0">
            <TeamAssets teamId={teamId!} />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-0">
            <TeamChat teamId={teamId!} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
