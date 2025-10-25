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

  const handleCloseDeal = (appointment: any) => {
    setDealToClose(appointment);
    setShowCloseDealDialog(true);
  };

  const handleCloseDealSuccess = () => {
    setShowCloseDealDialog(false);
    setDealToClose(null);
    onUpdate();
  };
  // Setter sees: Confirm Today, My Appointments, All Assigned, and Retarget
  if (userRole === "setter") {
    return (
      <div className="space-y-6">
        <InitializeDefaultStages teamId={teamId} />
        <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 rounded-xl p-6 border border-primary/30 shadow-lg">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Setter Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Manage your daily appointments and retarget leads</p>
        </div>
        
        <Tabs defaultValue="confirm" className="w-full">
          <TabsList className="w-full h-auto md:h-12 flex-col md:flex-row overflow-x-auto">
            <TabsTrigger value="confirm" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">
              Confirm Today {counts.myTasks > 0 && <Badge className="ml-2" variant="secondary">{counts.myTasks}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mine" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">My Appointments</TabsTrigger>
            <TabsTrigger value="all" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">All Assigned</TabsTrigger>
            <TabsTrigger value="retarget" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">
              Retarget {counts.followUps > 0 && <Badge className="ml-2" variant="secondary">{counts.followUps}</Badge>}
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="retarget" className="mt-6">
            <RetargetTab teamId={teamId} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Closer sees: My Deals, Deal Pipeline, and Stage Views
  if (userRole === "closer") {
    return (
      <div className="space-y-6">
        <InitializeDefaultStages teamId={teamId} />
        <div className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/5 rounded-xl p-6 border border-accent/30 shadow-lg">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Closer Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Track and close your deals</p>
        </div>
        
        <Tabs defaultValue="mine" className="w-full">
          <TabsList className="w-full h-auto md:h-12 flex-col md:flex-row overflow-x-auto">
            <TabsTrigger value="mine" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">My Deals</TabsTrigger>
            <TabsTrigger value="all" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">All Appointments</TabsTrigger>
            <TabsTrigger value="pipeline" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">Deal Pipeline</TabsTrigger>
            <TabsTrigger value="mrr-tasks" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">
              MRR Tasks {counts.mrrDue > 0 && <Badge className="ml-2" variant="secondary">{counts.mrrDue}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mrr-deals" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">MRR Deals</TabsTrigger>
            <TabsTrigger value="stages" className="w-full md:w-auto text-sm md:text-base whitespace-nowrap">Stage Views</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-6">
            <AllClaimed
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <AllNewAppointments
              teamId={teamId}
              closerCommissionPct={closerCommissionPct}
              setterCommissionPct={setterCommissionPct}
              userRole={userRole}
              currentUserId={user?.id}
            />
          </TabsContent>

          <TabsContent value="mrr-tasks" className="mt-6">
            <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </TabsContent>

          <TabsContent value="mrr-deals" className="mt-6">
            <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-6">
            <DealPipeline
              teamId={teamId}
              userRole={userRole}
              currentUserId={user?.id || ''}
              onCloseDeal={handleCloseDeal}
            />
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
        />
      </div>
    );
  }

  // Admin/Offer Owner sees: Confirm Today, Unassigned, All Assigned, Pipeline, Stages, and Retarget
  return (
    <div className="space-y-6">
      <InitializeDefaultStages teamId={teamId} />
      <div className="bg-gradient-to-br from-primary/15 via-accent/15 to-primary/10 rounded-xl p-6 border border-primary/40 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Admin Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">Manage all team appointments and deals</p>
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
        <TabsList className="w-full h-auto md:h-12 flex-col md:flex-row overflow-x-auto">
          <TabsTrigger value="overview" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">Overview</TabsTrigger>
          <TabsTrigger value="unassigned" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">Unassigned</TabsTrigger>
          <TabsTrigger value="assigned" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">All Assigned</TabsTrigger>
          <TabsTrigger value="pipeline" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">Pipeline</TabsTrigger>
          <TabsTrigger value="tasks" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">
            Tasks {(counts.myTasks + counts.queueTasks) > 0 && <Badge className="ml-1" variant="secondary">{counts.myTasks + counts.queueTasks}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mrr-tasks" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">
            MRR Tasks {counts.mrrDue > 0 && <Badge className="ml-1" variant="secondary">{counts.mrrDue}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mrr-deals" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">MRR Deals</TabsTrigger>
          <TabsTrigger value="stages" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">Stages</TabsTrigger>
          <TabsTrigger value="retarget" className="w-full md:w-auto text-xs md:text-sm whitespace-nowrap">
            Follow-Ups {counts.followUps > 0 && <Badge className="ml-1" variant="secondary">{counts.followUps}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <OperatorControls teamId={teamId} />
          <TaskBasedConfirmToday teamId={teamId} />
        </TabsContent>

        <TabsContent value="unassigned" className="mt-6">
          <AllNewAppointments
            teamId={teamId}
            closerCommissionPct={closerCommissionPct}
            setterCommissionPct={setterCommissionPct}
            userRole={userRole}
            currentUserId={user?.id}
          />
        </TabsContent>

        <TabsContent value="assigned" className="mt-6">
          <AllClaimed
            teamId={teamId}
            closerCommissionPct={closerCommissionPct}
            setterCommissionPct={setterCommissionPct}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TaskBasedConfirmToday teamId={teamId} />
        </TabsContent>

        <TabsContent value="mrr-tasks" className="mt-6">
          <MRRFollowUps teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
        </TabsContent>

        <TabsContent value="mrr-deals" className="mt-6">
          <MRRScheduleList teamId={teamId} userRole={userRole} currentUserId={user?.id || ''} />
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

        <TabsContent value="stages" className="mt-6">
          {adminSelectedStage ? (
            <div className="space-y-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAdminSelectedStage(null)}
              >
                ← Back to All Stages
              </Button>
              <StageWorkspaceView 
                teamId={teamId} 
                stageId={adminSelectedStage.id} 
                stageName={adminSelectedStage.name}
                stageColor={adminSelectedStage.color}
              />
            </div>
          ) : (
            <StageWorkspaceList 
              teamId={teamId} 
              onSelectStage={(id, name, color) => setAdminSelectedStage({ id, name, color })}
            />
          )}
        </TabsContent>

        <TabsContent value="retarget" className="mt-6">
          <RetargetTab teamId={teamId} />
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
      />
    </div>
  );
}
