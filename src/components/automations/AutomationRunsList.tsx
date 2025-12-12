import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export function AutomationRunsList({ teamId }: { teamId: string }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["automation-runs", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading automation runs…</CardContent>
      </Card>
    );
  }

  if (!runs.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No automation runs yet. Runs will appear here when automations trigger.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Recent Automation Runs</CardTitle>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Timestamp</TableHead>
              <TableHead>Automation</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {runs.map((run) => (
              <Collapsible key={run.id} asChild open={expandedRows.has(run.id)}>
                <>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(run.id)}>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expandedRows.has(run.id) ? "rotate-180" : ""}`}
                        />
                      </CollapsibleTrigger>
                    </TableCell>

                    <TableCell className="font-mono text-sm">
                      {format(new Date(run.created_at), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>

                    <TableCell>
                      {run.automation_id ? (
                        <span className="text-xs font-mono">{run.automation_id.slice(0, 8)}…</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Inline Automation</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {run.trigger_type}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={run.status === "success" ? "default" : "destructive"}>{run.status}</Badge>
                    </TableCell>
                  </TableRow>

                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="p-4">
                        <pre className="text-xs bg-muted p-2 rounded border overflow-auto max-h-64">
                          {JSON.stringify(run.steps_executed, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
