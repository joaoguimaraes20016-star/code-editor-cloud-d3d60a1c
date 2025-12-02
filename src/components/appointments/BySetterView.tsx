import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCard } from "./AppointmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TodaysDashboard } from "./TodaysDashboard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Status-based stages for setter view
const SETTER_STAGES = [
  { id: 'upcoming', stage_id: 'upcoming', stage_label: 'Upcoming', stage_color: 'hsl(var(--primary))' },
  { id: 'confirmed', stage_id: 'confirmed', stage_label: 'Confirmed', stage_color: '#22c55e' },
  { id: 'showed', stage_id: 'showed', stage_label: 'Showed', stage_color: '#3b82f6' },
  { id: 'no_show', stage_id: 'no_show', stage_label: 'No-Show', stage_color: '#ef4444' },
  { id: 'cancelled', stage_id: 'cancelled', stage_label: 'Cancelled', stage_color: '#6b7280' },
];

export function BySetterView({ teamId }: BySetterViewProps) {
  const [loading, setLoading] = useState(true);
  const [setterGroups, setSetterGroups] = useState<SetterGroup[]>([]);
  const [selectedSetter, setSelectedSetter] = useState<string | null>(null);
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);

  useEffect(() => {
    loadSetterGroups();
  }, [teamId]);

  const loadSetterGroups = async () => {
    try {
      setLoading(true);

      // Get all appointments with setters assigned (filter out NULL setter_id)
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .not('setter_id', 'is', null)
        .not('setter_name', 'is', null);

      if (error) throw error;

      // Sort appointments: upcoming first (ascending), then past (descending)
      const now = new Date();
      const nowTime = now.getTime();
      
      appointments?.sort((a, b) => {
        const aTime = new Date(a.start_at_utc).getTime();
        const bTime = new Date(b.start_at_utc).getTime();
        
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
        // Sort appointments within each setter's group
        const nowTime = new Date().getTime();
        const sortedApts = apts.sort((a, b) => {
          const aTime = new Date(a.start_at_utc).getTime();
          const bTime = new Date(b.start_at_utc).getTime();
          
          const aIsFuture = aTime >= nowTime;
          const bIsFuture = bTime >= nowTime;
          
          if (aIsFuture && bIsFuture) return aTime - bTime;
          if (!aIsFuture && !bIsFuture) return bTime - aTime;
          return aIsFuture ? -1 : 1;
        });
        
        const confirmed = sortedApts.filter(a => a.status === 'confirmed' || a.status === 'showed' || a.status === 'no-show').length;
        const showed = sortedApts.filter(a => a.status === 'showed' || (a.cc_collected && a.cc_collected > 0)).length;
        const noShow = sortedApts.filter(a => a.status === 'no-show').length;
        const showRate = confirmed > 0 ? Math.round((showed / confirmed) * 100) : 0;

        return {
          setterId,
          setterName: sortedApts[0].setter_name || 'Unknown',
          appointments: sortedApts,
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

  // Group appointments by status for current setter
  const appointmentsByStage = useMemo(() => {
    const currentGroup = setterGroups.find(g => g.setterId === selectedSetter);
    if (!currentGroup) return {};
    
    const now = new Date().getTime();
    const grouped: Record<string, any[]> = {
      upcoming: [],
      confirmed: [],
      showed: [],
      no_show: [],
      cancelled: [],
    };
    
    currentGroup.appointments.forEach(apt => {
      const aptTime = new Date(apt.start_at_utc).getTime();
      const isFuture = aptTime >= now;
      const status = apt.status?.toLowerCase();
      
      if (status === 'no_show' || status === 'no-show') {
        grouped.no_show.push(apt);
      } else if (status === 'cancelled' || status === 'canceled') {
        grouped.cancelled.push(apt);
      } else if (status === 'showed' || status === 'closed') {
        grouped.showed.push(apt);
      } else if (status === 'confirmed') {
        grouped.confirmed.push(apt);
      } else if (isFuture) {
        grouped.upcoming.push(apt);
      } else {
        // Past appointments without clear status go to upcoming
        grouped.upcoming.push(apt);
      }
    });
    
    return grouped;
  }, [setterGroups, selectedSetter]);

  const selectedStage = SETTER_STAGES[selectedStageIndex];
  const mobileStageAppointments = appointmentsByStage[selectedStage.stage_id] || [];

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
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 rounded-lg md:rounded-xl p-3 md:p-6 border border-primary/30">
        <h3 className="text-base md:text-xl font-bold">By Setter View</h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">See all appointments grouped by setter</p>
      </div>

      <Tabs value={selectedSetter || undefined} onValueChange={setSelectedSetter}>
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-auto p-1 md:p-2 flex-wrap gap-1 md:gap-2">
            {setterGroups.map(group => (
              <TabsTrigger 
                key={group.setterId} 
                value={group.setterId}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm data-[state=active]:bg-primary"
              >
                <Avatar className="h-4 w-4 md:h-6 md:w-6">
                  <AvatarFallback className="text-[10px] md:text-xs bg-accent/10">
                    {group.setterName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[60px] md:max-w-none truncate">{group.setterName}</span>
                <Badge variant="secondary" className="ml-0.5 md:ml-1 text-[10px] md:text-xs px-1 md:px-1.5 py-0">
                  {group.stats.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {setterGroups.map(group => (
          <TabsContent key={group.setterId} value={group.setterId} className="mt-4 md:mt-6">
            {/* Today's Tasks for this Setter */}
            <div className="mb-4 md:mb-8">
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Today's Tasks - {group.setterName}</h3>
              <TodaysDashboard 
                teamId={teamId} 
                userRole="setter"
                viewingAsSetterId={group.setterId}
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-1.5 md:gap-4 mb-4 md:mb-6">
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Total</p>
                <p className="text-sm md:text-2xl font-bold">{group.stats.total}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Confirmed</p>
                <p className="text-sm md:text-2xl font-bold">{group.stats.confirmed}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Showed</p>
                <p className="text-sm md:text-2xl font-bold text-green-600">{group.stats.showed}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">No-Show</p>
                <p className="text-sm md:text-2xl font-bold text-red-600">{group.stats.noShow}</p>
              </Card>
              <Card className="p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground">Show Rate</p>
                <p className="text-sm md:text-2xl font-bold">{group.stats.showRate}%</p>
              </Card>
            </div>

            {/* Mobile Pipeline View */}
            <div className="md:hidden">
              <h3 className="text-sm font-semibold mb-2">All Appointments</h3>
              
              {/* Stage Selector - compact app-like tabs */}
              <div className="flex items-center gap-1 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setSelectedStageIndex(prev => Math.max(0, prev - 1))}
                  disabled={selectedStageIndex === 0}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>

                <ScrollArea className="flex-1">
                  <div className="flex gap-1 pb-0.5">
                    {SETTER_STAGES.map((stage, index) => {
                      const count = appointmentsByStage[stage.stage_id]?.length || 0;
                      const isSelected = index === selectedStageIndex;
                      
                      return (
                        <button
                          key={stage.id}
                          onClick={() => setSelectedStageIndex(index)}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all shrink-0",
                            isSelected
                              ? "text-white shadow-sm"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                          style={isSelected ? {
                            backgroundColor: stage.stage_color,
                          } : undefined}
                        >
                          <span className="truncate max-w-[60px]">{stage.stage_label}</span>
                          <span className={cn(
                            "text-[9px] font-bold",
                            isSelected ? "opacity-80" : "opacity-60"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setSelectedStageIndex(prev => Math.min(SETTER_STAGES.length - 1, prev + 1))}
                  disabled={selectedStageIndex === SETTER_STAGES.length - 1}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

              {/* Stage Header - minimal */}
              <div 
                className="mb-2 px-2 py-1.5 rounded-lg border-l-2"
                style={{ 
                  borderLeftColor: selectedStage.stage_color,
                  backgroundColor: `${selectedStage.stage_color}10`
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px]">{selectedStage.stage_label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {mobileStageAppointments.length} {mobileStageAppointments.length === 1 ? 'appointment' : 'appointments'}
                  </span>
                </div>
              </div>

              {/* Appointments List */}
              <div className="space-y-2 pb-3">
                {mobileStageAppointments.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground">
                    No appointments in this stage
                  </div>
                ) : (
                  mobileStageAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onViewDetails={() => {}}
                    />
                  ))
                )}
              </div>

              {/* Quick stage navigation dots */}
              <div className="flex justify-center gap-1 pt-1.5 pb-0.5">
                {SETTER_STAGES.map((stage, index) => (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStageIndex(index)}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      index === selectedStageIndex
                        ? "bg-primary w-3"
                        : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                    )}
                    aria-label={`Go to ${stage.stage_label}`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop List View */}
            <div className="hidden md:block">
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
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
