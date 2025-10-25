import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Video, Link as LinkIcon, Trash2, Pencil, Check, X, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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
  const { isAdmin, role } = useTeamRole(teamId);
  // Only admins, offer_owners can manage assets
  const canManageAssets = isAdmin || role === 'offer_owner' || role === 'admin';
  const navigate = useNavigate();
  const [assets, setAssets] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('Team Hub');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const loadTeamData = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .maybeSingle();

      if (teamError) throw teamError;
      if (teamData) {
        setTeamName(teamData.name || 'Team Hub');
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    }
  };

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
    loadTeamData();
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

  const handleStartEdit = () => {
    setEditedName(teamName);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: editedName.trim() })
        .eq('id', teamId);

      if (error) throw error;

      setTeamName(editedName.trim());
      setIsEditingName(false);
      toast.success('Team name updated');
    } catch (error) {
      console.error('Error updating team name:', error);
      toast.error('Failed to update team name');
    }
  };

  return (
    <div className="space-y-12 max-w-7xl">
      {/* Welcome Banner with Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 border border-primary/40 p-16 shadow-xl shadow-primary/10">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_85%)]" />
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-4 mb-6">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-5xl font-bold h-auto py-4 bg-background/50 border-primary/40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button
                  onClick={handleSaveName}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Check className="h-6 w-6" />
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="lg"
                  variant="outline"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            ) : (
              <h2 className="text-6xl font-bold mb-6 flex items-center gap-4">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {teamName}
                </span>
                {canManageAssets && (
                  <Button
                    onClick={handleStartEdit}
                    variant="ghost"
                    size="lg"
                    className="hover:bg-background/50"
                  >
                    <Pencil className="h-6 w-6" />
                  </Button>
                )}
              </h2>
            )}
            <p className="text-2xl text-muted-foreground mb-6">
              Everything you need to succeed, all in one place
            </p>
            <div className="flex items-center gap-8 mt-8">
              <div className="flex items-center gap-3 px-6 py-4 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <FileText className="h-6 w-6 text-primary" />
                <span className="text-lg font-medium">{assets.length} Assets</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-4 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <Video className="h-6 w-6 text-primary" />
                <span className="text-lg font-medium">{assets.filter(a => a.loom_url).length} Videos</span>
              </div>
            </div>
          </div>
          {canManageAssets && (
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl hover:scale-105 transition-all text-lg px-8 py-6"
            >
              <Plus className="h-6 w-6 mr-2" />
              Add Asset
            </Button>
          )}
        </div>
      </div>

      {/* Sales Dashboard Flashcard */}
      <button
        onClick={() => navigate(`/team/${teamId}/sales`)}
        className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 border border-yellow-400/50 p-12 shadow-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-[1.02] text-left w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300/20 via-transparent to-yellow-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-yellow-300/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-yellow-400/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute -top-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp className="h-56 w-56 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-4">
            <div className="p-4 rounded-xl bg-white/25 border border-white/40 backdrop-blur-sm group-hover:bg-white/35 group-hover:scale-110 transition-all">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-4xl font-bold uppercase tracking-wide text-white drop-shadow-lg">
              Sales Dashboard
            </h3>
          </div>
          <p className="text-xl text-white/95 ml-20 drop-shadow-md">
            Track performance, view analytics & manage your sales pipeline
          </p>
          <div className="flex items-center gap-3 mt-6 ml-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2">
            <div className="px-5 py-2 rounded-full bg-white/25 backdrop-blur-sm border border-white/40 shadow-lg">
              <span className="text-base font-semibold text-white">View Dashboard</span>
            </div>
            <span className="text-white text-xl animate-pulse">→</span>
          </div>
        </div>
      </button>

      {/* Complete Offer Section */}
      {(offerAssets.length > 0 || canManageAssets) && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-background to-background border border-primary/20 p-12 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-4xl font-bold uppercase tracking-wide">
                  Complete Offer
                </h3>
              </div>
              <div className="space-y-4">
                {offerAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetClick(asset)}
                    className="group w-full text-left px-8 py-6 rounded-xl bg-card/50 hover:bg-card border border-border/50 hover:border-primary/30 transition-all flex items-center justify-between hover:scale-[1.02] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-6">
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        {asset.loom_url ? (
                          <Video className="h-7 w-7 text-primary" />
                        ) : asset.external_url ? (
                          <LinkIcon className="h-7 w-7 text-primary" />
                        ) : (
                          <FileText className="h-7 w-7 text-primary" />
                        )}
                      </div>
                      <span className="text-xl font-medium text-primary group-hover:underline">
                        {asset.title}
                      </span>
                    </div>
                    {canManageAssets && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive h-10 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(asset.id, asset.file_path);
                        }}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </button>
                ))}
                {offerAssets.length === 0 && canManageAssets && (
                  <p className="text-base text-muted-foreground px-4">No assets yet. Click "Add Asset" above.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout for other sections */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Scripts Section */}
        {(scriptAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileText className="h-7 w-7 text-blue-500" />
              </div>
              <h3 className="text-3xl font-bold uppercase tracking-wide">
                Scripts
              </h3>
            </div>
            <div className="space-y-3">
              {scriptAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-6 py-4 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {asset.loom_url ? (
                      <Video className="h-6 w-6 text-blue-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-6 w-6 text-blue-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-blue-500" />
                    )}
                    <span className="text-lg font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {canManageAssets && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </button>
              ))}
              {scriptAssets.length === 0 && canManageAssets && (
                <p className="text-base text-muted-foreground px-4">No scripts yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Onboarding Section */}
        {(onboardingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <FileText className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-3xl font-bold uppercase tracking-wide">
                Onboarding
              </h3>
            </div>
            <div className="space-y-3">
              {onboardingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-6 py-4 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {asset.loom_url ? (
                      <Video className="h-6 w-6 text-green-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-6 w-6 text-green-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-green-500" />
                    )}
                    <span className="text-lg font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {canManageAssets && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </button>
              ))}
              {onboardingAssets.length === 0 && canManageAssets && (
                <p className="text-base text-muted-foreground px-4">No onboarding materials yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Tracking Sheets Section */}
        {(trackingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <FileText className="h-7 w-7 text-purple-500" />
              </div>
              <h3 className="text-3xl font-bold uppercase tracking-wide">
                Tracking Sheets
              </h3>
            </div>
            <div className="space-y-3">
              {trackingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-6 py-4 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {asset.loom_url ? (
                      <Video className="h-6 w-6 text-purple-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-6 w-6 text-purple-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-purple-500" />
                    )}
                    <span className="text-lg font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {canManageAssets && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </button>
              ))}
              {trackingAssets.length === 0 && canManageAssets && (
                <p className="text-base text-muted-foreground px-4">No tracking sheets yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Training Section */}
        {(trainingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Video className="h-7 w-7 text-orange-500" />
              </div>
              <h3 className="text-3xl font-bold uppercase tracking-wide">
                Training
              </h3>
            </div>
            <div className="space-y-3">
              {trainingAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="group w-full text-left px-6 py-4 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {asset.loom_url ? (
                      <Video className="h-6 w-6 text-orange-500" />
                    ) : asset.external_url ? (
                      <LinkIcon className="h-6 w-6 text-orange-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-orange-500" />
                    )}
                    <span className="text-lg font-medium group-hover:text-primary group-hover:underline transition-colors">
                      {asset.title}
                    </span>
                  </div>
                  {canManageAssets && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.file_path);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </button>
              ))}
              {trainingAssets.length === 0 && canManageAssets && (
                <p className="text-base text-muted-foreground px-4">No training materials yet.</p>
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
