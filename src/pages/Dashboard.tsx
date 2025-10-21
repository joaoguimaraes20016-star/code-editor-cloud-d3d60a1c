import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, TrendingUp, Trash2, FolderKey, DollarSign, Calendar, BarChart3, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
  const [isGrowthOperator, setIsGrowthOperator] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadTeams();
    checkUserRole();

    // Subscribe to team membership changes
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
          // Reload teams and check role when membership changes
          loadTeams();
          checkUserRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const checkUserRole = async () => {
    if (!user) return;
    
    // Check both user_roles table and profiles table for creator status
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
    
    console.log('=== USER ROLE CHECK ===');
    console.log('User ID:', user.id);
    console.log('User Email:', user.email);
    console.log('User Role from user_roles:', userRole?.role);
    console.log('Account Type from profiles:', profile?.account_type);
    
    const isCreator = userRole?.role === 'creator' || profile?.account_type === 'creator';
    console.log('Is Creator?', isCreator);
    console.log('=====================');
    
    setCanCreateTeams(isCreator);
    setIsGrowthOperator(isCreator);
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
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent" style={{
                  filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4)) drop-shadow(0 2px 4px rgba(212, 175, 55, 0.2))'
                }}>
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
        
        {/* Welcome Section */}
        <div className="animate-fade-in space-y-2">
          <h2 className="text-3xl font-bold">Welcome back!</h2>
          <p className="text-muted-foreground text-lg">Choose a workspace to get started with your operations</p>
        </div>

        {/* Client Management Section - Only show if user is a growth operator */}
        {isGrowthOperator && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Client Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage client information and onboarding workflows
                </p>
              </div>
            </div>
            
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Onboard New Client Card */}
              <Card
                className="group hover:border-primary hover:shadow-glow transition-all duration-300 cursor-pointer bg-gradient-card backdrop-blur-sm border-2 border-primary/50"
                onClick={() => navigate('/client-assets?tab=onboard')}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Onboard New Client
                      </CardTitle>
                      <CardDescription className="text-base">
                        Create secure onboarding forms and send unique links to new clients
                      </CardDescription>
                    </div>
                    <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-primary/10 rounded">Custom Forms</span>
                    <span className="px-2 py-1 bg-primary/10 rounded">Share Links</span>
                    <span className="px-2 py-1 bg-primary/10 rounded">Track Progress</span>
                  </div>
                </CardContent>
              </Card>

              {/* Client Assets Card */}
              <Card
                className="group hover:border-primary hover:shadow-glow transition-all duration-300 cursor-pointer bg-gradient-card backdrop-blur-sm border-2 border-primary/50"
                onClick={() => navigate('/client-assets')}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                        <FolderKey className="h-5 w-5" />
                        Client Assets
                      </CardTitle>
                      <CardDescription className="text-base">
                        View and manage existing client information and credentials
                      </CardDescription>
                    </div>
                    <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-primary/10 rounded">View Assets</span>
                    <span className="px-2 py-1 bg-primary/10 rounded">Manage Data</span>
                    <span className="px-2 py-1 bg-primary/10 rounded">Download Files</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Client Information Section - Always show for non-creators */}
        {!isGrowthOperator && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">My Information</h3>
                <p className="text-sm text-muted-foreground">
                  View and update your onboarding information
                </p>
              </div>
            </div>
            
            <Card
              className="group hover:border-primary hover:shadow-glow transition-all duration-300 cursor-pointer bg-gradient-card backdrop-blur-sm border-2 border-primary/50"
              onClick={() => navigate('/client-assets')}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                      <FolderKey className="h-5 w-5" />
                      My Profile & Assets
                    </CardTitle>
                    <CardDescription className="text-base">
                      Manage your onboarding information, track your progress, and update your details
                    </CardDescription>
                  </div>
                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-primary/10 rounded">Profile Info</span>
                  <span className="px-2 py-1 bg-primary/10 rounded">Track Progress</span>
                  <span className="px-2 py-1 bg-primary/10 rounded">Update Details</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {(isGrowthOperator || teams.length > 0) && <Separator className="my-8" />}

        {/* Sales Teams Section - Only show if user has teams */}
        {teams.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Sales Teams</h3>
              <p className="text-sm text-muted-foreground">Track performance, manage appointments, and monitor commissions</p>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{/* Team Cards Container */}
            {teams.map((team, index) => (
              <Card
                key={team.id}
                className="group hover:border-primary hover:shadow-glow transition-all duration-300 cursor-pointer bg-gradient-card backdrop-blur-sm border-2 border-primary/50"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(`/team/${team.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {team.name}
                        </CardTitle>
                      </div>
                      <CardDescription>
                        View sales metrics, appointments, and team performance
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        →
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-primary/10 rounded flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Revenue Tracking
                    </span>
                    <span className="px-2 py-1 bg-primary/10 rounded flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Appointments
                    </span>
                    <span className="px-2 py-1 bg-primary/10 rounded flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Leaderboards
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {canCreateTeams && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Card className="group cursor-pointer hover:border-primary hover:shadow-glow transition-all duration-300 border-dashed border-2 border-primary/50 bg-gradient-card backdrop-blur-sm">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] py-8">
                    <div className="p-3 bg-primary/10 rounded-full mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      Create New Team
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a new sales team workspace
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
            <Card className="border-primary/50 bg-muted/50">
              <CardContent className="py-8 text-center space-y-2">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No Teams Yet</p>
                <p className="text-muted-foreground">
                  You haven't been invited to any sales teams. Contact your administrator to be added to a team.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* Empty state when user has no teams and is not a growth operator */}
        {teams.length === 0 && !isGrowthOperator && (
          <Card className="border-primary/50 bg-muted/50">
            <CardContent className="py-12 text-center space-y-2">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No Information or Teams Yet</p>
              <p className="text-muted-foreground">
                You haven't been added to any teams yet. Contact your administrator to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
