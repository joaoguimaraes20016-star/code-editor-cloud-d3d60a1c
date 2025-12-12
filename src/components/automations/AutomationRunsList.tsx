import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function safeJson(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v);
  }
}

export default function AutomationRunsList({ teamId }: { teamId: string }) {
  const [rows, setRows] = useState<AutomationRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("automation_runs")
      .select(
        "id, team_id, automation_id, trigger_type, status, error_message, steps_executed, context_snapshot, created_at",
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("AutomationRunsList load error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as AutomationRunRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!teamId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const displayRows = useMemo(() => rows ?? [], [rows]);

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Automation History</CardTitle>
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </CardHeader>

      <CardContent>
        {displayRows.length === 0 ? (
          <div className="text-sm text-white/60">
            No runs found for this team.
            <div className="mt-2 text-xs text-white/40">
              If Messages is logging but this is empty, your edge function is not inserting into{" "}
              <code>public.automation_runs</code> (next step).
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {displayRows.map((r) => {
              const open = !!expanded[r.id];
              return (
                <div key={r.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs rounded-full bg-white/10 px-2 py-1">{r.trigger_type}</span>
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        r.status === "success"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : r.status === "error"
                            ? "bg-red-500/20 text-red-200"
                            : "bg-white/10 text-white/80"
                      }`}
                    >
                      {r.status}
                    </span>

                    <span className="text-xs text-white/50">{new Date(r.created_at).toLocaleString()}</span>

                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                      >
                        {open ? "Hide" : "View"} details
                      </Button>
                    </div>
                  </div>

                  {r.error_message ? <div className="mt-2 text-xs text-red-200/90">{r.error_message}</div> : null}

                  {open ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs text-white/50">steps_executed</div>
                        <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-2 text-xs text-white/80">
                          {safeJson(r.steps_executed)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-white/50">context_snapshot</div>
                        <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-2 text-xs text-white/80">
                          {safeJson(r.context_snapshot)}
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
