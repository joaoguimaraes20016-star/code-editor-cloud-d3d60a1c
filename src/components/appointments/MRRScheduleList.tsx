import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, DollarSign, Loader2, TrendingUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { formatDateTimeWithTimezone } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MRRSchedule {
  id: string;
  client_name: string;
  client_email: string;
  mrr_amount: number;
  next_renewal_date: string;
  status: string;
  first_charge_date: string;
  notes: string | null;
  product_name?: string;
}

interface MRRScheduleListProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
}

export function MRRScheduleList({ teamId, userRole, currentUserId }: MRRScheduleListProps) {
  const [schedules, setSchedules] = useState<MRRSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<MRRSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [taskStats, setTaskStats] = useState({ due: 0, confirmed: 0, canceled: 0, paused: 0 });

  const canDelete = userRole === 'admin' || userRole === 'offer_owner';

  useEffect(() => {
    loadSchedules();
    loadTaskStats();

    const channel = supabase
      .channel('mrr-schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_schedules',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadSchedules();
          loadTaskStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrr_follow_up_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => loadTaskStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userRole, currentUserId]);

  const loadSchedules = async () => {
    try {
      let query = supabase
        .from('mrr_schedules')
        .select('*')
        .eq('team_id', teamId)
        .order('next_renewal_date', { ascending: true });

      // Filter by assigned closer for closers (not admins/offer owners)
      if (userRole === 'closer' && currentUserId) {
        query = query.eq('assigned_to', currentUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to include product_name from appointments
      const transformedData = data?.map((schedule: any) => ({
        ...schedule,
        product_name: schedule.appointments?.product_name,
      })) || [];

      setSchedules(transformedData);
    } catch (error) {
      console.error('Error loading MRR schedules:', error);
      toast.error('Failed to load MRR schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskStats = async () => {
    try {
      // Load schedules with proper filtering
      let schedulesQuery = supabase
        .from('mrr_schedules')
        .select('id')
        .eq('team_id', teamId);

      if (userRole === 'closer' && currentUserId) {
        schedulesQuery = schedulesQuery.eq('assigned_to', currentUserId);
      }

      const { data: schedulesData, error: schedulesError } = await schedulesQuery;
      if (schedulesError) throw schedulesError;

      if (!schedulesData || schedulesData.length === 0) {
        setTaskStats({ due: 0, confirmed: 0, canceled: 0, paused: 0 });
        return;
      }

      const scheduleIds = schedulesData.map(s => s.id);

      // Load tasks only for visible schedules
      const { data, error } = await supabase
        .from('mrr_follow_up_tasks')
        .select('status')
        .eq('team_id', teamId)
        .in('mrr_schedule_id', scheduleIds);

      if (error) throw error;

      const stats = {
        due: data?.filter(t => t.status === 'due').length || 0,
        confirmed: data?.filter(t => t.status === 'confirmed').length || 0,
        canceled: data?.filter(t => t.status === 'canceled').length || 0,
        paused: data?.filter(t => t.status === 'paused').length || 0,
      };

      setTaskStats(stats);
    } catch (error) {
      console.error('Error loading task stats:', error);
    }
  };

  const handleDeleteClick = (schedule: MRRSchedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;

    setDeleting(true);
    try {
      // Delete all follow-up tasks first
      const { error: tasksError } = await supabase
        .from('mrr_follow_up_tasks')
        .delete()
        .eq('mrr_schedule_id', scheduleToDelete.id);

      if (tasksError) throw tasksError;

      // Delete all MRR commissions
      const { error: commissionsError } = await supabase
        .from('mrr_commissions')
        .delete()
        .eq('appointment_id', scheduleToDelete.id);

      if (commissionsError) throw commissionsError;

      // Delete the schedule
      const { error } = await supabase
        .from('mrr_schedules')
        .delete()
        .eq('id', scheduleToDelete.id);

      if (error) throw error;

      toast.success('MRR schedule deleted');
      loadSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      schedule.client_name.toLowerCase().includes(search) ||
      schedule.client_email.toLowerCase().includes(search)
    );
  });

  const activeSchedules = filteredSchedules.filter(s => s.status === 'active');
  const pausedSchedules = filteredSchedules.filter(s => s.status === 'paused');
  const canceledSchedules = filteredSchedules.filter(s => s.status === 'canceled');

  const totalMRR = activeSchedules.reduce((sum, s) => sum + s.mrr_amount, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
      case 'canceled': return 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDaysUntilRenewal = (date: string) => {
    const days = differenceInDays(parseISO(date), new Date());
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Active Schedules */}
        <div className="md:col-span-2 lg:col-span-3">
          {activeSchedules.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSchedules.map((schedule) => {
                const isOverdue = isPast(parseISO(schedule.next_renewal_date));
                const daysUntil = getDaysUntilRenewal(schedule.next_renewal_date);
                
                return (
                  <Card
                    key={schedule.id}
                    className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/80 relative"
                  >
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={() => handleDeleteClick(schedule)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base group-hover:text-primary transition-colors truncate">
                            {schedule.client_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {schedule.client_email}
                          </p>
                          {schedule.product_name && (
                            <Badge variant="outline" className="mt-2 font-normal">
                              {schedule.product_name}
                            </Badge>
                          )}
                        </div>
                        <Badge className={getStatusColor(schedule.status)}>
                          {schedule.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Monthly Revenue</span>
                          <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            ${schedule.mrr_amount.toLocaleString()}/mo
                          </span>
                        </div>

                        <div className="pt-2 border-t border-border/30">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Next Due</span>
                            </div>
                            <span className="font-semibold">
                              {formatDateTimeWithTimezone(schedule.next_renewal_date, 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className={`mt-1 text-xs font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {daysUntil}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground">
                          <span>Started: {formatDateTimeWithTimezone(schedule.first_charge_date, 'MMM dd, yyyy')}</span>
                        </div>
                      </div>

                      {schedule.notes && (
                        <div className="pt-2 border-t border-border/30">
                          <p className="text-xs text-muted-foreground line-clamp-2">{schedule.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MRR Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the MRR schedule for {scheduleToDelete?.client_name}? 
              This will permanently remove ${scheduleToDelete?.mrr_amount.toLocaleString()}/mo in recurring revenue, 
              all follow-up tasks, and all MRR commissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
