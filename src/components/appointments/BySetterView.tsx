import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCard } from "./AppointmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { TodaysDashboard } from "./TodaysDashboard";

interface BySetterViewProps {
  teamId: string;
}

interface SetterGroup {
  setterId: string;
  setterName: string;
  appointments: any[];
  stats: {
    total: number;
    confirmed: number;
    showed: number;
    noShow: number;
    showRate: number;
  };
}

export function BySetterView({ teamId }: BySetterViewProps) {
  const [loading, setLoading] = useState(true);
  const [setterGroups, setSetterGroups] = useState<SetterGroup[]>([]);
  const [selectedSetter, setSelectedSetter] = useState<string | null>(null);

  useEffect(() => {
    loadSetterGroups();
  }, [teamId]);

  const loadSetterGroups = async () => {
    try {
      setLoading(true);

      // Get all appointments with setters assigned
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('setter_id', 'is', null);

      if (error) throw error;

      // Sort appointments: upcoming first (ascending), then past (descending)
      const now = new Date().toISOString();
      appointments?.sort((a, b) => {
        const aTime = new Date(a.start_at_utc).getTime();
        const bTime = new Date(b.start_at_utc).getTime();
        const nowTime = new Date(now).getTime();
        
        const aIsFuture = aTime >= nowTime;
        const bIsFuture = bTime >= nowTime;
        
        // Both future: sort ascending (soonest first)
        if (aIsFuture && bIsFuture) return aTime - bTime;
        
        // Both past: sort descending (most recent first)
        if (!aIsFuture && !bIsFuture) return bTime - aTime;
        
        // One future, one past: future always comes first
        return aIsFuture ? -1 : 1;
      });

      // Group by setter
      const groups = new Map<string, any[]>();
      
      appointments?.forEach(apt => {
        const setterId = apt.setter_id || 'unknown';
        if (!groups.has(setterId)) {
          groups.set(setterId, []);
        }
        groups.get(setterId)!.push(apt);
      });

      // Calculate stats for each setter
      const setterData: SetterGroup[] = Array.from(groups.entries()).map(([setterId, apts]) => {
        const confirmed = apts.filter(a => a.status === 'confirmed' || a.status === 'showed' || a.status === 'no-show').length;
        const showed = apts.filter(a => a.status === 'showed' || (a.cc_collected && a.cc_collected > 0)).length;
        const noShow = apts.filter(a => a.status === 'no-show').length;
        const showRate = confirmed > 0 ? Math.round((showed / confirmed) * 100) : 0;

        return {
          setterId,
          setterName: apts[0].setter_name || 'Unknown',
          appointments: apts,
          stats: {
            total: apts.length,
            confirmed,
            showed,
            noShow,
            showRate,
          },
        };
      });

      // Sort by total appointments descending
      setterData.sort((a, b) => b.stats.total - a.stats.total);

      setSetterGroups(setterData);
      if (setterData.length > 0 && !selectedSetter) {
        setSelectedSetter(setterData[0].setterId);
      }
    } catch (error) {
      console.error('Error loading setter groups:', error);
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

  if (setterGroups.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No setters with appointments found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 rounded-xl p-6 border border-primary/30">
        <h3 className="text-xl font-bold">By Setter View</h3>
        <p className="text-sm text-muted-foreground mt-1">See all appointments grouped by setter</p>
      </div>

      <Tabs value={selectedSetter || undefined} onValueChange={setSelectedSetter}>
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-auto p-2 flex-wrap gap-2">
            {setterGroups.map(group => (
              <TabsTrigger 
                key={group.setterId} 
                value={group.setterId}
                className="flex items-center gap-2 data-[state=active]:bg-primary"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-accent/10">
                    {group.setterName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{group.setterName}</span>
                <Badge variant="secondary" className="ml-1">
                  {group.stats.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {setterGroups.map(group => (
          <TabsContent key={group.setterId} value={group.setterId} className="mt-6">
            {/* Today's Tasks for this Setter */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Today's Tasks - {group.setterName}</h3>
              <TodaysDashboard 
                teamId={teamId} 
                userRole="setter"
                viewingAsSetterId={group.setterId}
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{group.stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold">{group.stats.confirmed}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Showed</p>
                <p className="text-2xl font-bold text-green-600">{group.stats.showed}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">No-Show</p>
                <p className="text-2xl font-bold text-red-600">{group.stats.noShow}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Show Rate</p>
                <p className="text-2xl font-bold">{group.stats.showRate}%</p>
              </Card>
            </div>

            {/* All Appointments List */}
            <h3 className="text-lg font-semibold mb-4">All Appointments</h3>
            <div className="space-y-3">
              {group.appointments.map(appointment => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onViewDetails={() => {}}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
