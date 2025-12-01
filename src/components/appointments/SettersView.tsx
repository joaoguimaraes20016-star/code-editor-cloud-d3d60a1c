import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnassignedAppointments } from "../appointments/UnassignedAppointments";
import { AllNewAppointments } from "../AllNewAppointments";
import { useAuth } from "@/hooks/useAuth";
import { useTeamRole } from "@/hooks/useTeamRole";

interface SettersViewProps {
  teamId: string;
  closerCommissionPct: number;
  setterCommissionPct: number;
}

export function SettersView({ teamId, closerCommissionPct, setterCommissionPct }: SettersViewProps) {
  const { user } = useAuth();
  const { role } = useTeamRole(teamId);
  
  // Admins and offer owners see all appointments
  const isAdmin = role === 'admin' || role === 'offer_owner';

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 rounded-lg p-4 border border-primary/20">
        <h3 className="text-xl font-semibold">Setters Management</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage unassigned and assigned appointments for your setter team
        </p>
      </div>

      <Tabs defaultValue="unassigned" className="w-full">
        <TabsList>
          <TabsTrigger value="unassigned">
            Unassigned
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned
          </TabsTrigger>
          <TabsTrigger value="all-appointments">
            All Appointments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="mt-6">
          <UnassignedAppointments teamId={teamId} onUpdate={() => {}} />
        </TabsContent>

        <TabsContent value="assigned" className="mt-6">
          <AllNewAppointments
            teamId={teamId}
            closerCommissionPct={closerCommissionPct}
            setterCommissionPct={setterCommissionPct}
            userRole="admin"
            currentUserId={user?.id}
            showAllAssigned={true}
          />
        </TabsContent>

        <TabsContent value="all-appointments" className="mt-6">
          <AllNewAppointments
            teamId={teamId}
            closerCommissionPct={closerCommissionPct}
            setterCommissionPct={setterCommissionPct}
            userRole="admin"
            currentUserId={user?.id}
            showAllAppointments={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
