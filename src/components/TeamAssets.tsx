import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Video, Link as LinkIcon, Download, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import AssetUploadDialog from './AssetUploadDialog';

interface TeamAsset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string | null;
  file_type: string | null;
  loom_url: string | null;
  external_url: string | null;
  created_at: string;
}

const CATEGORIES = [
  { id: 'scripts', label: 'Scripts', icon: FileText },
  { id: 'onboarding', label: 'Onboarding', icon: FileText },
  { id: 'training', label: 'Training', icon: Video },
  { id: 'tracking', label: 'Tracking', icon: LinkIcon },
  { id: 'offer', label: 'Complete Offer', icon: FileText },
];

interface TeamAssetsProps {
  teamId: string;
}

export default function TeamAssets({ teamId }: TeamAssetsProps) {
  const { user } = useAuth();
  const { isOwner } = useTeamRole(teamId);
  const [assets, setAssets] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const loadAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('team_assets')
        .select('*')
        .eq('team_id', teamId)
        .order('category')
        .order('order_index');

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast.error('Failed to load team assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [teamId]);

  const handleDelete = async (assetId: string, filePath: string | null) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('team-assets')
          .remove([filePath]);

        if (storageError) throw storageError;
      }

      const { error } = await supabase
        .from('team_assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

      toast.success('Asset deleted');
      loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const handleDownload = async (filePath: string, title: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('team-assets')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const getAssetIcon = (asset: TeamAsset) => {
    if (asset.file_type?.includes('video')) return Video;
    if (asset.loom_url) return Video;
    if (asset.external_url) return LinkIcon;
    return FileText;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Assets</h2>
          <p className="text-muted-foreground">Manage training materials, SOPs, and resources</p>
        </div>
        {isOwner && (
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        )}
      </div>

      {CATEGORIES.map((category) => {
        const categoryAssets = assets.filter((a) => a.category === category.id);
        if (categoryAssets.length === 0 && !isOwner) return null;

        return (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <category.icon className="h-5 w-5" />
                {category.label}
              </CardTitle>
              {categoryAssets.length === 0 && (
                <CardDescription>No assets yet. Click "Add Asset" to get started.</CardDescription>
              )}
            </CardHeader>
            {categoryAssets.length > 0 && (
              <CardContent className="space-y-2">
                {categoryAssets.map((asset) => {
                  const Icon = getAssetIcon(asset);
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{asset.title}</p>
                          {asset.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {asset.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.file_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(asset.file_path!, asset.title)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {asset.loom_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(asset.loom_url!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {asset.external_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(asset.external_url!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(asset.id, asset.file_path)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        teamId={teamId}
        onSuccess={loadAssets}
      />
    </div>
  );
}
