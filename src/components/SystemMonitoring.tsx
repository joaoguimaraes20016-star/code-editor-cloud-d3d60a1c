import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, RefreshCw, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SystemMonitoringProps {
  teamId: string;
}

interface HealthStatus {
  database: boolean;
  triggers: boolean;
  webhooks: boolean;
  recentErrors: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  error_context: any;
}

export function SystemMonitoring({ teamId }: SystemMonitoringProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHealthStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('health-check', {
        body: { teamId }
      });

      if (error) throw error;
      setHealth(data);
    } catch (error: any) {
      toast.error('Failed to load health status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentErrors = async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('error_logs')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setErrors(data);
  };

  useEffect(() => {
    loadHealthStatus();
    loadRecentErrors();
    
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      loadHealthStatus();
      loadRecentErrors();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [teamId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      degraded: 'secondary',
      unhealthy: 'destructive'
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle>System Health</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadHealthStatus();
                loadRecentErrors();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>Real-time system status and monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {health && (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(health.status)}
                  <div>
                    <p className="font-semibold">Overall Status</p>
                    <p className="text-sm text-muted-foreground">System operational status</p>
                  </div>
                </div>
                {getStatusBadge(health.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Database</p>
                    {health.database ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {health.database ? 'Connected' : 'Disconnected'}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Triggers</p>
                    {health.triggers ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {health.triggers ? 'Active' : 'Inactive'}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Webhooks</p>
                    {health.webhooks ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {health.webhooks ? 'Configured' : 'Not configured'}
                  </p>
                </div>
              </div>

              {health.recentErrors > 0 && (
                <div className="p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <p className="text-sm font-medium">
                      {health.recentErrors} error{health.recentErrors !== 1 ? 's' : ''} in the last hour
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
            <CardDescription>Last 10 errors from the past hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {errors.map((error) => (
                  <div key={error.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <Badge variant="secondary">{error.error_type}</Badge>
                        <p className="text-sm font-medium">{error.error_message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(error.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {error.error_context && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(error.error_context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}