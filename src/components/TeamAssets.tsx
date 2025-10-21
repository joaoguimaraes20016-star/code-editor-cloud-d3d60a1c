import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Video, Link as LinkIcon, Trash2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const offerAssets = assets.filter((a) => a.category === 'offer');
  const scriptAssets = assets.filter((a) => a.category === 'scripts');
  const onboardingAssets = assets.filter((a) => a.category === 'onboarding');
  const trackingAssets = assets.filter((a) => a.category === 'tracking');
  const trainingAssets = assets.filter((a) => a.category === 'training');

  const handleAssetClick = (asset: TeamAsset) => {
    if (asset.file_path) {
      handleDownload(asset.file_path, asset.title);
    } else if (asset.loom_url) {
      window.open(asset.loom_url, '_blank');
    } else if (asset.external_url) {
      window.open(asset.external_url, '_blank');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner with Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 border border-primary/40 p-10 shadow-xl shadow-primary/10">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_85%)]" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h2 className="text-4xl font-bold mb-3 flex items-center gap-4">
              <span className="text-5xl">🚀</span>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Team Hub
              </span>
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Everything you need to succeed, all in one place
            </p>
            <div className="flex items-center gap-6 mt-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{assets.length} Assets</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <Video className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{assets.filter(a => a.loom_url).length} Videos</span>
              </div>
            </div>
          </div>
          {isOwner && (
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          )}
        </div>
      </div>

      {/* Complete Offer Section */}
      {(offerAssets.length > 0 || isOwner) && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-background to-background border border-primary/20 p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-wide">
                  Complete Offer
                </h3>
              </div>
              <div className="space-y-3">
                {offerAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetClick(asset)}
                    className="group w-full text-left px-6 py-4 rounded-xl bg-card/50 hover:bg-card border border-border/50 hover:border-primary/30 transition-all flex items-center justify-between hover:scale-[1.02] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        {asset.loom_url ? (
                          <Video className="h-5 w-5 text-primary" />
                        ) : asset.external_url ? (
                          <LinkIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <FileText className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <span className="text-lg font-medium text-primary group-hover:underline">
                        {asset.title}
                      </span>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(asset.id, asset.file_path);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </button>
                ))}
                {offerAssets.length === 0 && isOwner && (
                  <p className="text-sm text-muted-foreground px-4">No assets yet. Click "Add Asset" above.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout for other sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Scripts Section */}
        {(scriptAssets.length > 0 || isOwner) && (
          <div className="group/card rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-6 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wide">
                Scripts
              </h3>
            </div>
            <div className="space-y-2">
              {scriptAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {asset.loom_url ? (
                      <Video className="h-4 w-4 text-blue-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-4 w-4 text-blue-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="text-sm font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </button>
              ))}
              {scriptAssets.length === 0 && isOwner && (
                <p className="text-sm text-muted-foreground px-4">No scripts yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Onboarding Section */}
        {(onboardingAssets.length > 0 || isOwner) && (
          <div className="group/card rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-6 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wide">
                Onboarding
              </h3>
            </div>
            <div className="space-y-2">
              {onboardingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {asset.loom_url ? (
                      <Video className="h-4 w-4 text-green-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </button>
              ))}
              {onboardingAssets.length === 0 && isOwner && (
                <p className="text-sm text-muted-foreground px-4">No onboarding materials yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Tracking Sheets Section */}
        {(trackingAssets.length > 0 || isOwner) && (
          <div className="group/card rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-6 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <FileText className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wide">
                Tracking Sheets
              </h3>
            </div>
            <div className="space-y-2">
              {trackingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {asset.loom_url ? (
                      <Video className="h-4 w-4 text-purple-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-4 w-4 text-purple-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="text-sm font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </button>
              ))}
              {trackingAssets.length === 0 && isOwner && (
                <p className="text-sm text-muted-foreground px-4">No tracking sheets yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Training Section */}
        {(trainingAssets.length > 0 || isOwner) && (
          <div className="group/card rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-6 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Video className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wide">
                Training
              </h3>
            </div>
            <div className="space-y-2">
              {trainingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {asset.loom_url ? (
                      <Video className="h-4 w-4 text-orange-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-4 w-4 text-orange-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-orange-500" />
                    )}
                    <span className="text-sm font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </button>
              ))}
              {trainingAssets.length === 0 && isOwner && (
                <p className="text-sm text-muted-foreground px-4">No training materials yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        teamId={teamId}
        onSuccess={loadAssets}
      />
    </div>
  );
}
