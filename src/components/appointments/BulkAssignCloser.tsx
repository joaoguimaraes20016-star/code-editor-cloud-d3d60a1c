import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

interface BulkAssignCloserProps {
  teamId: string;
  closerId: string;
  closerName: string;
  onComplete?: () => void;
}

export function BulkAssignCloser({ teamId, closerId, closerName, onComplete }: BulkAssignCloserProps) {
  const [loading, setLoading] = useState(false);

  const handleBulkAssign = async () => {
    if (!confirm(`Assign all unassigned appointments to ${closerName}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { count, error } = await supabase
        .from('appointments')
        .update({
          closer_id: closerId,
          closer_name: closerName
        })
        .eq('team_id', teamId)
        .is('closer_id', null)
        .neq('status', 'CANCELLED');

      if (error) throw error;

      toast.success(`Assigned ${count} appointments to ${closerName}`);
      onComplete?.();
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error('Failed to bulk assign appointments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleBulkAssign}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <UserCheck className="mr-2 h-4 w-4" />
      {loading ? 'Assigning...' : `Assign Unassigned to ${closerName}`}
    </Button>
  );
}
