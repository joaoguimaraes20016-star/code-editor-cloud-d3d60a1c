import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, TrendingUp, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Team {
  id: string;
  name: string;
  created_at: string;
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

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadTeams();
    checkUserRole();
  }, [user, navigate]);

  const checkUserRole = async () => {
    if (!user) return;
    
    // Only allow creating teams if user is a creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();
    
    setCanCreateTeams(profile?.account_type === 'creator');
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name, created_at)')
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
      // Get current user to ensure auth is valid
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      console.log('Creating team with user ID:', currentUser.id);

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name: newTeamName, created_by: currentUser.id })
        .select()
        .single();

      if (teamError) {
        console.error('Team creation error:', teamError);
        throw teamError;
      }

      console.log('Team created successfully:', team);

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: currentUser.id, role: 'owner' });

      if (memberError) {
        console.error('Team member creation error:', memberError);
        throw memberError;
      }

      console.log('Team member added successfully');

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-primary opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Full-width black header */}
      <div className="w-full bg-black border-y-2 border-primary relative z-10">
        <div className="container mx-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
            <div className="space-y-2 w-full md:w-auto">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-black p-2 rounded-lg">
                  <Logo size="large" />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  GRWTH OP Dashboard
                </h1>
              </div>
              <p className="text-sm md:text-base text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Select a team to get started
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full md:w-auto">
              {!canCreateTeams && (
                <Button 
                  variant="default" 
                  onClick={() => navigate('/?creator=true')}
                  className="bg-primary hover:bg-primary/90 transition-all duration-300 text-sm md:text-base"
                >
                  Sign Up as Creator
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="hover:bg-primary/10 hover:text-primary transition-all duration-300 text-sm md:text-base"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto p-4 md:p-6 space-y-6 md:space-y-8 relative z-10">

        <div className="grid gap-8 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 animate-scale-in">
            {teams.map((team, index) => (
              <Card
                key={team.id}
                className="group hover:border-primary hover:shadow-glow transition-all duration-500 bg-gradient-card backdrop-blur-sm border-2 border-primary/50 overflow-hidden relative cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative py-8 md:py-6 cursor-pointer" onClick={() => navigate(`/team/${team.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors duration-300">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors duration-300">{team.name}</CardTitle>
                    </div>
                    {canCreateTeams && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Team</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{team.name}"? This action cannot be undone and will remove all team data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTeam(team.id, team.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    Click to view team data
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}

            {canCreateTeams && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer hover:border-primary hover:shadow-glow transition-all duration-500 border-dashed border-2 border-primary/50 bg-gradient-card backdrop-blur-sm overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardContent className="flex flex-col items-center justify-center h-full min-h-[220px] py-10 md:py-8 relative">
                      <div className="p-4 bg-primary/10 rounded-full mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                        <Plus className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors duration-300">
                        Create New Team
                      </p>
                    </CardContent>
                  </Card>
                </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Team'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {teams.length === 0 && !canCreateTeams && (
          <Card className="mt-4 border-primary/50">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                You haven't been invited to any teams yet. Contact your administrator to be added to a team.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
