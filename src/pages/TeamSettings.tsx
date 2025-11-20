import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, Users, DollarSign, Workflow, Link2, AlertTriangle, Settings2, Activity } from 'lucide-react';
import { CalendlyConfig } from '@/components/CalendlyConfig';
import { SetterBookingLinks } from '@/components/SetterBookingLinks';
import { CommissionSettings } from '@/components/CommissionSettings';
import { SetterRotationSettings } from '@/components/SetterRotationSettings';
import { ClearTeamData } from '@/components/ClearTeamData';
import { CleanupDuplicateSales } from '@/components/CleanupDuplicateSales';
import { BackfillRescheduleUrls } from '@/components/BackfillRescheduleUrls';
import { WorkflowSettings } from '@/components/WorkflowSettings';
import { FollowUpSettings } from '@/components/FollowUpSettings';
import { SystemMonitoring } from '@/components/SystemMonitoring';
import { DataRecoveryPanel } from '@/components/DataRecoveryPanel';
import { EmailAliasManager } from '@/components/EmailAliasManager';
import { getUserFriendlyError } from '@/lib/errorUtils';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  user_id?: string;
  is_super_admin?: boolean;
  is_current_user?: boolean;
}

export default function TeamSettings() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, isAdmin, loading: roleLoading } = useTeamRole(teamId);
  const { toast } = useToast();

  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [calendlyAccessToken, setCalendlyAccessToken] = useState<string | null>(null);
  const [calendlyOrgUri, setCalendlyOrgUri] = useState<string | null>(null);
  const [calendlyWebhookId, setCalendlyWebhookId] = useState<string | null>(null);
  const [calendlyEventTypes, setCalendlyEventTypes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user || !teamId) {
      navigate('/dashboard');
      return;
    }
    
    checkSuperAdmin();
    
    // Allow all team members to access settings (limited view for closers/setters)
    if (!roleLoading && !isAdmin && !isSuperAdmin && role !== 'setter' && role !== 'offer_owner' && role !== 'admin' && role !== 'closer' && role !== 'owner') {
      toast({
        title: 'Access denied',
        description: 'You do not have permission to access settings',
        variant: 'destructive',
      });
      navigate(`/team/${teamId}`);
      return;
    }

    loadTeamData();
    loadMembers();

    // Subscribe to real-time updates for team members
    const channel = supabase
      .channel('team_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, teamId, isAdmin, roleLoading, navigate, isSuperAdmin]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      
      setIsSuperAdmin(!!data);
    } catch (error) {
      console.error('Error checking super admin status:', error);
    }
  };

  const loadTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('name, calendly_access_token, calendly_organization_uri, calendly_webhook_id, calendly_event_types')
        .eq('id', teamId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTeamName(data.name);
        setCalendlyAccessToken(data.calendly_access_token);
        setCalendlyOrgUri(data.calendly_organization_uri);
        setCalendlyWebhookId(data.calendly_webhook_id);
        setCalendlyEventTypes(data.calendly_event_types);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading team',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          role,
          user_id,
          profiles!team_members_user_id_fkey (
            email,
            full_name
          )
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      // Get user IDs to check for super admin status
      const userIds = (data || []).map((m: any) => m.user_id);
      
      // Check which users are super admins
      const { data: superAdmins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('user_id', userIds)
        .eq('role', 'super_admin');

      const superAdminIds = new Set(superAdmins?.map(sa => sa.user_id) || []);

      const formattedMembers = (data || []).map((member: any) => ({
        id: member.id,
        email: member.profiles?.email || 'Unknown',
        full_name: member.profiles?.full_name || 'Unknown',
        role: member.role,
        user_id: member.user_id,
        is_super_admin: superAdminIds.has(member.user_id),
        is_current_user: member.user_id === user?.id,
      }));

      setMembers(formattedMembers);
    } catch (error: any) {
      toast({
        title: 'Error loading members',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: 'Team member role has been updated successfully',
      });

      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Error updating role',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const handleFixWebhook = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-webhook', {
        body: { teamId },
      });

      if (error) throw error;

      toast({
        title: 'Webhook fixed',
        description: 'Your Calendly webhook has been re-registered successfully',
      });

      loadTeamData();
    } catch (error: any) {
      toast({
        title: 'Error fixing webhook',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-team-invite', {
        body: {
          teamId: teamId,
          email: newMemberEmail.toLowerCase(),
          role: newMemberRole,
          teamName: teamName,
        },
      });

      if (error) throw error;

      // Show the invitation link for manual sharing
      if (data?.inviteUrl) {
        if (data?.emailSent) {
          toast({
            title: 'Invitation sent',
            description: `An invitation email has been sent to ${newMemberEmail}`,
          });
        } else {
          // Copy to clipboard
          navigator.clipboard.writeText(data.inviteUrl);
          toast({
            title: 'Invitation created!',
            description: 'Link copied to clipboard. Share it with the new member to join.',
          });
        }
      }

      setNewMemberEmail('');
      setNewMemberRole('member');
    } catch (error: any) {
      toast({
        title: 'Error sending invitation',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Member removed',
        description: 'Team member has been removed successfully',
      });

      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Error removing member',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      admin: 'default',
      offer_owner: 'default',
      closer: 'secondary',
      setter: 'secondary',
      member: 'outline',
    };

    const displayName = role === 'admin' ? 'Admin' : role === 'offer_owner' ? 'Offer Owner' : role;
    return <Badge variant={variants[role] || 'outline'}>{displayName}</Badge>;
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/team/${teamId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Settings2 className="h-8 w-8" />
                {teamName}
              </h1>
              <p className="text-muted-foreground mt-1">
                {(role === 'closer' || role === 'setter') 
                  ? 'Manage your booking links and preferences'
                  : 'Complete team and workflow configuration'}
              </p>
            </div>
          </div>
        </div>

        {/* Admin View - Tabbed Interface */}
        {(isAdmin || role === 'offer_owner' || role === 'admin' || role === 'owner' || isSuperAdmin) ? (
          <Tabs defaultValue="team" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
              <TabsTrigger value="commissions" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Commissions
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-2">
                <Workflow className="h-4 w-4" />
                Workflow
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2">
                <Link2 className="h-4 w-4" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="gap-2">
                <Activity className="h-4 w-4" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Danger
              </TabsTrigger>
            </TabsList>

            {/* Team Members Tab */}
            <TabsContent value="team" className="space-y-6">
              {/* Email Aliases */}
              <EmailAliasManager teamId={teamId!} />
              
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Add Team Member
                  </CardTitle>
                  <CardDescription>
                    Invite new members to collaborate on your team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInviteMember} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                          <SelectTrigger id="role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="offer_owner">Offer Owner</SelectItem>
                            <SelectItem value="closer">Closer</SelectItem>
                            <SelectItem value="setter">Setter</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full md:w-auto">Add Member</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members ({members.length})
                  </CardTitle>
                  <CardDescription>
                    Manage roles and permissions for your team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.full_name}
                              {member.is_super_admin && (
                                <Badge variant="destructive" className="ml-2">SUPER ADMIN</Badge>
                              )}
                            </TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>
                              {(isSuperAdmin || isAdmin) && !member.is_super_admin ? (
                                <Select
                                  value={member.role}
                                  onValueChange={(value) => handleRoleChange(member.id, value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="offer_owner">Offer Owner</SelectItem>
                                    <SelectItem value="closer">Closer</SelectItem>
                                    <SelectItem value="setter">Setter</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                getRoleBadge(member.role)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {((isSuperAdmin && !member.is_current_user) || (!member.is_super_admin && member.role !== 'admin' && member.role !== 'offer_owner')) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Commissions & Money Tab */}
            <TabsContent value="commissions" className="space-y-6">
              <CommissionSettings teamId={teamId!} />
              <SetterRotationSettings teamId={teamId!} />
            </TabsContent>

            {/* Workflow Tab */}
            <TabsContent value="workflow" className="space-y-6">
              <WorkflowSettings teamId={teamId!} />
              <FollowUpSettings teamId={teamId!} />
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-6">
              {(() => {
                try {
                  return (
                    <>
                      <CalendlyConfig 
                        teamId={teamId!}
                        currentAccessToken={calendlyAccessToken}
                        currentOrgUri={calendlyOrgUri}
                        currentWebhookId={calendlyWebhookId}
                        currentEventTypes={calendlyEventTypes}
                        onUpdate={loadTeamData}
                      />
                      
                      {calendlyAccessToken && (
                        <>
                          <Card className="border-primary/20 shadow-lg">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5" />
                                Webhook Troubleshooting
                              </CardTitle>
                              <CardDescription>
                                Fix booking link issues and setter assignments
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Button onClick={handleFixWebhook} disabled={loading}>
                                Re-register Webhook
                              </Button>
                            </CardContent>
                          </Card>
                          
                          <BackfillRescheduleUrls teamId={teamId!} />
                        </>
                      )}

                      {calendlyEventTypes && calendlyEventTypes.length > 0 && (
                        <SetterBookingLinks
                          teamId={teamId!}
                          calendlyEventTypes={calendlyEventTypes}
                          calendlyAccessToken={calendlyAccessToken}
                          calendlyOrgUri={calendlyOrgUri}
                          onRefresh={loadTeamData}
                          currentUserId={user?.id}
                          isOwner={isAdmin}
                        />
                      )}
                    </>
                  );
                } catch (error) {
                  console.error('Error rendering integrations:', error);
                  return null;
                }
              })()}
            </TabsContent>

            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="space-y-6">
              <SystemMonitoring teamId={teamId!} />
              <DataRecoveryPanel teamId={teamId!} />
            </TabsContent>

            {/* Danger Zone Tab */}
            <TabsContent value="danger" className="space-y-6">
              <Card className="border-destructive shadow-lg">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible actions - proceed with caution
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Clean Duplicate Sales</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Remove old sales records causing duplicate counts. Appointment data remains safe.
                        </p>
                        <div className="mt-3">
                          <CleanupDuplicateSales 
                            teamId={teamId!} 
                            onComplete={() => window.location.reload()} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 p-4 border border-destructive rounded-lg bg-destructive/10">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Clear All Data</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Permanently delete all appointments, sales, and tasks. Team structure will be preserved.
                        </p>
                        <div className="mt-3">
                          <ClearTeamData teamId={teamId!} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          /* Closer/Setter View - Simple Booking Links */
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Your Booking Links
              </CardTitle>
              <CardDescription>
                Manage your personal appointment booking links
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendlyEventTypes && calendlyEventTypes.length > 0 ? (
                <SetterBookingLinks
                  teamId={teamId!}
                  calendlyEventTypes={calendlyEventTypes}
                  calendlyAccessToken={calendlyAccessToken}
                  calendlyOrgUri={calendlyOrgUri}
                  onRefresh={loadTeamData}
                  currentUserId={user?.id}
                  isOwner={isAdmin}
                />
              ) : (
                <p className="text-muted-foreground">No booking links configured yet. Contact your admin.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
