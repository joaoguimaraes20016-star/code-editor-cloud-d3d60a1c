import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewAppointments } from "@/components/NewAppointments";
import { MyClaimed } from "@/components/MyClaimed";
import { AllClaimed } from "@/components/AllClaimed";
import { AllNewAppointments } from "@/components/AllNewAppointments";
import { DealPipeline } from "./DealPipeline";
import { TaskBasedConfirmToday } from "./TaskBasedConfirmToday";
import { OperatorControls } from "./OperatorControls";
import { MRRFollowUps } from "./MRRFollowUps";
import { MRRScheduleList } from "./MRRScheduleList";
import { RetargetTab } from "./RetargetTab";
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
  const [adminSelectedStage, setAdminSelectedStage] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showStageManager, setShowStageManager] = useState(false);
  const [dealToClose, setDealToClose] = useState<any>(null);
  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [undoHandlers, setUndoHandlers] = useState<{
    trackAction: (action: { table: string; recordId: string; previousData: Record<string, any>; description: string }) => void;
    showUndoToast: (description: string) => void;
  } | null>(null);

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
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Setter CRM
          </h2>
          <p className="text-muted-foreground mt-1">Manage your daily CRM tasks and view team deals</p>
        </div>
        
        <Tabs defaultValue="confirm" className="w-full">
          <div className="w-full overflow-x-auto">
            <TabsList className="w-max min-w-full h-12">
              <TabsTrigger value="confirm" className="text-sm md:text-base whitespace-nowrap">
                Confirm Today 
                {counts.overdue > 0 && (
                  <Badge className="ml-2 bg-red-600 text-white" variant="secondary">
                    {counts.overdue} overdue
                  </Badge>
                )}
                {counts.myTasks > 0 && <Badge className="ml-2" variant="secondary">{counts.myTasks}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="mine" className="text-sm md:text-base whitespace-nowrap">My Leads</TabsTrigger>
              <TabsTrigger value="all" className="text-sm md:text-base whitespace-nowrap">All Assigned</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-sm md:text-base whitespace-nowrap">Team Pipeline</TabsTrigger>
              <TabsTrigger value="mrr-tasks" className="text-sm md:text-base whitespace-nowrap">
                MRR Tasks {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="mrr-deals" className="text-sm md:text-base whitespace-nowrap">MRR Deals</TabsTrigger>
              <TabsTrigger value="retarget" className="text-sm md:text-base whitespace-nowrap">
                Retarget {counts.followUps > 0 && <Badge className="ml-2" variant="secondary">{counts.followUps}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="confirm" className="mt-6">
            <TaskBasedConfirmToday teamId={teamId} />
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            <MyClaimed
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
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

          <TabsContent value="mrr-tasks" className="mt-6">
            <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </TabsContent>

          <TabsContent value="mrr-deals" className="mt-6">
            <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </TabsContent>

          <TabsContent value="retarget" className="mt-6">
            <RetargetTab teamId={teamId} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Closer sees: My Deals, Team Pipeline, MRR Tasks, MRR Deals, and Stage Views
  if (userRole === "closer") {
    return (
      <div className="space-y-6">
        <InitializeDefaultStages teamId={teamId} />
        <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-xl p-6 border border-accent/30 shadow-lg">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Closer CRM
          </h2>
          <p className="text-muted-foreground mt-1">Track and close your deals</p>
        </div>
        
        <Tabs defaultValue="mine" className="w-full">
          <div className="w-full overflow-x-auto">
            <TabsList className="w-max min-w-full h-12">
              <TabsTrigger value="mine" className="text-sm md:text-base whitespace-nowrap">My Deals</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-sm md:text-base whitespace-nowrap">My Pipeline</TabsTrigger>
              <TabsTrigger value="all" className="text-sm md:text-base whitespace-nowrap">Team Pipeline</TabsTrigger>
              <TabsTrigger value="mrr-tasks" className="text-sm md:text-base whitespace-nowrap">
                MRR Tasks {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="mrr-deals" className="text-sm md:text-base whitespace-nowrap">MRR Deals</TabsTrigger>
              <TabsTrigger value="stages" className="text-sm md:text-base whitespace-nowrap">Stage Views</TabsTrigger>
            </TabsList>
          </div>

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

          <TabsContent value="mrr-tasks" className="mt-6">
            <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </TabsContent>

          <TabsContent value="mrr-deals" className="mt-6">
            <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
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
      
      <Tabs defaultValue="overview" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max min-w-full h-12">
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
            <TabsTrigger value="mrr-tasks" className="text-sm md:text-base whitespace-nowrap">
              MRR Tasks {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mrr" className="text-sm md:text-base whitespace-nowrap">
              MRR Deals
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm md:text-base whitespace-nowrap">
              Tasks
              {counts.overdue > 0 && (
                <Badge className="ml-2 bg-destructive text-destructive-foreground">
                  {counts.overdue}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

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
          <ByCloserView teamId={teamId} />
        </TabsContent>

        <TabsContent value="mrr-tasks" className="mt-6">
          <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
        </TabsContent>

        <TabsContent value="mrr" className="mt-6">
          <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
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
    </div>
  );
}
