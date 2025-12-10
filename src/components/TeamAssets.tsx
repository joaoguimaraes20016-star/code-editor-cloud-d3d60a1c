import { useState, useEffect } from "react";
import { useTeamRole } from "@/hooks/useTeamRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Plus, GraduationCap, Users, FileSpreadsheet, BookOpen, Briefcase, 
  Loader2, Play, FileText, Link as LinkIcon, Pencil, Trash2, 
  GripVertical, ExternalLink, ChevronRight, X
} from "lucide-react";
import AssetUploadDialog from "./AssetUploadDialog";
import EditAssetDialog from "./EditAssetDialog";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  { id: "training", label: "Training", icon: GraduationCap, gradient: "from-blue-500 to-indigo-600", lightBg: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "team_onboarding", label: "Team Onboarding", icon: Users, gradient: "from-emerald-500 to-teal-600", lightBg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { id: "client_onboarding", label: "Client Onboarding", icon: Briefcase, gradient: "from-violet-500 to-purple-600", lightBg: "bg-violet-50 dark:bg-violet-950/30" },
  { id: "tracking", label: "Tracking Sheets", icon: FileSpreadsheet, gradient: "from-amber-500 to-orange-600", lightBg: "bg-amber-50 dark:bg-amber-950/30" },
  { id: "resources", label: "Resources & Scripts", icon: BookOpen, gradient: "from-cyan-500 to-blue-600", lightBg: "bg-cyan-50 dark:bg-cyan-950/30" },
];

// Helper to extract video embed URL
const getVideoEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  
  // Loom
  if (url.includes('loom.com')) {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return `https://www.loom.com/embed/${match[1]}`;
  }
  
  // YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1]?.split('&')[0];
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  
  // Vimeo
  if (url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  
  // Wistia
  if (url.includes('wistia.com') || url.includes('wi.st')) {
    const match = url.match(/(?:wistia\.com\/medias\/|wi\.st\/medias\/)([a-zA-Z0-9]+)/);
    if (match) return `https://fast.wistia.net/embed/iframe/${match[1]}`;
  }
  
  return null;
};

// Video Player Modal
function VideoModal({ 
  asset, 
  onClose 
}: { 
  asset: TeamAsset; 
  onClose: () => void;
}) {
  const videoUrl = asset.loom_url || asset.external_url;
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;

  if (!embedUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl animate-scale-in"
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
        <div className="bg-card rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-border">
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

// Asset Card Component
function AssetCard({ 
  asset, 
  canManage, 
  gradient,
  onEdit, 
  onDelete, 
  onDownload,
  onPlayVideo,
  index
}: { 
  asset: TeamAsset; 
  canManage: boolean; 
  gradient: string;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
  onDownload: (filePath: string, title: string) => void;
  onPlayVideo: (asset: TeamAsset) => void;
  index: number;
}) {
  const videoUrl = asset.loom_url || asset.external_url;
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  const isVideo = !!embedUrl;

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
    } else if (asset.file_path) {
      onDownload(asset.file_path, asset.title);
    } else if (asset.external_url) {
      window.open(asset.external_url, "_blank");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-card border border-border/60 rounded-xl overflow-hidden hover:border-border hover:shadow-lg transition-all duration-300 animate-fade-in"
    >
      {/* Card Content */}
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={handleClick}
      >
        {/* Drag Handle */}
        {canManage && (
          <button 
            type="button"
            {...attributes} 
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        
        {/* Module Number / Icon */}
        <div className={`relative shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          {isVideo ? (
            <Play className="h-5 w-5 text-white fill-white" />
          ) : asset.external_url ? (
            <LinkIcon className="h-5 w-5 text-white" />
          ) : (
            <FileText className="h-5 w-5 text-white" />
          )}
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-border text-[10px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
        </div>
        
        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
            {asset.title}
          </h4>
          {asset.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {asset.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {isVideo && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                VIDEO
              </span>
            )}
            {asset.file_path && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                FILE
              </span>
            )}
            {asset.external_url && !isVideo && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                LINK
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isVideo ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play className="h-3.5 w-3.5" />
              Watch
            </Button>
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          
          {canManage && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(asset);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(asset);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Category Section Component
function CategorySection({
  category,
  assets,
  canManage,
  onReorder,
  onEdit,
  onDelete,
  onDownload,
  onPlayVideo,
  onAddAsset,
}: {
  category: typeof ASSET_CATEGORIES[0];
  assets: TeamAsset[];
  canManage: boolean;
  onReorder: (assets: TeamAsset[]) => void;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
  onDownload: (filePath: string, title: string) => void;
  onPlayVideo: (asset: TeamAsset) => void;
  onAddAsset: () => void;
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
    <div className={`rounded-2xl ${category.lightBg} p-6 transition-all duration-300`}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${category.gradient} shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{category.label}</h3>
            <p className="text-xs text-muted-foreground">
              {assets.length} {assets.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-background/80 backdrop-blur-sm"
            onClick={onAddAsset}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </div>
      
      {/* Assets List */}
      {assets.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-xl bg-background/50">
          <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${category.gradient} opacity-20 flex items-center justify-center mb-3`}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            No {category.label.toLowerCase()} added yet
          </p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAsset}
              className="bg-background"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {assets.map((asset, idx) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  canManage={canManage}
                  gradient={category.gradient}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDownload={onDownload}
                  onPlayVideo={onPlayVideo}
                  index={idx}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export default function TeamAssets({ teamId }: TeamAssetsProps) {
  const { isAdmin, role } = useTeamRole(teamId);
  const canManage = isAdmin || role === 'offer_owner' || role === 'admin';
  const [assets, setAssets] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<TeamAsset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("training");
  const [videoModal, setVideoModal] = useState<TeamAsset | null>(null);

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
    setAssets(prev => {
      const otherAssets = prev.filter(a => a.category !== reorderedAssets[0]?.category);
      return [...otherAssets, ...reorderedAssets].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.order_index || 0) - (b.order_index || 0);
      });
    });

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
      loadAssets();
    }
  };

  const getAssetsByCategory = (categoryId: string) => {
    return assets.filter((asset) => asset.category === categoryId);
  };

  const openUploadWithCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setUploadDialogOpen(true);
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
          <h2 className="text-2xl font-bold">Team Assets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Training materials, onboarding resources, and team documentation
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      {/* All Category Sections */}
      <div className="grid gap-6">
        {ASSET_CATEGORIES.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            assets={getAssetsByCategory(category.id)}
            canManage={canManage}
            onReorder={handleReorder}
            onEdit={(asset) => setEditAsset(asset)}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onPlayVideo={(asset) => setVideoModal(asset)}
            onAddAsset={() => openUploadWithCategory(category.id)}
          />
        ))}
      </div>

      {/* Video Modal */}
      {videoModal && (
        <VideoModal asset={videoModal} onClose={() => setVideoModal(null)} />
      )}

      {/* Dialogs */}
      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        teamId={teamId}
        defaultCategory={selectedCategory}
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
