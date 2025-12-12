import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, TrendingUp, Trash2, FolderKey, Layers, BarChart3, MessageSquare, Settings, ChevronRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Team {
  id: string;
  name: string;
  created_at: string;
  logo_url?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [canCreateTeams, setCanCreateTeams] = useState(false);
  const [isGrowthOperator, setIsGrowthOperator] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadTeams();
    checkUserRole();
    loadUserProfile();

    const channel = supabase
      .channel('team-membership-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadTeams();
          checkUserRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const loadUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    setUserProfile(data);
  };

  const checkUserRole = async () => {
    if (!user) return;
    
    const [{ data: userRole }, { data: profile }] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .maybeSingle()
    ]);
    
    const isCreator = userRole?.role === 'creator' || profile?.account_type === 'creator';
    setCanCreateTeams(isCreator);
    setIsGrowthOperator(isCreator);
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name, created_at, logo_url)')
        .eq('user_id', user?.id);

      if (error) throw error;

      const teamsData = data?.map(item => (item.teams as unknown as Team)) || [];
      setTeams(teamsData);
    } catch (error: any) {
      toast({
        title: 'Error loading teams',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !user) return;

    setCreating(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name: newTeamName, created_by: currentUser.id })
        .select()
        .single();

      if (teamError) throw teamError;

      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: currentUser.id, role: 'owner' });

      if (memberError) throw memberError;

      toast({
        title: 'Team created!',
        description: `${newTeamName} has been created successfully.`,
      });

      setNewTeamName('');
      setDialogOpen(false);
      loadTeams();
    } catch (error: any) {
      toast({
        title: 'Error creating team',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const deleteTeam = async (teamId: string, teamName: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: 'Team deleted',
        description: `${teamName} has been deleted successfully.`,
      });

      loadTeams();
    } catch (error: any) {
      toast({
        title: 'Error deleting team',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getUserInitials = (name: string | null | undefined) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Clean Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Logo size="medium" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">GRWTH OP</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!canCreateTeams && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/?creator=true')}
                  className="hidden sm:flex"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Become Creator
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                Sign Out
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getUserInitials(userProfile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome{userProfile?.full_name ? `, ${userProfile.full_name.split(' ')[0]}` : ''}
          </h2>
          <p className="text-muted-foreground">Select a workspace to get started</p>
        </div>

        {/* Quick Actions for Growth Operators */}
        {isGrowthOperator && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className="group cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
              onClick={() => navigate('/client-assets?tab=onboard')}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Onboard Client
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      Create onboarding forms
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="group cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
              onClick={() => navigate('/client-assets')}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FolderKey className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Client Assets
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      Manage client data
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Teams Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Your Teams</h3>
            </div>
            {canCreateTeams && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    New Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createTeam} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="teamName">Team Name</Label>
                      <Input
                        id="teamName"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Enter team name"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={creating || !newTeamName.trim()}>
                        {creating ? 'Creating...' : 'Create Team'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">No teams yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {canCreateTeams 
                    ? 'Create your first team to get started'
                    : 'Ask your team admin for an invite'}
                </p>
                {canCreateTeams && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="group hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 cursor-pointer relative overflow-hidden"
                  onClick={() => navigate(`/team/${team.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 rounded-xl">
                        <AvatarImage src={team.logo_url || undefined} />
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                          {team.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {team.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click to open workspace
                        </p>
                      </div>
                      {canCreateTeams && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Team</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{team.name}" and all its data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteTeam(team.id, team.name)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    
                    {/* Quick access buttons */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/team/${team.id}/sales`); }}
                      >
                        <BarChart3 className="h-3 w-3 mr-1" />
                        CRM
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/team/${team.id}/funnels`); }}
                      >
                        <Layers className="h-3 w-3 mr-1" />
                        Funnels
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/team/${team.id}/settings`); }}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
