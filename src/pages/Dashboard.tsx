// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Users,
  TrendingUp,
  Trash2,
  FolderKey,
  Layers,
  BarChart3,
  MessageSquare,
  Settings,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { runSampleAutomationDev } from "@/lib/automations/devRunner";

interface Team {
  id: string;
  name: string;
  created_at: string;
  logo_url?: string;
}

interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [canCreateTeams, setCanCreateTeams] = useState(false);
  const [isGrowthOperator, setIsGrowthOperator] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    loadTeams();
    checkUserRole();
    loadUserProfile();

    const channel = supabase
      .channel("team-membership-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTeams();
          checkUserRole();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error loading profile", error);
      return;
    }

    setUserProfile(data);
  };

  const loadTeams = async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("team_members")
      .select(
        `
        team:teams (
          id,
          name,
          created_at,
          logo_url
        )
      `,
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Error loading teams", error);
      toast({
        title: "Could not load teams",
        description: "There was an error loading your teams.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const mappedTeams: Team[] =
      data?.map((row: any) => ({
        id: row.team.id,
        name: row.team.name,
        created_at: row.team.created_at,
        logo_url: row.team.logo_url ?? undefined,
      })) ?? [];

    setTeams(mappedTeams);
    setLoading(false);
  };

  const checkUserRole = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error checking user role", error);
      return;
    }

    const roles = data?.map((r: any) => r.role) ?? [];

    setCanCreateTeams(
      roles.includes("owner") || roles.includes("admin") || roles.includes("growth_operator"),
    );
    setIsGrowthOperator(roles.includes("growth_operator"));
  };

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;

    setCreating(true);

    const { data, error } = await supabase
      .from("teams")
      .insert({
        name: newTeamName.trim(),
        created_by: user.id,
      })
      .select("id, name, created_at, logo_url")
      .single();

    if (error) {
      console.error("Error creating team", error);
      toast({
        title: "Could not create team",
        description: error.message,
        variant: "destructive",
      });
      setCreating(false);
      return;
    }

    const team: Team = {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      logo_url: data.logo_url ?? undefined,
    };

    await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: user.id,
      role: "owner",
    });

    setTeams((prev) => [...prev, team]);
    setNewTeamName("");
    setCreating(false);
    setDialogOpen(false);

    toast({
      title: "Team created",
      description: `"${team.name}" has been created.`,
    });
  };

  const handleEnterTeam = (teamId: string) => {
    navigate(`/teams/${teamId}`);
  };

  const handleDeleteTeam = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);

    if (error) {
      console.error("Error deleting team", error);
      toast({
        title: "Could not delete team",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setTeams((prev) => prev.filter((t) => t.id !== teamId));

    toast({
      title: "Team deleted",
      description: "The team has been removed.",
    });
  };

  const handleRunTestAutomation = async () => {
    try {
      await runSampleAutomationDev();
      toast({
        title: "Automation engine ran",
        description: "Check the browser console to see the test workflow steps.",
      });
    } catch (err: any) {
      console.error("Error running test automation", err);
      toast({
        title: "Automation error",
        description: "There was a problem running the test automation.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const firstName =
    userProfile?.full_name?.split(" ")[0] ??
    (user?.email ? user.email.split("@")[0] : "there");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-7" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-50">
                grwth-op
              </span>
              <span className="text-xs text-slate-400">
                Operator cockpit for your sales org
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
              onClick={handleRunTestAutomation}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Test automation engine</span>
            </Button>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium text-slate-200">
                  {userProfile?.full_name ?? user?.email ?? "User"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isGrowthOperator ? "Growth Operator" : "Member"}
                </div>
              </div>
              <Avatar className="h-8 w-8 border border-slate-700/70">
                {userProfile?.avatar_url ? (
                  <AvatarImage src={userProfile.avatar_url} alt={userProfile.full_name ?? ""} />
                ) : (
                  <AvatarFallback className="bg-slate-800 text-xs text-slate-200">
                    {firstName?.[0]?.toUpperCase() ?? "G"}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
              Welcome, {firstName}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Spin up teams, connect funnels, and plug in automations. Your op
              layer for calls, chats, and deals.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
              <div className="flex h-1.5 w-1.5 items-center justify-center">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs font-medium text-emerald-200">
                Engine connected
              </span>
              <span className="text-[10px] text-emerald-300/70">
                Test via the button above
              </span>
            </div>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-slate-800/70 bg-slate-950/60 shadow-sm shadow-slate-950/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-100">
                Teams
              </CardTitle>
              <Users className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                You&apos;re currently part of{" "}
                <span className="font-semibold text-slate-100">
                  {teams.length}
                </span>{" "}
                team{teams.length === 1 ? "" : "s"}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/schedule")}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/sales")}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Sales dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/workflows")}
                >
                  <FolderKey className="h-3.5 w-3.5" />
                  Workflows
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-slate-950/60 shadow-sm shadow-slate-950/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-100">
                Messaging &amp; Hub
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                Centralize DMs, Discord-style team chat, and WhatsApp-style
                threads for your sales org.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/team-hub")}
                >
                  <Users className="h-3.5 w-3.5" />
                  Team Hub
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/team-chat")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Team Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-slate-950/60 shadow-sm shadow-slate-950/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-100">
                Settings &amp; Ops
              </CardTitle>
              <Settings className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                Manage Twilio, email providers, power dialers, and workspace
                permissions.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/team-settings")}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Team settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 bg-slate-900/80 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => navigate("/personal-settings")}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Personal settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-slate-100">Your teams</h2>
              <p className="text-xs text-slate-400">
                Switch between teams or spin up a new org.
              </p>
            </div>

            {canCreateTeams && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-2 bg-slate-50 text-[11px] font-semibold text-slate-950 hover:bg-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New team
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-slate-800 bg-slate-950 text-slate-50">
                  <DialogHeader>
                    <DialogTitle>Create a new team</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="team-name">Team name</Label>
                      <Input
                        id="team-name"
                        placeholder="e.g. Agency Sales Pod"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full bg-slate-50 text-slate-950 hover:bg-slate-200"
                      onClick={handleCreateTeam}
                      disabled={!newTeamName.trim() || creating}
                    >
                      {creating ? "Creating..." : "Create team"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {loading ? (
              <div className="col-span-3 flex items-center justify-center py-10 text-xs text-slate-500">
                Loading teams...
              </div>
            ) : teams.length === 0 ? (
              <Card className="col-span-3 border-dashed border-slate-800/70 bg-slate-950/40 text-center">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-100">
                    No teams yet
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Create your first team to start plugging in funnels,
                    automations, and pipelines.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canCreateTeams ? (
                    <Button
                      className="gap-2 bg-slate-50 text-slate-950 hover:bg-slate-200"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create your first team
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      You don't have permission to create teams. Ask your operator for access.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              teams.map((team) => (
                <Card
                  key={team.id}
                  className="cursor-pointer border-slate-800/70 bg-slate-950/60 transition-colors hover:border-slate-700"
                  onClick={() => handleEnterTeam(team.id)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="h-8 w-8 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold text-slate-200">
                          {team.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-sm font-medium text-slate-100">
                          {team.name}
                        </CardTitle>
                        <p className="text-[11px] text-slate-400">
                          Created {new Date(team.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-slate-800 bg-slate-950 text-slate-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete team?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This will permanently delete "{team.name}" and all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
