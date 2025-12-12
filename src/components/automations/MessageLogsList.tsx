import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, ChevronDown, ChevronRight, Phone, Mail, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface MessageLog {
  id: string;
  team_id: string;
  automation_id: string | null;
  run_id: string | null;
  channel: string;
  provider: string;
  to_address: string;
  from_address: string | null;
  template: string | null;
  payload: Record<string, any>;
  status: string;
  error_message: string | null;
  created_at: string;
  automation?: { name: string } | null;
}

interface MessageLogsListProps {
  teamId: string;
}

export function MessageLogsList({ teamId }: MessageLogsListProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: logs, isLoading } = useQuery({
    queryKey: ['message-logs', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_logs')
        .select(`
          *,
          automation:automations(name)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as MessageLog[];
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'queued':
        return <Badge variant="secondary">Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading message logs...</div>
        </CardContent>
      </Card>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message Logs
          </CardTitle>
          <CardDescription>SMS and email messages sent by automations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No messages sent yet</p>
            <p className="text-sm">Messages will appear here when automations send SMS or emails</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message Logs
        </CardTitle>
        <CardDescription>Last 50 SMS and email messages sent by automations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {logs.map((log) => {
          const isExpanded = expandedRows.has(log.id);

          return (
            <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleRow(log.id)}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <div className="text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getChannelIcon(log.channel)}
                      <span className="text-xs uppercase font-medium">{log.channel}</span>
                    </div>

                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{log.to_address}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.automation?.name || `Automation ${log.automation_id?.slice(0, 8) || 'N/A'}`}
                      </div>
                    </div>

                    <Badge variant="outline" className="text-xs">
                      {log.provider}
                    </Badge>

                    {getStatusBadge(log.status)}

                    <div className="text-xs text-muted-foreground w-32 text-right">
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t p-3 bg-muted/30 space-y-3">
                    {log.template && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Template</div>
                        <div className="text-sm bg-background p-2 rounded border">{log.template}</div>
                      </div>
                    )}

                    {log.error_message && (
                      <div>
                        <div className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Error
                        </div>
                        <div className="text-sm bg-destructive/10 text-destructive p-2 rounded border border-destructive/20">
                          {log.error_message}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Payload</div>
                      <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>

                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {log.run_id && (
                        <span>Run ID: {log.run_id.slice(0, 8)}...</span>
                      )}
                      {log.automation_id && (
                        <span>Automation ID: {log.automation_id.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
