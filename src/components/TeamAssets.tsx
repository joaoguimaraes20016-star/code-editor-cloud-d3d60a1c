import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Video, Link as LinkIcon, Trash2, Pencil, Check, X, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AssetUploadDialog from './AssetUploadDialog';
import EditAssetDialog from './EditAssetDialog';
import { SortableAssetList } from './SortableAssetList';

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
  order_index?: number;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<TeamAsset | null>(null);
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

  const handleReorder = useCallback(async (category: string, reorderedAssets: TeamAsset[]) => {
    // Update local state immediately for responsiveness
    setAssets(prev => {
      const otherAssets = prev.filter(a => a.category !== category);
      return [...otherAssets, ...reorderedAssets];
    });

    // Update order_index in database
    try {
      const updates = reorderedAssets.map((asset, index) => 
        supabase
          .from('team_assets')
          .update({ order_index: index })
          .eq('id', asset.id)
      );
      
      await Promise.all(updates);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Failed to save order');
      loadAssets(); // Reload to restore original order
    }
  }, []);

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
    <div className="space-y-6 sm:space-y-8 md:space-y-12 max-w-7xl w-full">
      {/* Welcome Banner with Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 border border-primary/40 p-4 sm:p-8 md:p-12 lg:p-16 shadow-xl shadow-primary/10">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_85%)]" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-0">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold h-auto py-3 sm:py-4 bg-background/50 border-primary/40 w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    onClick={handleSaveName}
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 flex-1 sm:flex-none"
                  >
                    <Check className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    size="lg"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                </div>
              </div>
            ) : (
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
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
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-4 sm:mb-6">
              Everything you need to succeed, all in one place
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-8 mt-4 sm:mt-6 md:mt-8">
              <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
                <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium">{assets.length} Assets</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
                <Video className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
                <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium">{assets.filter(a => a.loom_url).length} Videos</span>
              </div>
            </div>
          </div>
          {canManageAssets && (
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm sm:text-base md:text-lg px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 w-full sm:w-auto"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              Add Asset
            </Button>
          )}
        </div>
      </div>

      {/* Sales Dashboard Flashcard */}
      <button
        onClick={() => navigate(`/team/${teamId}/sales`)}
        className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 border border-yellow-400/50 p-6 sm:p-8 md:p-10 lg:p-12 shadow-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-[1.02] text-left w-full"
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
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wide text-white drop-shadow-lg">
              Sales Dashboard
            </h3>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-white/95 ml-0 sm:ml-20 drop-shadow-md">
            Track performance, view analytics & manage your sales pipeline
          </p>
          <div className="flex items-center gap-3 mt-6 ml-0 sm:ml-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2">
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
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-background to-background border border-primary/20 p-6 sm:p-8 md:p-10 lg:p-12 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <FileText className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-primary" />
              </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wide">
                  Complete Offer
                </h3>
              </div>
              <SortableAssetList
                assets={offerAssets}
                canManage={canManageAssets}
                colorClass="text-primary"
                onReorder={(reordered) => handleReorder('offer', reordered)}
                onEdit={(asset) => {
                  setEditingAsset(asset);
                  setEditDialogOpen(true);
                }}
                onDelete={handleDelete}
                onClick={handleAssetClick}
                emptyMessage="No assets yet. Click 'Add Asset' above."
              />
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout for other sections */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Scripts Section */}
        {(scriptAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-4 sm:p-6 md:p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-blue-500" />
                </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wide">
                Scripts
              </h3>
            </div>
            <SortableAssetList
              assets={scriptAssets}
              canManage={canManageAssets}
              colorClass="text-blue-500"
              onReorder={(reordered) => handleReorder('scripts', reordered)}
              onEdit={(asset) => {
                setEditingAsset(asset);
                setEditDialogOpen(true);
              }}
              onDelete={handleDelete}
              onClick={handleAssetClick}
              emptyMessage="No scripts yet."
            />
          </div>
        )}

        {/* Onboarding Section */}
        {(onboardingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-4 sm:p-6 md:p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-green-500" />
                </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wide">
                Onboarding
              </h3>
            </div>
            <SortableAssetList
              assets={onboardingAssets}
              canManage={canManageAssets}
              colorClass="text-green-500"
              onReorder={(reordered) => handleReorder('onboarding', reordered)}
              onEdit={(asset) => {
                setEditingAsset(asset);
                setEditDialogOpen(true);
              }}
              onDelete={handleDelete}
              onClick={handleAssetClick}
              emptyMessage="No onboarding materials yet."
            />
          </div>
        )}

        {/* Tracking Sheets Section */}
        {(trackingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-4 sm:p-6 md:p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-purple-500" />
                </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wide">
                Tracking Sheets
              </h3>
            </div>
            <SortableAssetList
              assets={trackingAssets}
              canManage={canManageAssets}
              colorClass="text-purple-500"
              onReorder={(reordered) => handleReorder('tracking', reordered)}
              onEdit={(asset) => {
                setEditingAsset(asset);
                setEditDialogOpen(true);
              }}
              onDelete={handleDelete}
              onClick={handleAssetClick}
              emptyMessage="No tracking sheets yet."
            />
          </div>
        )}

        {/* Training Section */}
        {(trainingAssets.length > 0 || canManageAssets) && (
          <div className="group/card rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-4 sm:p-6 md:p-8 hover:border-primary/30 transition-all shadow-md hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <Video className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-orange-500" />
                </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wide">
                Training
              </h3>
            </div>
            <SortableAssetList
              assets={trainingAssets}
              canManage={canManageAssets}
              colorClass="text-orange-500"
              onReorder={(reordered) => handleReorder('training', reordered)}
              onEdit={(asset) => {
                setEditingAsset(asset);
                setEditDialogOpen(true);
              }}
              onDelete={handleDelete}
              onClick={handleAssetClick}
              emptyMessage="No training materials yet."
            />
          </div>
        )}
      </div>

      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        teamId={teamId}
        onSuccess={loadAssets}
      />

      <EditAssetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        asset={editingAsset}
        onSuccess={loadAssets}
      />
    </div>
  );
}
