import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Layers, 
  Users, 
  FileText,
  ExternalLink,
  Play,
  ChevronRight,
  Loader2
} from "lucide-react";

interface TeamContext {
  teamName: string;
  teamLogo: string | null;
}

export function TeamHubOverview() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { role, isAdmin } = useTeamRole(teamId || "");
  const { teamName, teamLogo } = useOutletContext<TeamContext>() || { teamName: "", teamLogo: null };

  // Fetch team stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["team-hub-stats", teamId],
    queryFn: async () => {
      const [membersResult, assetsResult, appointmentsResult] = await Promise.all([
        supabase.from("team_members").select("id", { count: "exact" }).eq("team_id", teamId),
        supabase.from("team_assets").select("id", { count: "exact" }).eq("team_id", teamId),
        supabase.from("appointments").select("id", { count: "exact" }).eq("team_id", teamId).eq("status", "CLOSED"),
      ]);
      
      return {
        members: membersResult.count || 0,
        assets: assetsResult.count || 0,
        closedDeals: appointmentsResult.count || 0,
      };
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch team assets
  const { data: assets, isLoading: loadingAssets } = useQuery({
    queryKey: ["team-hub-assets", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_assets")
        .select("*")
        .eq("team_id", teamId)
        .order("order_index", { ascending: true })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  const quickActions = [
    {
      title: "Sales CRM",
      description: "Pipeline & revenue tracking",
      icon: TrendingUp,
      path: `/team/${teamId}/crm`,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Funnels",
      description: "Lead capture forms",
      icon: Layers,
      path: `/team/${teamId}/funnels`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "video":
        return <Play className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-lg">
            <AvatarImage src={teamLogo || undefined} className="object-cover" />
            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-lg font-semibold">
              {getInitials(teamName || "Team")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{teamName}</h1>
            <p className="text-muted-foreground">Team Overview</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">
          {role || "Member"}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.members}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Assets</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.assets}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed Deals</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.closedDeals}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map((action) => (
          <Card 
            key={action.title}
            className="cursor-pointer transition-all hover:shadow-md border-border/50 hover:border-primary/30"
            onClick={() => navigate(action.path)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Assets */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Assets</CardTitle>
            <CardDescription>Training materials and resources</CardDescription>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/team/${teamId}/settings`)}>
              Manage
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loadingAssets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets && assets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((asset) => (
                <Card 
                  key={asset.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-border/50"
                  onClick={() => {
                    if (asset.loom_url) window.open(asset.loom_url, "_blank");
                    else if (asset.external_url) window.open(asset.external_url, "_blank");
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getCategoryIcon(asset.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-foreground truncate">{asset.title}</h4>
                        {asset.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{asset.description}</p>
                        )}
                        <Badge variant="outline" className="mt-2 text-xs capitalize">
                          {asset.category}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No assets yet</p>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => navigate(`/team/${teamId}/settings`)}
                >
                  Add Assets
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
