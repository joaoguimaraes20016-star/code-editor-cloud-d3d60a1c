import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    lead_name: string;
    setter_id: string | null;
    closer_id: string | null;
  };
  teamId: string;
  onSuccess: () => void;
}

export function AssignDialog({
  open,
  onOpenChange,
  appointment,
  teamId,
  onSuccess,
}: AssignDialogProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedSetter, setSelectedSetter] = useState<string>(appointment.setter_id || "");
  const [selectedCloser, setSelectedCloser] = useState<string>(appointment.closer_id || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTeamMembers();
      setSelectedSetter(appointment.setter_id || "");
      setSelectedCloser(appointment.closer_id || "");
    }
  }, [open, appointment]);

  const loadTeamMembers = async () => {
    try {
      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        const userIds = members.map((m) => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const membersWithNames = members.map((member) => {
          const profile = profiles?.find((p) => p.id === member.user_id);
          return {
            id: member.user_id,
            name: profile?.full_name || "Unknown",
            role: member.role,
          };
        });

        setTeamMembers(membersWithNames);
      }
    } catch (error) {
      console.error("Error loading team members:", error);
      toast.error("Failed to load team members");
    }
  };

  const handleAssign = async () => {
    if (!selectedSetter) {
      toast.error("Please select a setter");
      return;
    }

    setLoading(true);
    try {
      const setterMember = teamMembers.find((m) => m.id === selectedSetter);
      const closerMember = selectedCloser ? teamMembers.find((m) => m.id === selectedCloser) : null;

      const { error } = await supabase
        .from("appointments")
        .update({
          setter_id: selectedSetter,
          setter_name: setterMember?.name || null,
          closer_id: selectedCloser || null,
          closer_name: closerMember?.name || null,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      toast.success("Appointment assigned successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error assigning appointment:", error);
      toast.error("Failed to assign appointment");
    } finally {
      setLoading(false);
    }
  };

  const setters = teamMembers.filter((m) => m.role === "setter" || m.role === "admin");
  const closers = teamMembers.filter((m) => m.role === "closer" || m.role === "admin");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Appointment</DialogTitle>
          <DialogDescription>
            Assign {appointment.lead_name} to a setter and optionally a closer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="setter">Setter *</Label>
            <Select value={selectedSetter} onValueChange={setSelectedSetter}>
              <SelectTrigger id="setter">
                <SelectValue placeholder="Select setter" />
              </SelectTrigger>
              <SelectContent>
                {setters.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closer">Closer (Optional)</Label>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger id="closer">
                <SelectValue placeholder="No closer assigned (optional)" />
              </SelectTrigger>
              <SelectContent>
                {closers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || !selectedSetter}>
            {loading ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
