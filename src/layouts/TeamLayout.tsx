import { useEffect, useState } from "react";
import { useParams, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamSidebar } from "@/components/TeamSidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamLayout() {
  const { teamId } = useParams();
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!teamId) return;
      
      const { data, error } = await supabase
        .from("teams")
        .select("name, logo_url")
        .eq("id", teamId)
        .single();
      
      if (data && !error) {
        setTeamName(data.name);
        setTeamLogo(data.logo_url);
      }
      setLoading(false);
    };

    fetchTeam();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <div className="w-64 h-full bg-sidebar border-r border-sidebar-border p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <TeamSidebar teamName={teamName} teamLogo={teamLogo} />
      <main className="flex-1 overflow-auto">
        <Outlet context={{ teamName, teamLogo }} />
      </main>
    </div>
  );
}
