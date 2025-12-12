import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AutomationRunRow = {
  id: string;
  team_id: string;
  automation_id: string | null;
  trigger_type: string;
  status: "success" | "error" | string;
  error_message: string | null;
  steps_executed: any;
  context_snapshot: any;
  created_at: string;
};

function pretty(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default function AutomationRunsList({ teamId }: { teamId: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AutomationRunRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchRuns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) setRows((data ?? []) as AutomationRunRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!teamId) return;
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const items = useMemo(() => rows, [rows]);

  return (
    <Card className="border-white/10 bg-[#0B1220]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Automation History</CardTitle>

        <Button
          variant="secondary"
          className="bg-white/10 text-white hover:bg-white/15"
          onClick={fetchRuns}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-sm text-white/60">Loading runs…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-white/60">No runs yet for this team.</div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const ok = String(r.status).toLowerCase() === "success";
              const label = r.automation_id ? "Saved Automation" : "Inline Automation";

              return (
                <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-white/10 text-white">{label}</Badge>
                      <Badge className="bg-white/10 text-white">{r.trigger_type}</Badge>
                      <Badge className={ok ? "bg-emerald-600/20 text-emerald-200" : "bg-red-600/20 text-red-200"}>
                        {ok ? "success" : "error"}
                      </Badge>
                      <span className="text-xs text-white/50">{new Date(r.created_at).toLocaleString()}</span>
                    </div>

                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                      onClick={() => toggleExpanded(r.id)}
                    >
                      {expanded[r.id] ? "Hide details" : "View details"}
                    </Button>
                  </div>

                  {!ok && r.error_message ? <div className="mt-2 text-sm text-red-200">{r.error_message}</div> : null}

                  {expanded[r.id] ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs text-white/60">steps_executed</div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-black/40 p-2 text-xs text-white/80">
                          {pretty(r.steps_executed)}
                        </pre>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-white/60">context_snapshot</div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-black/40 p-2 text-xs text-white/80">
                          {pretty(r.context_snapshot)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
