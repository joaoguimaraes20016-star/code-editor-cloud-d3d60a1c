import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Edit, Trash2, Copy, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CreateFunnelDialog } from '@/components/funnel-builder/CreateFunnelDialog';
import { useTeamRole } from '@/hooks/useTeamRole';
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

interface Funnel {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  settings: {
    logo_url?: string;
    primary_color: string;
    background_color: string;
    button_text: string;
    ghl_webhook_url?: string;
  };
  created_at: string;
  lead_count?: number;
}

export default function FunnelList() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useTeamRole(teamId);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);

  const { data: funnels, isLoading } = useQuery({
    queryKey: ['funnels', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get lead counts for each funnel
      const funnelsWithCounts = await Promise.all(
        (data || []).map(async (funnel) => {
          const { count } = await supabase
            .from('funnel_leads')
            .select('*', { count: 'exact', head: true })
            .eq('funnel_id', funnel.id);

          return {
            ...funnel,
            settings: funnel.settings as unknown as Funnel['settings'],
            lead_count: count || 0,
          } as Funnel;
        })
      );

      return funnelsWithCounts;
    },
    enabled: !!teamId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (funnelId: string) => {
      const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', funnelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels', teamId] });
      toast({ title: 'Funnel deleted' });
      setFunnelToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete funnel', description: error.message, variant: 'destructive' });
    },
  });

  const copyFunnelUrl = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copied to clipboard' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funnels</h1>
            <p className="text-muted-foreground">Create and manage lead capture funnels</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Funnel
            </Button>
          )}
        </div>

        {funnels?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No funnels yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first funnel to start capturing leads
              </p>
              {isAdmin && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Funnel
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funnels?.map((funnel) => (
              <Card key={funnel.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{funnel.name}</CardTitle>
                      <CardDescription className="truncate">/f/{funnel.slug}</CardDescription>
                    </div>
                    <Badge variant={funnel.status === 'published' ? 'default' : 'secondary'}>
                      {funnel.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Users className="h-4 w-4" />
                    <span>{funnel.lead_count} leads</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/team/${teamId}/funnels/${funnel.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    
                    {funnel.status === 'published' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/f/${funnel.slug}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyFunnelUrl(funnel.slug)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFunnelToDelete(funnel)}
                        className="ml-auto text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateFunnelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        teamId={teamId!}
        onSuccess={(funnelId) => {
          setShowCreateDialog(false);
          navigate(`/team/${teamId}/funnels/${funnelId}`);
        }}
      />

      <AlertDialog open={!!funnelToDelete} onOpenChange={() => setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Funnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{funnelToDelete?.name}"? This will also delete all leads captured by this funnel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => funnelToDelete && deleteMutation.mutate(funnelToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
