import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { format, addDays } from "date-fns";

interface Appointment {
  id: string;
  start_at_utc: string;
  lead_name: string;
  lead_email: string;
  status: string;
  setter_name: string | null;
  setter_notes: string | null;
  closer_id: string | null;
}

interface AttendanceProps {
  teamId: string;
}

export function Attendance({ teamId }: AttendanceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    loadUserProfile();
    loadAppointments();
  }, [teamId, user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setUserProfile(data);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadAppointments = async () => {
    try {
      const now = new Date();
      const sevenDaysFromNow = addDays(now, 7);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_id', teamId)
        .in('status', ['NEW', 'SHOWED', 'NO_SHOW'])
        .gte('start_at_utc', now.toISOString())
        .lte('start_at_utc', sevenDaysFromNow.toISOString())
        .order('start_at_utc', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading appointments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId: string, newStatus: 'SHOWED' | 'NO_SHOW') => {
    if (!user || !userProfile) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: newStatus,
          closer_id: user.id,
          closer_name: userProfile.full_name,
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Appointment marked as ${newStatus}`,
      });

      loadAppointments();
    } catch (error: any) {
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatLocalTime = (utcTime: string) => {
    const dateObj = new Date(utcTime);
    const formattedDate = format(dateObj, 'MMM d, yyyy h:mm a');
    const timezone = new Intl.DateTimeFormat('en-US', { 
      timeZoneName: 'short' 
    }).formatToParts(dateObj).find(part => part.type === 'timeZoneName')?.value || '';
    return `${formattedDate} ${timezone}`.trim();
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No upcoming appointments in the next 7 days
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Start Time</TableHead>
            <TableHead>Lead Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Setter</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Setter Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
            <TableRow key={apt.id}>
              <TableCell>{formatLocalTime(apt.start_at_utc)}</TableCell>
              <TableCell className="font-medium">{apt.lead_name}</TableCell>
              <TableCell>{apt.lead_email}</TableCell>
              <TableCell>{apt.setter_name || '-'}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  apt.status === 'SHOWED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  apt.status === 'NO_SHOW' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {apt.status}
                </span>
              </TableCell>
              <TableCell className="max-w-xs truncate">{apt.setter_notes || '-'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(apt.id, 'SHOWED')}
                    disabled={apt.status === 'SHOWED'}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Showed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(apt.id, 'NO_SHOW')}
                    disabled={apt.status === 'NO_SHOW'}
                    className="flex items-center gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    No-Show
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
