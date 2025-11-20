import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface EmailAlias {
  id: string;
  user_id: string;
  alias_email: string;
  source: string;
  notes: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface TeamMember {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function EmailAliasManager({ teamId }: { teamId: string }) {
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [aliasToDelete, setAliasToDelete] = useState<string | null>(null);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [aliasEmail, setAliasEmail] = useState('');
  const [source, setSource] = useState('calendly');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [teamId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load team members
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, profiles(full_name, email)')
        .eq('team_id', teamId);

      if (membersError) throw membersError;
      setTeamMembers(members || []);

      // Load email aliases for team
      const memberIds = members?.map(m => m.user_id) || [];
      if (memberIds.length > 0) {
        const { data: aliasData, error: aliasError } = await supabase
          .from('email_aliases')
          .select('*')
          .in('user_id', memberIds)
          .order('created_at', { ascending: false });

        if (aliasError) throw aliasError;
        
        // Manually join with profiles data
        const aliasesWithProfiles = (aliasData || []).map(alias => ({
          ...alias,
          profiles: members?.find(m => m.user_id === alias.user_id)?.profiles || null
        }));
        
        setAliases(aliasesWithProfiles);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load email aliases');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!selectedUserId || !aliasEmail) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(aliasEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('email_aliases')
        .insert({
          user_id: selectedUserId,
          alias_email: aliasEmail.toLowerCase().trim(),
          source,
          notes: notes.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This email alias already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Email alias added successfully');
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error adding alias:', error);
      toast.error('Failed to add email alias');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    try {
      const { error } = await supabase
        .from('email_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;

      toast.success('Email alias deleted');
      setDeleteDialogOpen(false);
      setAliasToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting alias:', error);
      toast.error('Failed to delete email alias');
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setAliasEmail('');
    setSource('calendly');
    setNotes('');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Aliases
            </CardTitle>
            <CardDescription>
              Map alternative email addresses (like Calendly accounts) to team members
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Alias
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Email Alias</DialogTitle>
                <DialogDescription>
                  Connect an alternative email address to a team member's profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user">Team Member *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.profiles?.full_name || 'Unknown'} ({member.profiles?.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias Email *</Label>
                  <Input
                    id="alias"
                    type="email"
                    placeholder="calendly-email@example.com"
                    value={aliasEmail}
                    onChange={(e) => setAliasEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger id="source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendly">Calendly</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional context about this alias..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAlias} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Alias
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {aliases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No email aliases configured yet</p>
            <p className="text-sm mt-1">Add aliases to map Calendly or other service emails to team members</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Alias Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((alias) => (
                  <TableRow key={alias.id}>
                    <TableCell>
                      <div className="font-medium">{alias.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{alias.profiles?.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{alias.alias_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {alias.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-xs truncate">
                        {alias.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAliasToDelete(alias.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Alias?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the email alias mapping. Future appointments from this email won't be automatically matched to the team member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aliasToDelete && handleDeleteAlias(aliasToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
