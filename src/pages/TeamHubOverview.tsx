import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Layers, 
  Users, 
  FileText,
  ExternalLink,
  Play,
  ChevronRight,
  Loader2,
  Plus,
  Video,
  FileSpreadsheet,
  Briefcase,
  BookOpen,
  Link as LinkIcon,
  X
} from "lucide-react";
import { useState } from "react";
import AssetUploadDialog from "@/components/AssetUploadDialog";

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

// Category Section Component
function CategorySection({ 
  category, 
  assets, 
  onPlayVideo,
  onAddAsset,
  canManage
}: { 
  category: typeof CATEGORY_CONFIG[string] & { id: string };
  assets: TeamAsset[];
  onPlayVideo: (asset: TeamAsset) => void;
  onAddAsset: (categoryId: string) => void;
  canManage: boolean;
}) {
  const Icon = category.icon;

  const isVideo = (asset: TeamAsset) => {
    const url = asset.loom_url || asset.external_url || "";
    return getVideoEmbedUrl(url) !== null;
  };

  const handleAssetClick = (asset: TeamAsset) => {
    if (isVideo(asset)) {
      onPlayVideo(asset);
    } else if (asset.external_url) {
      window.open(asset.external_url, "_blank");
    } else if (asset.loom_url) {
      window.open(asset.loom_url, "_blank");
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
          <div className="space-y-1">
            {assets.map((asset) => {
              const videoAsset = isVideo(asset);
              return (
                <div
                  key={asset.id}
                  className="group flex items-center gap-3 py-2.5 px-2 cursor-pointer hover:bg-muted/40 rounded-lg transition-all"
                  onClick={() => handleAssetClick(asset)}
                >
                  {videoAsset ? (
                    <Play className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {asset.title}
                  </span>
                  {videoAsset && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 opacity-60 group-hover:opacity-100">
                      VIDEO
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
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
        .order("order_index", { ascending: true });
      
      if (error) throw error;
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
    return (assets || []).filter(a => a.category === categoryId);
  };

  const openUploadWithCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setUploadDialogOpen(true);
  };

  const canManage = isAdmin || role === 'offer_owner' || role === 'admin';

  // Categories in display order
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
