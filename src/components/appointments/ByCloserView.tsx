import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealCard } from "./DealCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ByCloserViewProps {
  teamId: string;
}

interface CloserGroup {
  closerId: string;
  closerName: string;
  appointments: any[];
  stats: {
    total: number;
    inPipeline: number;
    closed: number;
    revenue: number;
  };
}

export function ByCloserView({ teamId }: ByCloserViewProps) {
  const [loading, setLoading] = useState(true);
  const [closerGroups, setCloserGroups] = useState<CloserGroup[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);

  useEffect(() => {
    loadCloserGroups();
  }, [teamId]);

  const loadCloserGroups = async () => {
    try {
      setLoading(true);

      // Get all appointments with closers assigned
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('closer_name', 'is', null)
        .order('start_at_utc', { ascending: true });

      if (error) throw error;

      // Group by closer
      const groups = new Map<string, any[]>();
      
      appointments?.forEach(apt => {
        const closerId = apt.closer_id || apt.closer_name;
        if (!groups.has(closerId)) {
          groups.set(closerId, []);
        }
        groups.get(closerId)!.push(apt);
      });

      // Calculate stats for each closer
      const closerData: CloserGroup[] = Array.from(groups.entries()).map(([closerId, apts]) => {
        const inPipeline = apts.filter(a => a.status === 'showed' && (!a.cc_collected || a.cc_collected === 0)).length;
        const closed = apts.filter(a => a.cc_collected && a.cc_collected > 0).length;
        const revenue = apts.reduce((sum, a) => sum + (Number(a.cc_collected) || 0), 0);

        return {
          closerId,
          closerName: apts[0].closer_name || 'Unknown',
          appointments: apts,
          stats: {
            total: apts.length,
            inPipeline,
            closed,
            revenue,
          },
        };
      });

      // Sort by total appointments descending
      closerData.sort((a, b) => b.stats.total - a.stats.total);

      setCloserGroups(closerData);
      if (closerData.length > 0 && !selectedCloser) {
        setSelectedCloser(closerData[0].closerId);
      }
    } catch (error) {
      console.error('Error loading closer groups:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (closerGroups.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No closers with appointments found</p>
      </Card>
    );
  }

  const selectedGroup = closerGroups.find(g => g.closerId === selectedCloser);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-xl p-6 border border-accent/30">
        <h3 className="text-xl font-bold">By Closer View</h3>
        <p className="text-sm text-muted-foreground mt-1">See all deals grouped by closer</p>
      </div>

      <Tabs value={selectedCloser || undefined} onValueChange={setSelectedCloser}>
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-auto p-2 flex-wrap gap-2">
            {closerGroups.map(group => (
              <TabsTrigger 
                key={group.closerId} 
                value={group.closerId}
                className="flex items-center gap-2 data-[state=active]:bg-accent"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {group.closerName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{group.closerName}</span>
                <Badge variant="secondary" className="ml-1">
                  {group.stats.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {closerGroups.map(group => (
          <TabsContent key={group.closerId} value={group.closerId} className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Appointments</p>
                <p className="text-2xl font-bold">{group.stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">In Pipeline</p>
                <p className="text-2xl font-bold">{group.stats.inPipeline}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-green-600">{group.stats.closed}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${group.stats.revenue.toLocaleString()}</p>
              </Card>
            </div>

            {/* Appointments List */}
            <div className="space-y-3">
              {group.appointments.map(appointment => (
                <DealCard
                  key={appointment.id}
                  id={appointment.id}
                  teamId={teamId}
                  appointment={appointment}
                  onCloseDeal={() => {}}
                  onMoveTo={() => {}}
                  userRole="admin"
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
