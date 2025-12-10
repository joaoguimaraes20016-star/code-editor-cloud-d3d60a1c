import { useState, useEffect } from "react";
import { useTeamRole } from "@/hooks/useTeamRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap, Users, FileSpreadsheet, BookOpen, Briefcase, Loader2 } from "lucide-react";
import AssetUploadDialog from "./AssetUploadDialog";
import EditAssetDialog from "./EditAssetDialog";
import { SortableAssetList } from "./SortableAssetList";
import { toast } from "sonner";

interface TeamAsset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string | null;
  file_type: string | null;
  loom_url: string | null;
  external_url: string | null;
  order_index?: number;
  created_at: string;
}

interface TeamAssetsProps {
  teamId: string;
}

const ASSET_CATEGORIES = [
  { id: "training", label: "Training", icon: GraduationCap, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "team_onboarding", label: "Team Onboarding", icon: Users, color: "text-green-500", bgColor: "bg-green-500/10" },
  { id: "client_onboarding", label: "Client Onboarding", icon: Briefcase, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { id: "tracking", label: "Tracking Sheets", icon: FileSpreadsheet, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { id: "resources", label: "Resources & Scripts", icon: BookOpen, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
];

export default function TeamAssets({ teamId }: TeamAssetsProps) {
  const { isAdmin, role } = useTeamRole(teamId);
  const canManage = isAdmin || role === 'offer_owner' || role === 'admin';
  const [assets, setAssets] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<TeamAsset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("training");

  useEffect(() => {
    loadAssets();
  }, [teamId]);

  const loadAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("team_assets")
        .select("*")
        .eq("team_id", teamId)
        .order("category")
        .order("order_index");

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Error loading assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (asset: TeamAsset) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      if (asset.file_path) {
        await supabase.storage.from("team-assets").remove([asset.file_path]);
      }

      const { error } = await supabase
        .from("team_assets")
        .delete()
        .eq("id", asset.id);

      if (error) throw error;
      toast.success("Asset deleted");
      loadAssets();
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete asset");
    }
  };

  const handleDownload = async (filePath: string, title: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("team-assets")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleReorder = async (reorderedAssets: TeamAsset[]) => {
    try {
      for (let i = 0; i < reorderedAssets.length; i++) {
        await supabase
          .from("team_assets")
          .update({ order_index: i })
          .eq("id", reorderedAssets[i].id);
      }
      loadAssets();
    } catch (error) {
      console.error("Error reordering assets:", error);
      toast.error("Failed to reorder assets");
    }
  };

  const handleAssetClick = (asset: TeamAsset) => {
    if (asset.file_path) {
      handleDownload(asset.file_path, asset.title);
    } else if (asset.loom_url) {
      window.open(asset.loom_url, "_blank");
    } else if (asset.external_url) {
      window.open(asset.external_url, "_blank");
    }
  };

  const getAssetsByCategory = (categoryId: string) => {
    return assets.filter((asset) => asset.category === categoryId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Assets</h2>
          <p className="text-sm text-muted-foreground">
            Training materials, scripts, and resources for your team
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setUploadDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ASSET_CATEGORIES.map((cat) => {
          const count = getAssetsByCategory(cat.id).length;
          const Icon = cat.icon;
          return (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="shrink-0"
            >
              <Icon className="h-4 w-4 mr-2" />
              {cat.label}
              {count > 0 && (
                <span className="ml-2 bg-background/20 px-1.5 py-0.5 rounded text-xs">
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Selected Category Content */}
      {ASSET_CATEGORIES.map((cat) => {
        if (cat.id !== selectedCategory) return null;
        const categoryAssets = getAssetsByCategory(cat.id);
        const Icon = cat.icon;

        return (
          <Card key={cat.id}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={`p-2 rounded-lg ${cat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${cat.color}`} />
                </div>
                {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryAssets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No {cat.label.toLowerCase()} added yet</p>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Asset
                    </Button>
                  )}
                </div>
              ) : (
                <SortableAssetList
                  assets={categoryAssets}
                  canManage={canManage}
                  colorClass={cat.color}
                  emptyMessage={`No ${cat.label.toLowerCase()} added yet`}
                  onReorder={handleReorder}
                  onEdit={(asset) => setEditAsset(asset)}
                  onDelete={handleDelete}
                  onClick={handleAssetClick}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Dialogs */}
      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        teamId={teamId}
        onSuccess={loadAssets}
      />

      {editAsset && (
        <EditAssetDialog
          open={!!editAsset}
          onOpenChange={(open) => !open && setEditAsset(null)}
          asset={editAsset}
          onSuccess={loadAssets}
        />
      )}
    </div>
  );
}
