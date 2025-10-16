import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      navigate('/auth');
      return;
    }
    loadTeams();
    checkUserRole();
  }, [user, navigate]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setCanCreateTeams(data?.role === 'super_admin');
    } catch (error: any) {
      console.error('Error checking user role:', error);
      setCanCreateTeams(false);
    }
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
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">GRWTH Dashboard</h1>
            <p className="text-muted-foreground">Select a team to get started</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/team/${team.id}`)}
            >
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
                <CardDescription>Click to view team data</CardDescription>
              </CardHeader>
            </Card>
          ))}

          {canCreateTeams && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:border-primary transition-colors border-dashed">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[120px]">
                    <Plus className="h-12 w-12 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Create New Team</p>
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
          <Card className="mt-4">
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
