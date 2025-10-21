import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Search, Mail, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ClientAssetViewer } from './ClientAssetViewer';
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

interface ClientAsset {
  id: string;
  client_name: string;
  client_email: string;
  status: string;
  completion_percentage: number;
  access_token: string;
  created_at: string;
}

interface ClientAssetsListProps {
  teamIds: string[];
}

export function ClientAssetsList({ teamIds }: ClientAssetsListProps) {
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<ClientAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ClientAsset | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('client-assets-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_assets',
        },
        () => {
          loadAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamIds]);

  useEffect(() => {
    const filtered = assets.filter(
      (asset) =>
        asset.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.client_email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredAssets(filtered);
  }, [searchQuery, assets]);

  const loadAssets = async () => {
    setLoading(true);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('Loading assets for user:', user.email);
    console.log('Team IDs:', teamIds);

    // Load assets that either:
    // 1. Have team_id matching user's teams (if user has teams)
    // 2. Were created by the user and have no team_id yet (pending account creation)
    // But exclude assets where client_email matches current user (their own asset)
    
    let query = supabase
      .from('client_assets')
      .select('*');

    // Build the OR condition based on whether user has teams
    if (teamIds.length > 0) {
      query = query.or(`team_id.in.(${teamIds.join(',')}),and(created_by.eq.${user.id},team_id.is.null)`);
    } else {
      // If no teams, just get assets created by this user with no team
      query = query.eq('created_by', user.id).is('team_id', null);
    }

    const { data, error } = await query
      .neq('client_email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading assets:', error);
      toast.error('Failed to load client assets');
      setLoading(false);
      return;
    }

    console.log('Loaded assets:', data?.length);
    setAssets(data || []);
    setFilteredAssets(data || []);
    setLoading(false);
  };

  const copyOnboardingLink = (token: string) => {
    const link = `${window.location.origin}/onboard/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Onboarding link copied to clipboard');
  };

  const handleDelete = async () => {
    if (!deleteAssetId) return;

    try {
      console.log('Deleting client asset and associated data:', deleteAssetId);
      
      // Get the client asset to find the team_id
      const { data: asset } = await supabase
        .from('client_assets')
        .select('team_id, client_email')
        .eq('id', deleteAssetId)
        .single();

      if (!asset) {
        throw new Error('Client asset not found');
      }

      // Delete the client asset (this will cascade to fields and files)
      const { error: assetError } = await supabase
        .from('client_assets')
        .delete()
        .eq('id', deleteAssetId);

      if (assetError) {
        console.error('Delete asset error:', assetError);
        throw assetError;
      }

      // If there's a team associated, delete it
      if (asset.team_id) {
        console.log('Deleting associated team:', asset.team_id);
        
        // Delete team (this will cascade to team_members)
        const { error: teamError } = await supabase
          .from('teams')
          .delete()
          .eq('id', asset.team_id);

        if (teamError) {
          console.error('Delete team error:', teamError);
          // Don't throw - asset is already deleted
        }
      }

      console.log('Successfully deleted client asset and associated data');
      toast.success('Client deleted successfully');
      loadAssets();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete client');
    } finally {
      setDeleteAssetId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      complete: { variant: 'default', label: 'Complete' },
      in_progress: { variant: 'secondary', label: 'In Progress' },
      not_started: { variant: 'outline', label: 'Not Started' },
      needs_update: { variant: 'destructive', label: 'Needs Update' },
    };

    const config = variants[status] || variants.not_started;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (selectedAsset) {
    return (
      <ClientAssetViewer
        assetId={selectedAsset.id}
        onClose={() => setSelectedAsset(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by client name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client Cards */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur-sm border-2 border-dashed border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No clients found matching your search' : 'No clients yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="bg-card/50 backdrop-blur-sm border-2 border-border hover:border-primary/50 transition-all"
            >
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{asset.client_name}</h3>
                  <p className="text-sm text-muted-foreground">{asset.client_email}</p>
                </div>

                <div className="flex items-center justify-between">
                  {getStatusBadge(asset.status)}
                  <span className="text-sm text-muted-foreground">
                    {Math.round(asset.completion_percentage)}%
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAsset(asset)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyOnboardingLink(asset.access_token)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteAssetId(asset.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteAssetId} onOpenChange={() => setDeleteAssetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client asset? This action cannot be undone.
              All associated data and files will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
