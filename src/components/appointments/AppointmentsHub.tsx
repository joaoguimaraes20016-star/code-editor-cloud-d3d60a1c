import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentListView } from "./AppointmentListView";
import { DealPipeline } from "./DealPipeline";
import { QuickCloseDealModal } from "./QuickCloseDealModal";
import { MyLeads } from "./MyLeads";
import { TodaysSchedule } from "./TodaysSchedule";
import { UnassignedAppointments } from "./UnassignedAppointments";
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
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [closeDealModalOpen, setCloseDealModalOpen] = useState(false);

  const handleCloseDeal = (appointment: any) => {
    setSelectedAppointment(appointment);
    setCloseDealModalOpen(true);
  };

  const handleCloseDealSuccess = () => {
    onUpdate();
  };

  // Role-based tab configuration
  const isSetter = userRole === "setter";
  const isCloser = userRole === "closer";
  const isAdmin = userRole === "admin" || userRole === "offer_owner";

  return (
    <div>
      <Tabs defaultValue={isSetter ? "my-leads" : isCloser ? "today" : "unassigned"} className="w-full">
        {/* Setter View */}
        {isSetter && (
          <>
            <TabsList className="w-full">
              <TabsTrigger value="my-leads">My Leads</TabsTrigger>
            </TabsList>
            <TabsContent value="my-leads" className="mt-6">
              <MyLeads
                teamId={teamId}
                currentUserId={user?.id || ""}
                onCloseDeal={handleCloseDeal}
              />
            </TabsContent>
          </>
        )}

        {/* Closer View */}
        {isCloser && (
          <>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="today">Today's Schedule</TabsTrigger>
              <TabsTrigger value="pipeline">My Pipeline</TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="mt-6">
              <TodaysSchedule
                teamId={teamId}
                currentUserId={user?.id || ""}
                onCloseDeal={handleCloseDeal}
              />
            </TabsContent>
            <TabsContent value="pipeline" className="mt-6">
              <DealPipeline
                teamId={teamId}
                userRole={userRole}
                currentUserId={user?.id || ""}
                onCloseDeal={handleCloseDeal}
              />
            </TabsContent>
          </>
        )}

        {/* Admin/Offer Owner View */}
        {isAdmin && (
          <>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
              <TabsTrigger value="all">All Appointments</TabsTrigger>
              <TabsTrigger value="pipeline">Team Pipeline</TabsTrigger>
            </TabsList>
            <TabsContent value="unassigned" className="mt-6">
              <UnassignedAppointments teamId={teamId} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="all" className="mt-6">
              <AppointmentListView
                teamId={teamId}
                userRole={userRole}
                currentUserId={user?.id || ""}
                onCloseDeal={handleCloseDeal}
              />
            </TabsContent>
            <TabsContent value="pipeline" className="mt-6">
              <DealPipeline
                teamId={teamId}
                userRole={userRole}
                currentUserId={user?.id || ""}
                onCloseDeal={handleCloseDeal}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {selectedAppointment && (
        <QuickCloseDealModal
          open={closeDealModalOpen}
          onOpenChange={setCloseDealModalOpen}
          appointment={selectedAppointment}
          closerCommissionPct={closerCommissionPct}
          setterCommissionPct={setterCommissionPct}
          onSuccess={handleCloseDealSuccess}
        />
      )}
    </div>
  );
}
