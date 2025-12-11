import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Layers, 
  Users, 
  FileText,
  Play,
  ChevronRight,
  Loader2,
  Plus,
  Video,
  FileSpreadsheet,
  Briefcase,
  BookOpen,
  Link as LinkIcon,
  X,
  GripVertical,
  Pencil,
  Trash2
} from "lucide-react";
import { useState } from "react";
import AssetUploadDialog from "@/components/AssetUploadDialog";
import EditAssetDialog from "@/components/EditAssetDialog";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TeamContext {
  teamName: string;
  teamLogo: string | null;
}

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
}

// Category configs with colors
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  training: { label: "TRAINING", color: "text-orange-500", bgColor: "bg-orange-500/20", icon: Video },
  resources: { label: "RESOURCES", color: "text-blue-500", bgColor: "bg-blue-500/20", icon: BookOpen },
  team_onboarding: { label: "TEAM ONBOARDING", color: "text-emerald-500", bgColor: "bg-emerald-500/20", icon: Users },
  tracking: { label: "TRACKING SHEETS", color: "text-pink-500", bgColor: "bg-pink-500/20", icon: FileSpreadsheet },
  client_onboarding: { label: "PROSPECT ONBOARDING", color: "text-primary", bgColor: "bg-primary/20", icon: Briefcase },
};

// Get video embed URL helper
const getVideoEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  
  if (url.includes('loom.com')) {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return `https://www.loom.com/embed/${match[1]}`;
  }
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1]?.split('&')[0];
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  
  if (url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  
  return null;
};

// Video Modal Component
function VideoModal({ asset, onClose }: { asset: TeamAsset; onClose: () => void }) {
  const videoUrl = asset.loom_url || asset.external_url;
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;

  if (!embedUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
        <div className="bg-card rounded-2xl overflow-hidden shadow-2xl border border-border/50">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold">{asset.title}</h3>
            {asset.description && (
              <p className="text-sm text-muted-foreground mt-1">{asset.description}</p>
            )}
          </div>
          <div className="aspect-video bg-black">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Sortable Asset Item
function SortableAssetItem({ 
  asset, 
  canManage,
  onPlayVideo,
  onEdit,
  onDelete
}: { 
  asset: TeamAsset;
  canManage: boolean;
  onPlayVideo: (asset: TeamAsset) => void;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
}) {
  const videoUrl = asset.loom_url || asset.external_url || "";
  const isVideo = getVideoEmbedUrl(videoUrl) !== null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id, disabled: !canManage });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    if (isVideo) {
      onPlayVideo(asset);
    } else if (asset.external_url) {
      window.open(asset.external_url, "_blank");
    } else if (asset.loom_url) {
      window.open(asset.loom_url, "_blank");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 py-2.5 px-2 hover:bg-muted/40 rounded-lg transition-all"
    >
      {canManage && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      
      <div 
        className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
        onClick={handleClick}
      >
        {isVideo ? (
          <Play className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <LinkIcon className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className="flex-1 text-sm font-medium group-hover:text-primary transition-colors truncate">
          {asset.title}
        </span>
        {isVideo && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 opacity-60 group-hover:opacity-100 shrink-0">
            VIDEO
          </Badge>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Category Section Component
function CategorySection({ 
  category, 
  assets, 
  onPlayVideo,
  onAddAsset,
  onEdit,
  onDelete,
  onReorder,
  canManage
}: { 
  category: typeof CATEGORY_CONFIG[string] & { id: string };
  assets: TeamAsset[];
  onPlayVideo: (asset: TeamAsset) => void;
  onAddAsset: (categoryId: string) => void;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
  onReorder: (assets: TeamAsset[]) => void;
  canManage: boolean;
}) {
  const Icon = category.icon;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = assets.findIndex((a) => a.id === active.id);
      const newIndex = assets.findIndex((a) => a.id === over.id);
      onReorder(arrayMove(assets, oldIndex, newIndex));
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${category.bgColor}`}>
              <Icon className={`h-5 w-5 ${category.color}`} />
            </div>
            <h3 className="font-bold tracking-wide">{category.label}</h3>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onAddAsset(category.id)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </div>

        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No {category.label.toLowerCase()} materials yet.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {assets.map((asset) => (
                  <SortableAssetItem
                    key={asset.id}
                    asset={asset}
                    canManage={canManage}
                    onPlayVideo={onPlayVideo}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamHubOverview() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { role, isAdmin } = useTeamRole(teamId || "");
  const { teamName, teamLogo } = useOutletContext<TeamContext>() || { teamName: "", teamLogo: null };
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("training");
  const [videoModal, setVideoModal] = useState<TeamAsset | null>(null);
  const [editAsset, setEditAsset] = useState<TeamAsset | null>(null);
  const [localAssets, setLocalAssets] = useState<TeamAsset[]>([]);

  // Fetch team stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["team-hub-stats", teamId],
    queryFn: async () => {
      const [membersResult, assetsResult, appointmentsResult] = await Promise.all([
        supabase.from("team_members").select("id", { count: "exact" }).eq("team_id", teamId),
        supabase.from("team_assets").select("id", { count: "exact" }).eq("team_id", teamId),
        supabase.from("appointments").select("id", { count: "exact" }).eq("team_id", teamId).eq("status", "CLOSED"),
      ]);
      
      return {
        members: membersResult.count || 0,
        assets: assetsResult.count || 0,
        closedDeals: appointmentsResult.count || 0,
      };
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all team assets
  const { data: assets, isLoading: loadingAssets, refetch: refetchAssets } = useQuery({
    queryKey: ["team-hub-assets-all", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_assets")
        .select("*")
        .eq("team_id", teamId)
        .order("category")
        .order("order_index", { ascending: true });
      
      if (error) throw error;
      setLocalAssets(data as TeamAsset[]);
      return data as TeamAsset[];
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  const quickActions = [
    {
      title: "Sales CRM",
      description: "Pipeline & revenue tracking",
      icon: TrendingUp,
      path: `/team/${teamId}/crm`,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Funnels",
      description: "Lead capture forms",
      icon: Layers,
      path: `/team/${teamId}/funnels`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getAssetsByCategory = (categoryId: string) => {
    return (localAssets || []).filter(a => a.category === categoryId);
  };

  const openUploadWithCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setUploadDialogOpen(true);
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
      refetchAssets();
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete asset");
    }
  };

  const handleReorder = async (reorderedAssets: TeamAsset[]) => {
    // Optimistically update local state
    setLocalAssets(prev => {
      const otherAssets = prev.filter(a => a.category !== reorderedAssets[0]?.category);
      return [...otherAssets, ...reorderedAssets];
    });

    // Persist to database
    try {
      for (let i = 0; i < reorderedAssets.length; i++) {
        await supabase
          .from("team_assets")
          .update({ order_index: i })
          .eq("id", reorderedAssets[i].id);
      }
    } catch (error) {
      console.error("Error reordering assets:", error);
      toast.error("Failed to reorder assets");
      refetchAssets();
    }
  };

  const canManage = isAdmin || role === 'offer_owner' || role === 'admin';

  // Resources first (full width), then others in grid
  const topCategory = 'resources';
  const gridCategories = ['client_onboarding', 'team_onboarding', 'tracking', 'training'];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-lg">
            <AvatarImage src={teamLogo || undefined} className="object-cover" />
            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-lg font-semibold">
              {getInitials(teamName || "Team")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{teamName}</h1>
            <p className="text-muted-foreground">Team Overview</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">
          {role || "Member"}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.members}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Assets</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.assets}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed Deals</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.closedDeals}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map((action) => (
          <Card 
            key={action.title}
            className="cursor-pointer transition-all hover:shadow-md border-border/50 hover:border-primary/30"
            onClick={() => navigate(action.path)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Assets Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Team Assets</h2>
          <p className="text-sm text-muted-foreground">Training materials, resources & onboarding</p>
        </div>
        {canManage && (
          <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      {/* Category Sections */}
      {loadingAssets ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Resources - Full Width at Top */}
          <CategorySection
            category={{ ...CATEGORY_CONFIG[topCategory], id: topCategory }}
            assets={getAssetsByCategory(topCategory)}
            onPlayVideo={(asset) => setVideoModal(asset)}
            onAddAsset={openUploadWithCategory}
            onEdit={(asset) => setEditAsset(asset)}
            onDelete={handleDelete}
            onReorder={handleReorder}
            canManage={canManage}
          />

          {/* 2x2 Grid for other categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gridCategories.map((categoryId) => (
              <CategorySection
                key={categoryId}
                category={{ ...CATEGORY_CONFIG[categoryId], id: categoryId }}
                assets={getAssetsByCategory(categoryId)}
                onPlayVideo={(asset) => setVideoModal(asset)}
                onAddAsset={openUploadWithCategory}
                onEdit={(asset) => setEditAsset(asset)}
                onDelete={handleDelete}
                onReorder={handleReorder}
                canManage={canManage}
              />
            ))}
          </div>
        </>
      )}

      {/* Video Modal */}
      {videoModal && (
        <VideoModal asset={videoModal} onClose={() => setVideoModal(null)} />
      )}

      {/* Edit Dialog */}
      {editAsset && (
        <EditAssetDialog
          open={!!editAsset}
          onOpenChange={(open) => !open && setEditAsset(null)}
          asset={editAsset}
          onSuccess={() => refetchAssets()}
        />
      )}

      {/* Upload Dialog */}
      {teamId && (
        <AssetUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          teamId={teamId}
          defaultCategory={selectedCategory}
          onSuccess={() => refetchAssets()}
        />
      )}
    </div>
  );
}
