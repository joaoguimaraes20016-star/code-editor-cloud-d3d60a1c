import { useState, useEffect } from "react";
import { useTeamRole } from "@/hooks/useTeamRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, GraduationCap, Users, FileSpreadsheet, BookOpen, Briefcase, 
  Loader2, Video, FileText, Link as LinkIcon, Pencil, Trash2, 
  GripVertical, Play, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import AssetUploadDialog from "./AssetUploadDialog";
import EditAssetDialog from "./EditAssetDialog";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  { id: "training", label: "Training", icon: GraduationCap, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  { id: "team_onboarding", label: "Team Onboarding", icon: Users, color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" },
  { id: "client_onboarding", label: "Client Onboarding", icon: Briefcase, color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" },
  { id: "tracking", label: "Tracking Sheets", icon: FileSpreadsheet, color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  { id: "resources", label: "Resources & Scripts", icon: BookOpen, color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" },
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

// Sortable Asset Item with Video Embed
function AssetItem({ 
  asset, 
  canManage, 
  colorClass,
  onEdit, 
  onDelete, 
  onDownload 
}: { 
  asset: TeamAsset; 
  canManage: boolean; 
  colorClass: string;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
  onDownload: (filePath: string, title: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      setIsExpanded(!isExpanded);
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
      className="border border-border/50 rounded-lg overflow-hidden bg-card hover:border-border transition-colors"
    >
      {/* Header Row */}
      <div
        className="group flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={handleClick}
      >
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
        
        {/* Icon */}
        <div className={`p-2 rounded-lg ${asset.loom_url ? 'bg-red-500/10' : asset.external_url ? 'bg-blue-500/10' : 'bg-muted'} shrink-0`}>
          {isVideo ? (
            <Play className={`h-4 w-4 ${asset.loom_url ? 'text-red-500' : 'text-blue-500'}`} />
          ) : asset.external_url ? (
            <LinkIcon className="h-4 w-4 text-blue-500" />
          ) : (
            <FileText className={`h-4 w-4 ${colorClass}`} />
          )}
        </div>
        
        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{asset.title}</h4>
          {asset.description && (
            <p className="text-xs text-muted-foreground truncate">{asset.description}</p>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isVideo && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1">
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isExpanded ? 'Hide' : 'Watch'}
            </Button>
          )}
          {!isVideo && asset.external_url && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1">
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
          )}
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
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
                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(asset);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Embedded Video */}
      {isVideo && isExpanded && embedUrl && (
        <div className="border-t border-border/50 bg-black/5">
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
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
  onAddAsset,
}: {
  category: typeof ASSET_CATEGORIES[0];
  assets: TeamAsset[];
  canManage: boolean;
  onReorder: (assets: TeamAsset[]) => void;
  onEdit: (asset: TeamAsset) => void;
  onDelete: (asset: TeamAsset) => void;
  onDownload: (filePath: string, title: string) => void;
  onAddAsset: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
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
    <Card className={`border ${category.borderColor}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${category.bgColor}`}>
                  <Icon className={`h-5 w-5 ${category.color}`} />
                </div>
                <span>{category.label}</span>
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {assets.length} {assets.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddAsset();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                <Icon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No {category.label.toLowerCase()} added yet</p>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={onAddAsset}
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
                    {assets.map((asset) => (
                      <AssetItem
                        key={asset.id}
                        asset={asset}
                        canManage={canManage}
                        colorClass={category.color}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDownload={onDownload}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
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
    // Optimistic update
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

      {/* All Category Sections */}
      <div className="space-y-4">
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
            onAddAsset={() => openUploadWithCategory(category.id)}
          />
        ))}
      </div>

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
