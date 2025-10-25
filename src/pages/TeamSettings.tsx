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
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { CalendlyConfig } from '@/components/CalendlyConfig';
import { SetterBookingLinks } from '@/components/SetterBookingLinks';
import { CommissionSettings } from '@/components/CommissionSettings';
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
    if (!roleLoading && !isAdmin && !isSuperAdmin && role !== 'setter' && role !== 'offer_owner' && role !== 'admin' && role !== 'closer') {
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/team/${teamId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">{teamName} Settings</h1>
          <p className="text-muted-foreground mt-1">
            {(role === 'closer' || role === 'setter') 
              ? 'Manage your booking links'
              : 'Manage your team members and roles'}
          </p>
        </div>

        {/* Admin/Offer Owner sections - hidden from closers and setters */}
        {(isAdmin || role === 'offer_owner' || role === 'admin' || isSuperAdmin) && (
          <>
            {/* Add Member Card */}
            <Card>
              <CardHeader>
                <CardTitle>Add Team Member</CardTitle>
                <CardDescription>
                  Invite users to your team by their email address
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
                  <Button type="submit">Add Member</Button>
                </form>
              </CardContent>
            </Card>

            {/* Team Members Card */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Current members of your team
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
          </>
        )}

        {/* Commission Settings - visible to admins and offer owners */}
        {(isAdmin || role === 'offer_owner') && (
          <CommissionSettings teamId={teamId!} />
        )}

        {/* Calendly Integration */}
        {(isAdmin || role === "offer_owner" || role === "admin") && (() => {
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Webhook Troubleshooting</CardTitle>
                      <CardDescription>
                        If booking links aren't capturing setter assignments, click below to re-register the webhook
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleFixWebhook} disabled={loading}>
                        Fix Webhook
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          } catch (error) {
            console.error('Error rendering Calendly config:', error);
            return null;
          }
        })()}

        {/* Setter Booking Links - visible to admins, setters, and closers */}
        {(isAdmin || role === 'setter' || role === 'closer') && calendlyEventTypes && calendlyEventTypes.length > 0 && (() => {
          try {
            return (
              <SetterBookingLinks
                teamId={teamId!}
                calendlyEventTypes={calendlyEventTypes}
                calendlyAccessToken={calendlyAccessToken}
                calendlyOrgUri={calendlyOrgUri}
                onRefresh={loadTeamData}
                currentUserId={user?.id}
                isOwner={isAdmin}
              />
            );
          } catch (error) {
            console.error('Error rendering booking links:', error);
            return null;
          }
        })()}
      </div>
    </div>
  );
}
