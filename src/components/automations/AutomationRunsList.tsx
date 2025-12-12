import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";

interface AutomationRunsListProps {
  teamId: string;
}

interface AutomationRun {
  id: string;
  automation_id: string;
  team_id: string;
  trigger_type: string;
  status: string;
  error_message: string | null;
  steps_executed: unknown;
  context_snapshot: unknown;
  created_at: string;
  automation?: {
    name: string;
  } | null;
}

export function AutomationRunsList({ teamId }: AutomationRunsListProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: runs, isLoading } = useQuery({
    queryKey: ["automation-runs", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select(`
          id,
          automation_id,
          team_id,
          trigger_type,
          status,
          error_message,
          steps_executed,
          context_snapshot,
          created_at,
          automation:automations(name)
        `)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AutomationRun[];
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading automation history...
        </CardContent>
      </Card>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No automation runs yet. Runs will appear here when automations are triggered.
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
              <TableHead className="w-[40px]"></TableHead>
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
                          className={`h-4 w-4 transition-transform ${
                            expandedRows.has(run.id) ? "rotate-180" : ""
                          }`}
                        />
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(run.created_at), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      {run.automation?.name || (
                        run.automation_id ? (
                          <span className="text-muted-foreground text-xs font-mono">
                            {run.automation_id.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            Inline Automation
                          </span>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {run.trigger_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="p-4">
                        <div className="space-y-3">
                          {run.error_message && (
                            <div>
                              <p className="text-sm font-medium text-red-600 mb-1">Error Message:</p>
                              <pre className="text-xs bg-red-500/10 p-2 rounded border border-red-500/20 overflow-auto">
                                {run.error_message}
                              </pre>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Steps Executed:</p>
                            <pre className="text-xs bg-muted p-2 rounded border overflow-auto max-h-48">
                              {JSON.stringify(run.steps_executed, null, 2)}
                            </pre>
                          </div>
                        </div>
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
