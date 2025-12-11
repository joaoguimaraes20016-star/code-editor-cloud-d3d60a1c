import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Trash2,
  Settings2
} from "lucide-react";
import { useState, useEffect } from "react";
import AssetUploadDialog from "@/components/AssetUploadDialog";
import EditAssetDialog from "@/components/EditAssetDialog";
import { SectionManagerDialog } from "@/components/SectionManagerDialog";
import { getIconComponent } from "@/components/IconPicker";
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

interface AssetCategory {
  id: string;
  label: string;
  icon: string;
  order_index: number;
}

// Default categories fallback
const DEFAULT_CATEGORIES: AssetCategory[] = [
  { id: "resources", label: "Resources", icon: "BookOpen", order_index: 0 },
  { id: "offer", label: "Offer", icon: "Briefcase", order_index: 1 },
  { id: "scripts", label: "Scripts & SOPs", icon: "FileText", order_index: 2 },
  { id: "training", label: "Training", icon: "Video", order_index: 3 },
  { id: "tracking", label: "Tracking Sheets", icon: "FileSpreadsheet", order_index: 4 },
  { id: "team_onboarding", label: "Team Onboarding", icon: "Users", order_index: 5 },
  { id: "client_onboarding", label: "Prospect Onboarding", icon: "Briefcase", order_index: 6 },
];

// Color palette for categories
const CATEGORY_COLORS = [
  { color: "text-blue-500", bgColor: "bg-blue-500/20" },
  { color: "text-amber-500", bgColor: "bg-amber-500/20" },
  { color: "text-purple-500", bgColor: "bg-purple-500/20" },
  { color: "text-orange-500", bgColor: "bg-orange-500/20" },
  { color: "text-pink-500", bgColor: "bg-pink-500/20" },
  { color: "text-emerald-500", bgColor: "bg-emerald-500/20" },
  { color: "text-primary", bgColor: "bg-primary/20" },
  { color: "text-rose-500", bgColor: "bg-rose-500/20" },
  { color: "text-cyan-500", bgColor: "bg-cyan-500/20" },
  { color: "text-indigo-500", bgColor: "bg-indigo-500/20" },
];

const getCategoryColor = (index: number) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

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

// Sortable Category Section
function SortableCategorySection({ 
  category,
  colorIndex,
  assets, 
  onPlayVideo,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
  onReorderAssets,
  onEditSection,
  canManage
}: { 
  category: AssetCategory;
  colorIndex: number;
  assets: TeamAsset[];
  onPlayVideo: (asset: TeamAsset) => void;
  onAddAsset: (categoryId: string) => void;
  onEditAsset: (asset: TeamAsset) => void;
  onDeleteAsset: (asset: TeamAsset) => void;
  onReorderAssets: (assets: TeamAsset[]) => void;
  onEditSection: (category: AssetCategory) => void;
  canManage: boolean;
}) {
  const Icon = getIconComponent(category.icon);
  const colors = getCategoryColor(colorIndex);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: !canManage });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const assetSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAssetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = assets.findIndex((a) => a.id === active.id);
      const newIndex = assets.findIndex((a) => a.id === over.id);
      onReorderAssets(arrayMove(assets, oldIndex, newIndex));
    }
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className="border-border/50 bg-card/50"
    >
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {canManage && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="opacity-0 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <div className={`p-2 rounded-lg ${colors.bgColor}`}>
              <Icon className={`h-5 w-5 ${colors.color}`} />
            </div>
            <h3 className="font-bold tracking-wide uppercase">{category.label}</h3>
          </div>
          <div className="flex items-center gap-1">
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-60 hover:opacity-100"
                  onClick={() => onEditSection(category)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onAddAsset(category.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </>
            )}
          </div>
        </div>

        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No {category.label.toLowerCase()} materials yet.
          </p>
        ) : (
          <DndContext
            sensors={assetSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAssetDragEnd}
          >
            <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {assets.map((asset) => (
                  <SortableAssetItem
                    key={asset.id}
                    asset={asset}
                    canManage={canManage}
                    onPlayVideo={onPlayVideo}
                    onEdit={onEditAsset}
                    onDelete={onDeleteAsset}
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
  const queryClient = useQueryClient();
  const { role, isAdmin } = useTeamRole(teamId || "");
  const { teamName, teamLogo } = useOutletContext<TeamContext>() || { teamName: "", teamLogo: null };
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("training");
  const [videoModal, setVideoModal] = useState<TeamAsset | null>(null);
  const [editAsset, setEditAsset] = useState<TeamAsset | null>(null);
  const [localAssets, setLocalAssets] = useState<TeamAsset[]>([]);
  const [localCategories, setLocalCategories] = useState<AssetCategory[]>([]);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<AssetCategory | null>(null);

  // Fetch team categories
  const { data: teamData, isLoading: loadingTeam } = useQuery({
    queryKey: ["team-categories", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("asset_categories")
        .eq("id", teamId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  useEffect(() => {
    if (teamData?.asset_categories) {
      const cats = (teamData.asset_categories as unknown as AssetCategory[]);
      setLocalCategories([...cats].sort((a, b) => a.order_index - b.order_index));
    } else {
      setLocalCategories(DEFAULT_CATEGORIES);
    }
  }, [teamData]);

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

  const handleDeleteAsset = async (asset: TeamAsset) => {
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

  const handleReorderAssets = async (reorderedAssets: TeamAsset[]) => {
    setLocalAssets(prev => {
      const otherAssets = prev.filter(a => a.category !== reorderedAssets[0]?.category);
      return [...otherAssets, ...reorderedAssets];
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
      refetchAssets();
    }
  };

  const handleReorderSections = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex(c => c.id === active.id);
    const newIndex = localCategories.findIndex(c => c.id === over.id);
    
    const reordered = arrayMove(localCategories, oldIndex, newIndex).map((cat, i) => ({
      ...cat,
      order_index: i
    }));
    
    setLocalCategories(reordered);

    try {
      const { error } = await supabase
        .from("teams")
        .update({ asset_categories: JSON.parse(JSON.stringify(reordered)) })
        .eq("id", teamId);
      
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["team-categories", teamId] });
    } catch (error) {
      console.error("Error reordering sections:", error);
      toast.error("Failed to reorder sections");
    }
  };

  const handleSaveSection = async (categoryData: Omit<AssetCategory, "order_index">) => {
    let updatedCategories: AssetCategory[];
    
    if (editingSection) {
      // Update existing
      updatedCategories = localCategories.map(cat => 
        cat.id === editingSection.id 
          ? { ...cat, label: categoryData.label, icon: categoryData.icon }
          : cat
      );
    } else {
      // Add new
      const newCategory: AssetCategory = {
        ...categoryData,
        order_index: localCategories.length
      };
      updatedCategories = [...localCategories, newCategory];
    }
    
    setLocalCategories(updatedCategories);

    try {
      const { error } = await supabase
        .from("teams")
        .update({ asset_categories: JSON.parse(JSON.stringify(updatedCategories)) })
        .eq("id", teamId);
      
      if (error) throw error;
      toast.success(editingSection ? "Section updated" : "Section added");
      queryClient.invalidateQueries({ queryKey: ["team-categories", teamId] });
    } catch (error) {
      console.error("Error saving section:", error);
      toast.error("Failed to save section");
    }
    
    setEditingSection(null);
  };

  const handleDeleteSection = async () => {
    if (!editingSection) return;
    
    const assetsInSection = getAssetsByCategory(editingSection.id);
    if (assetsInSection.length > 0) {
      toast.error(`Cannot delete section with ${assetsInSection.length} assets. Move or delete them first.`);
      return;
    }

    const updatedCategories = localCategories
      .filter(cat => cat.id !== editingSection.id)
      .map((cat, i) => ({ ...cat, order_index: i }));
    
    setLocalCategories(updatedCategories);

    try {
      const { error } = await supabase
        .from("teams")
        .update({ asset_categories: JSON.parse(JSON.stringify(updatedCategories)) })
        .eq("id", teamId);
      
      if (error) throw error;
      toast.success("Section deleted");
      queryClient.invalidateQueries({ queryKey: ["team-categories", teamId] });
    } catch (error) {
      console.error("Error deleting section:", error);
      toast.error("Failed to delete section");
    }
    
    setEditingSection(null);
  };

  const canManage = isAdmin || role === 'offer_owner' || role === 'admin';

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Split categories: first one full width, rest in grid
  const topCategory = localCategories[0];
  const gridCategories = localCategories.slice(1);

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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingSection(null);
                setSectionDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </div>
        )}
      </div>

      {/* Category Sections */}
      {loadingAssets || loadingTeam ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext
          sensors={sectionSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleReorderSections}
        >
          <SortableContext items={localCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {/* First category full width */}
              {topCategory && (
                <SortableCategorySection
                  key={topCategory.id}
                  category={topCategory}
                  colorIndex={0}
                  assets={getAssetsByCategory(topCategory.id)}
                  onPlayVideo={(asset) => setVideoModal(asset)}
                  onAddAsset={openUploadWithCategory}
                  onEditAsset={(asset) => setEditAsset(asset)}
                  onDeleteAsset={handleDeleteAsset}
                  onReorderAssets={handleReorderAssets}
                  onEditSection={(cat) => {
                    setEditingSection(cat);
                    setSectionDialogOpen(true);
                  }}
                  canManage={canManage}
                />
              )}

              {/* Rest in 2-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gridCategories.map((category, idx) => (
                  <SortableCategorySection
                    key={category.id}
                    category={category}
                    colorIndex={idx + 1}
                    assets={getAssetsByCategory(category.id)}
                    onPlayVideo={(asset) => setVideoModal(asset)}
                    onAddAsset={openUploadWithCategory}
                    onEditAsset={(asset) => setEditAsset(asset)}
                    onDeleteAsset={handleDeleteAsset}
                    onReorderAssets={handleReorderAssets}
                    onEditSection={(cat) => {
                      setEditingSection(cat);
                      setSectionDialogOpen(true);
                    }}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Video Modal */}
      {videoModal && (
        <VideoModal asset={videoModal} onClose={() => setVideoModal(null)} />
      )}

      {/* Edit Asset Dialog */}
      {editAsset && (
        <EditAssetDialog
          open={!!editAsset}
          onOpenChange={(open) => !open && setEditAsset(null)}
          asset={editAsset}
          onSuccess={() => refetchAssets()}
        />
      )}

      {/* Section Manager Dialog */}
      <SectionManagerDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        category={editingSection}
        onSave={handleSaveSection}
        onDelete={editingSection ? handleDeleteSection : undefined}
      />

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
