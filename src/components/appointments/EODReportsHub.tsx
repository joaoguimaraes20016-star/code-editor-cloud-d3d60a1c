import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SetterEODReport } from "./SetterEODReport";
import { CloserEODReport } from "./CloserEODReport";
import { CalendarIcon, ChevronDown, Activity, AlertCircle, CheckCircle, Phone, DollarSign, TrendingUp, Send } from "lucide-react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useTeamRole } from "@/hooks/useTeamRole";
import { toast } from "sonner";

interface TeamMemberStats {
  id: string;
  name: string;
  email: string;
  officialRole: string;
  actualRoles: ('setter' | 'closer')[];
  activityStatus: { color: string; text: string };
  lastActive: Date | null;
  softwareActionCount: number;
  booked?: number;
  confirmed?: number;
  closed?: number;
  pipelineMoves?: number;
  overdue: number;
}

interface EODReportsHubProps {
  teamId: string;
}

export function EODReportsHub({ teamId }: EODReportsHubProps) {
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const { isAdmin } = useTeamRole(teamId);

  useEffect(() => {
    loadTeamStats();

    const channel = supabase
      .channel(`eod-reports-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadTeamStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmation_tasks' }, loadTeamStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, loadTeamStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const loadTeamStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active team members
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (!members) return;

      const userIds = members.map(m => m.user_id);
      
      // Get profiles with email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (!profiles) return;

      // Load overdue tasks only (tasks where due_at is in the past)
      const now = new Date();
      const { data: overdueTasks } = await supabase
        .from('confirmation_tasks')
        .select('*, appointment:appointments(*)')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .lt('due_at', now.toISOString());

      // Build stats for each member
      const stats: TeamMemberStats[] = profiles.map((profile) => {
        const officialRole = members.find(m => m.user_id === profile.id)?.role || 'member';
        
        // Determine actual roles based on official role
        const actualRoles: ('setter' | 'closer')[] = [];
        
        if (officialRole === 'setter') actualRoles.push('setter');
        if (officialRole === 'closer' || officialRole === 'offer_owner') actualRoles.push('closer');
        
        // If admin or owner, show both
        if (officialRole === 'admin' || officialRole === 'owner') {
          actualRoles.push('setter', 'closer');
        }
        
        // Overdue tasks
        const overdue = overdueTasks?.filter(t => t.assigned_to === profile.id).length || 0;

        return {
          id: profile.id,
          name: profile.full_name || 'Unknown',
          email: profile.email || '',
          officialRole,
          actualRoles,
          activityStatus: { color: 'bg-muted', text: 'View Details' },
          lastActive: null,
          softwareActionCount: 0,
          overdue
        };
      });

      // Sort by overdue count (highest first), then alphabetically
      stats.sort((a, b) => {
        if (b.overdue !== a.overdue) return b.overdue - a.overdue;
        return a.name.localeCompare(b.name);
      });

      setTeamStats(stats);
    } catch (error) {
      console.error('Error loading team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityStatus = (lastActive: Date | null) => {
    if (!lastActive) return { color: 'bg-muted', text: 'No Activity' };
    const hoursSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 2) return { color: 'bg-success', text: 'Active' };
    if (hoursSince < 4) return { color: 'bg-warning', text: 'Idle' };
    return { color: 'bg-muted', text: 'Inactive' };
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'setter') return 'default';
    if (role === 'closer' || role === 'offer_owner') return 'secondary';
    if (role === 'admin') return 'outline';
    return 'outline';
  };

  const handleSendReminder = async (memberId: string, memberName: string, memberEmail: string, overdueCount: number) => {
    try {
      setSendingReminder(memberId);
      
      const { error } = await supabase.functions.invoke('send-task-reminder', {
        body: {
          userId: memberId,
          userName: memberName,
          userEmail: memberEmail,
          overdueCount,
          teamId
        }
      });

      if (error) throw error;
      
      toast.success(`Reminder sent to ${memberName}`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const renderMemberCard = (member: TeamMemberStats) => {
    const isExpanded = expandedMember === member.id;
    const formatRole = (role: string) => {
      if (role === 'offer_owner') return 'Offer Owner';
      if (role === 'admin') return 'Admin';
      return role.charAt(0).toUpperCase() + role.slice(1);
    };
    const displayRole = member.actualRoles.length > 1 ? 'Setter & Closer' : 
                       member.actualRoles[0] === 'setter' ? 'Setter' : 
                       member.actualRoles[0] === 'closer' ? 'Closer' : 
                       formatRole(member.officialRole);

    return (
      <Collapsible
        key={member.id}
        open={isExpanded}
        onOpenChange={() => setExpandedMember(isExpanded ? null : member.id)}
      >
        <Card className={cn(
          "transition-all hover:shadow-md cursor-pointer",
          member.overdue > 0 && "border-destructive/40"
        )}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <Badge variant={getRoleBadgeVariant(member.officialRole)} className="text-xs">
                      {displayRole}
                    </Badge>
                  </div>
                  
                  {/* Overdue Warning */}
                  {member.overdue > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-2 text-destructive font-semibold text-sm flex-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{member.overdue} OVERDUE TASKS</span>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendReminder(member.id, member.name, member.email, member.overdue);
                          }}
                          disabled={sendingReminder === member.id}
                        >
                          <Send className="h-3 w-3" />
                          {sendingReminder === member.id ? 'Sending...' : 'Send Reminder'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform ml-2",
                  isExpanded && "rotate-180"
                )} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {member.actualRoles.includes('setter') && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Setter Activity
                  </h4>
                  <SetterEODReport
                    teamId={teamId}
                    userId={member.id}
                    userName={member.name}
                    date={new Date()}
                  />
                </div>
              )}
              {member.actualRoles.includes('closer') && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Closer Activity
                  </h4>
                  <CloserEODReport
                    teamId={teamId}
                    userId={member.id}
                    userName={member.name}
                    date={new Date()}
                  />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          EOD Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {teamStats.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No team members found</p>
        ) : (
          teamStats.map(member => renderMemberCard(member))
        )}
      </CardContent>
    </Card>
  );
}
