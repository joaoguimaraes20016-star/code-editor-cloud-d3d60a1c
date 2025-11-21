import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Plus, CheckSquare } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { NewAppointments } from "@/components/NewAppointments";
import { MyClaimed } from "@/components/MyClaimed";
import { AllClaimed } from "@/components/AllClaimed";
import { AllNewAppointments } from "@/components/AllNewAppointments";
import { DealPipeline } from "./DealPipeline";
import { TaskBasedConfirmToday } from "./TaskBasedConfirmToday";
import { OperatorControls } from "./OperatorControls";
import { MRRFollowUps } from "./MRRFollowUps";
import { MRRScheduleList } from "./MRRScheduleList";

import { StageWorkspaceView } from "./StageWorkspaceView";
import { StageWorkspaceList } from "./StageWorkspaceList";
import { InitializeDefaultStages } from "./InitializeDefaultStages";
import { PipelineStageManager } from "./PipelineStageManager";
import { CloseDealDialog } from "@/components/CloseDealDialog";
import { useTabCounts } from "@/hooks/useTabCounts";
import { useAuth } from "@/hooks/useAuth";
import { ByCloserView } from "./ByCloserView";
import { BySetterView } from "./BySetterView";
import { AdminOverview } from "./AdminOverview";
import { SettersView } from "./SettersView";
import { UnifiedTasksView } from "./UnifiedTasksView";
import { TodaysDashboard } from "./TodaysDashboard";
import { SetterEODReport } from "./SetterEODReport";
import { CloserEODReport } from "./CloserEODReport";
import { UnassignedAppointments } from "./UnassignedAppointments";
import { SetterBookingLinks } from "@/components/SetterBookingLinks";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface AppointmentsHubProps {
  teamId: string;
  userRole: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
  onUpdate: () => void;
}

export function AppointmentsHub({
  teamId,
  userRole,
  closerCommissionPct,
  setterCommissionPct,
  onUpdate,
}: AppointmentsHubProps) {
  const { user } = useAuth();
  const counts = useTabCounts(teamId, user?.id || '', userRole);
  const [selectedStage, setSelectedStage] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [adminSelectedStage, setAdminSelectedStage] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showStageManager, setShowStageManager] = useState(false);
  const [dealToClose, setDealToClose] = useState<any>(null);
  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [undoHandlers, setUndoHandlers] = useState<{
    trackAction: (action: { table: string; recordId: string; previousData: Record<string, any>; description: string }) => void;
    showUndoToast: (description: string) => void;
  } | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [teamCalendlySettings, setTeamCalendlySettings] = useState<{
    calendlyEventTypes: string[];
    calendlyAccessToken: string | null;
    calendlyOrgUri: string | null;
  }>({ calendlyEventTypes: [], calendlyAccessToken: null, calendlyOrgUri: null });
  const [loadingCalendlySettings, setLoadingCalendlySettings] = useState(true);
  const [availableEventTypes, setAvailableEventTypes] = useState<any[]>([]);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data?.full_name) setUserName(data.full_name);
    };
    loadUserProfile();
  }, [user?.id]);

  useEffect(() => {
    const loadAppointments = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, lead_name, lead_email, start_at_utc, closer_id")
        .eq("team_id", teamId)
        .order("start_at_utc", { ascending: false })
        .limit(100);
      
      if (data) setAppointments(data);
    };
    
    loadAppointments();
  }, [teamId]);

  const fetchEventTypeDetails = async (accessToken: string, eventTypeUris: string[]) => {
    try {
      console.log('[AppointmentsHub] Fetching event type details for:', eventTypeUris.length, 'URIs');
      const eventTypes = await Promise.all(
        eventTypeUris.map(async (uri) => {
          try {
            const response = await fetch(uri, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!response.ok) {
              console.error(`[AppointmentsHub] Failed to fetch ${uri}:`, response.status);
              return null;
            }
            
            const data = await response.json();
            console.log('[AppointmentsHub] Fetched event type:', data.resource?.name);
            return data.resource;
          } catch (error) {
            console.error(`[AppointmentsHub] Error fetching ${uri}:`, error);
            return null;
          }
        })
      );
      
      const validEventTypes = eventTypes.filter(Boolean);
      console.log('[AppointmentsHub] Valid event types fetched:', validEventTypes.length);
      setAvailableEventTypes(validEventTypes);
    } catch (error) {
      console.error('[AppointmentsHub] Error fetching event type details:', error);
    }
  };

  const loadTeamCalendlySettings = async () => {
    setLoadingCalendlySettings(true);
    try {
      const { data } = await supabase
        .from('teams')
        .select('calendly_event_types, calendly_access_token, calendly_organization_uri')
        .eq('id', teamId)
        .single();
      
      if (data) {
        console.log('[AppointmentsHub] Loaded Calendly settings:', {
          eventTypesCount: data.calendly_event_types?.length || 0,
          hasToken: !!data.calendly_access_token,
          hasOrgUri: !!data.calendly_organization_uri
        });
        setTeamCalendlySettings({
          calendlyEventTypes: data.calendly_event_types || [],
          calendlyAccessToken: data.calendly_access_token,
          calendlyOrgUri: data.calendly_organization_uri,
        });

        // Fetch event type details if Calendly is connected
        if (data.calendly_access_token && data.calendly_event_types?.length > 0) {
          await fetchEventTypeDetails(data.calendly_access_token, data.calendly_event_types);
        }
      }
    } catch (error) {
      console.error('[AppointmentsHub] Error loading Calendly settings:', error);
    } finally {
      setLoadingCalendlySettings(false);
    }
  };

  useEffect(() => {
    loadTeamCalendlySettings();
  }, [teamId]);

  const handleRefreshCalendlySettings = async () => {
    console.log('[AppointmentsHub] Refreshing Calendly settings...');
    setAvailableEventTypes([]);
    await loadTeamCalendlySettings();
  };

  const handleCloseDeal = (
    appointment: any,
    handlers?: {
      trackAction: (action: { table: string; recordId: string; previousData: Record<string, any>; description: string }) => void;
      showUndoToast: (description: string) => void;
    }
  ) => {
    setDealToClose(appointment);
    setShowCloseDealDialog(true);
    if (handlers) {
      setUndoHandlers(handlers);
    }
  };

  const handleCloseDealSuccess = () => {
    setShowCloseDealDialog(false);
    setDealToClose(null);
    onUpdate();
  };
  // Setter sees: Confirm Today, My Appointments, All Assigned, Team Pipeline, MRR Deals, and Retarget
  if (userRole === "setter") {
    return (
      <div className="space-y-6">
        <InitializeDefaultStages teamId={teamId} />
        <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 rounded-xl p-6 border border-primary/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Setter CRM
              </h2>
              <p className="text-muted-foreground mt-1">Manage your daily CRM tasks and view team deals</p>
            </div>
            <Button onClick={() => setShowCreateTask(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="today" className="w-full">
          <div className="w-full overflow-x-auto">
            <TabsList className="w-max min-w-full h-12">
              <TabsTrigger value="today" className="text-sm md:text-base whitespace-nowrap">
                Today
              </TabsTrigger>
              <TabsTrigger value="mine" className="text-sm md:text-base whitespace-nowrap">My Appointments</TabsTrigger>
              <TabsTrigger value="unassigned" className="text-sm md:text-base whitespace-nowrap">
                Unassigned
                {counts.unassigned > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {counts.unassigned}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="text-sm md:text-base whitespace-nowrap">Assigned</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-sm md:text-base whitespace-nowrap">Team Pipeline</TabsTrigger>
              <TabsTrigger value="stats" className="text-sm md:text-base whitespace-nowrap">My Stats</TabsTrigger>
              <TabsTrigger value="mrr" className="text-sm md:text-base whitespace-nowrap">
                MRR {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-sm md:text-base whitespace-nowrap flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
                {counts.totalPendingTasks > 0 && (
                  <Badge variant={counts.overdue > 0 ? "destructive" : "secondary"} className="ml-1">
                    {counts.totalPendingTasks}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="my-assets" className="text-sm md:text-base whitespace-nowrap">My Assets</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="today" className="mt-6">
            <TodaysDashboard teamId={teamId} userRole={userRole} />
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            <MyClaimed
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
            />
          </TabsContent>

          <TabsContent value="unassigned" className="mt-6">
            <UnassignedAppointments
              teamId={teamId}
              onUpdate={onUpdate}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <AllClaimed
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
            />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-6">
            <DealPipeline
              teamId={teamId}
              userRole="setter"
              currentUserId={user?.id || ''}
              onCloseDeal={() => {}}
              viewFilter="all"
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <SetterEODReport
              teamId={teamId}
              userId={user?.id || ''}
              userName={userName || 'Me'}
              date={new Date()}
            />
          </TabsContent>

          <TabsContent value="mrr" className="mt-6">
            <div className="space-y-6">
              <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
              <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <UnifiedTasksView teamId={teamId} />
          </TabsContent>

          <TabsContent value="my-assets" className="mt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">My Booking Link</h3>
                {loadingCalendlySettings ? (
                  <div className="text-sm text-muted-foreground">Loading settings...</div>
                ) : (
                  <SetterBookingLinks
                    teamId={teamId}
                    calendlyEventTypes={teamCalendlySettings.calendlyEventTypes}
                    availableEventTypes={availableEventTypes}
                    calendlyAccessToken={teamCalendlySettings.calendlyAccessToken}
                    calendlyOrgUri={teamCalendlySettings.calendlyOrgUri}
                    onRefresh={handleRefreshCalendlySettings}
                    currentUserId={user?.id}
                    isOwner={false}
                  />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          teamId={teamId}
          appointments={appointments}
          onTaskCreated={() => window.location.reload()}
          userRole={userRole}
          currentUserId={user?.id}
        />
      </div>
    );
  }

  // Closer sees: My Deals, Team Pipeline, MRR Tasks, MRR Deals, and Stage Views
  if (userRole === "closer") {
    return (
      <div className="space-y-6">
        <InitializeDefaultStages teamId={teamId} />
        <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-xl p-6 border border-accent/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Closer CRM
              </h2>
              <p className="text-muted-foreground mt-1">Track and close your deals</p>
            </div>
            <Button onClick={() => setShowCreateTask(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="today" className="w-full">
          <div className="w-full overflow-x-auto">
            <TabsList className="w-max min-w-full h-12">
              <TabsTrigger value="today" className="text-sm md:text-base whitespace-nowrap">
                Today
              </TabsTrigger>
              <TabsTrigger value="mine" className="text-sm md:text-base whitespace-nowrap">My Deals</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-sm md:text-base whitespace-nowrap">My Pipeline</TabsTrigger>
              <TabsTrigger value="all" className="text-sm md:text-base whitespace-nowrap">Team Pipeline</TabsTrigger>
              <TabsTrigger value="stats" className="text-sm md:text-base whitespace-nowrap">My Stats</TabsTrigger>
              <TabsTrigger value="mrr" className="text-sm md:text-base whitespace-nowrap relative">
                MRR
                {counts.mrrDue > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-red-500 hover:bg-red-600 animate-pulse"
                  >
                    {counts.mrrDue}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="stages" className="text-sm md:text-base whitespace-nowrap">Stage Views</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="today" className="mt-6">
            <TodaysDashboard teamId={teamId} userRole={userRole} />
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            <AllClaimed
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
            />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-6">
            <DealPipeline
              teamId={teamId}
              userRole={userRole}
              currentUserId={user?.id || ''}
              onCloseDeal={handleCloseDeal}
              viewFilter="mine"
            />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <DealPipeline
              teamId={teamId}
              userRole={userRole}
              currentUserId={user?.id || ''}
              onCloseDeal={handleCloseDeal}
              viewFilter="all"
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <CloserEODReport
              teamId={teamId}
              userId={user?.id || ''}
              userName={userName || 'Me'}
              date={new Date()}
            />
          </TabsContent>

          <TabsContent value="mrr" className="mt-6">
            <div className="space-y-6">
              {counts.mrrDue > 0 && (
                <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive rounded-full">
                      <Calendar className="h-5 w-5 text-destructive-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-destructive">⚠️ MRR Payment Action Required</h3>
                      <p className="text-sm text-muted-foreground">
                        {counts.mrrDue} payment{counts.mrrDue !== 1 ? 's' : ''} due today
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
              <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
            </div>
          </TabsContent>

          <TabsContent value="stages" className="mt-6">
            {selectedStage ? (
              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedStage(null)}
                >
                  ← Back to All Stages
                </Button>
                <StageWorkspaceView 
                  teamId={teamId} 
                  stageId={selectedStage.id} 
                  stageName={selectedStage.name}
                  stageColor={selectedStage.color}
                />
              </div>
            ) : (
              <StageWorkspaceList 
                teamId={teamId} 
                onSelectStage={(id, name, color) => setSelectedStage({ id, name, color })}
              />
            )}
          </TabsContent>
        </Tabs>

        <CloseDealDialog
          appointment={dealToClose}
          teamId={teamId}
          open={showCloseDealDialog}
          onOpenChange={setShowCloseDealDialog}
          onSuccess={handleCloseDealSuccess}
          closerCommissionPct={closerCommissionPct}
          setterCommissionPct={setterCommissionPct}
          onTrackUndo={undoHandlers?.trackAction}
          onShowUndoToast={undoHandlers?.showUndoToast}
        />

        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          teamId={teamId}
          appointments={appointments}
          onTaskCreated={() => window.location.reload()}
          userRole={userRole}
          currentUserId={user?.id}
        />
      </div>
    );
  }

  // Admin sees: Overview, Team Pipeline, Setters View, Closers View, MRR Deals, and Tasks
  return (
    <div className="space-y-6">
      <InitializeDefaultStages teamId={teamId} />
      <div className="bg-gradient-to-br from-primary/15 via-accent/15 to-primary/10 rounded-xl p-6 border border-primary/40 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Admin CRM
            </h2>
            <p className="text-muted-foreground mt-1">Comprehensive team performance & management</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowStageManager(true)}
          >
            Manage Pipeline Stages
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="today" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-12">
            <TabsTrigger value="today" className="text-sm md:text-base whitespace-nowrap">
              Today
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-sm md:text-base whitespace-nowrap">
              Overview
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-sm md:text-base whitespace-nowrap">
              Team Pipeline
            </TabsTrigger>
            <TabsTrigger value="setters" className="text-sm md:text-base whitespace-nowrap">
              Setters View
            </TabsTrigger>
            <TabsTrigger value="closers" className="text-sm md:text-base whitespace-nowrap">
              Closers View
            </TabsTrigger>
            <TabsTrigger value="mrr" className="text-sm md:text-base whitespace-nowrap">
              MRR {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm md:text-base whitespace-nowrap">
              Tasks
              {counts.totalPendingTasks > 0 && (
                <Badge 
                  variant={counts.overdue > 0 ? "destructive" : "secondary"}
                  className="ml-2"
                >
                  {counts.totalPendingTasks}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="today" className="mt-6">
          <TodaysDashboard teamId={teamId} userRole={userRole} />
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <AdminOverview teamId={teamId} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <DealPipeline
            teamId={teamId}
            userRole={userRole}
            currentUserId={user?.id || ''}
            onCloseDeal={handleCloseDeal}
            viewFilter="all"
          />
        </TabsContent>

        <TabsContent value="setters" className="mt-6">
          <SettersView
            teamId={teamId}
            closerCommissionPct={closerCommissionPct}
            setterCommissionPct={setterCommissionPct}
          />
        </TabsContent>

        <TabsContent value="closers" className="mt-6">
          <ByCloserView teamId={teamId} onCloseDeal={handleCloseDeal} />
        </TabsContent>

        <TabsContent value="mrr" className="mt-6">
          <div className="space-y-6">
            <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
            <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <UnifiedTasksView teamId={teamId} />
        </TabsContent>
      </Tabs>

      <PipelineStageManager 
        open={showStageManager} 
        onOpenChange={setShowStageManager}
        teamId={teamId}
        onStagesUpdated={() => {
          setShowStageManager(false);
          onUpdate();
        }}
      />

      <CloseDealDialog
        appointment={dealToClose}
        teamId={teamId}
        open={showCloseDealDialog}
        onOpenChange={setShowCloseDealDialog}
        onSuccess={handleCloseDealSuccess}
        closerCommissionPct={closerCommissionPct}
        setterCommissionPct={setterCommissionPct}
        onTrackUndo={undoHandlers?.trackAction}
        onShowUndoToast={undoHandlers?.showUndoToast}
      />

      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        teamId={teamId}
        appointments={appointments}
        onTaskCreated={() => window.location.reload()}
      />
    </div>
  );
}
