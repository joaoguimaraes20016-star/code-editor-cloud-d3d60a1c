import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, ExternalLink, Edit, Trash2, Copy, Users, Search, 
  LayoutGrid, List, Link2, MoreHorizontal, Star, BarChart3,
  MessageSquare, Calendar, Download, TrendingUp, TrendingDown,
  Phone, Mail, CheckCircle, ArrowLeft, Globe, Plug
} from 'lucide-react';
import { DomainsSection } from '@/components/funnel-builder/DomainsSection';
import { IntegrationsSection } from '@/components/funnel-builder/IntegrationsSection';
import { toast } from '@/hooks/use-toast';
import { CreateFunnelDialog } from '@/components/funnel-builder/CreateFunnelDialog';
import { useTeamRole } from '@/hooks/useTeamRole';
import { format, formatDistanceToNow, subDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { generateCSV, downloadCSV, FUNNEL_LEAD_COLUMNS, CONTACT_COLUMNS } from '@/lib/csvExport';
import { FunnelDropOffChart } from '@/components/funnel-analytics/FunnelDropOffChart';
import { LeadsVsVisitorsChart } from '@/components/funnel-analytics/LeadsVsVisitorsChart';
import { ExpandableLeadRow } from '@/components/funnel-analytics/ExpandableLeadRow';
import { ContactDetailDrawer } from '@/components/funnel-analytics/ContactDetailDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Funnel {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  settings: {
    logo_url?: string;
    primary_color: string;
    background_color: string;
    button_text: string;
  };
  created_at: string;
  updated_at: string;
  lead_count?: number;
}

interface FunnelLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  opt_in_status: boolean | null;
  calendly_booking_data: any;
  created_at: string;
  answers: Record<string, any>;
  last_step_index: number | null;
  funnel: { name: string; id: string } | null;
}

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: { headline?: string; question?: string };
  funnel_id: string;
}

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  opt_in: boolean;
  source: string | null;
  calendly_booked_at: string | null;
  custom_fields: Record<string, any> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

type TabType = 'funnels' | 'performance' | 'contacts' | 'domains' | 'integrations';
type ViewMode = 'grid' | 'list';

export default function FunnelList() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useTeamRole(teamId);
  
  const [activeTab, setActiveTab] = useState<TabType>('funnels');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Fetch funnels with lead counts
  const { data: funnels, isLoading: funnelsLoading } = useQuery({
    queryKey: ['funnels', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('team_id', teamId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const funnelsWithCounts = await Promise.all(
        (data || []).map(async (funnel) => {
          const { count } = await supabase
            .from('funnel_leads')
            .select('*', { count: 'exact', head: true })
            .eq('funnel_id', funnel.id);

          return {
            ...funnel,
            settings: funnel.settings as unknown as Funnel['settings'],
            lead_count: count || 0,
          } as Funnel;
        })
      );

      return funnelsWithCounts;
    },
    enabled: !!teamId,
  });

  // Fetch leads for performance and contacts
  const { data: leads } = useQuery({
    queryKey: ['funnel-leads', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_leads')
        .select('*, funnel:funnels(name, id)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FunnelLead[];
    },
    enabled: !!teamId,
  });

  // Fetch all funnel steps for drop-off analytics
  const { data: allSteps } = useQuery({
    queryKey: ['funnel-steps', teamId],
    queryFn: async () => {
      if (!funnels?.length) return [];
      
      const funnelIds = funnels.map(f => f.id);
      const { data, error } = await supabase
        .from('funnel_steps')
        .select('*')
        .in('funnel_id', funnelIds)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as FunnelStep[];
    },
    enabled: !!funnels?.length,
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!teamId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (funnelId: string) => {
      const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', funnelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels', teamId] });
      toast({ title: 'Funnel deleted' });
      setFunnelToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete funnel', description: error.message, variant: 'destructive' });
    },
  });

  const copyFunnelUrl = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copied to clipboard' });
  };

  // Helper: A "real lead" has ALL THREE: name + phone + email
  const isRealLead = (lead: FunnelLead) => !!(lead.name && lead.phone && lead.email);
  
  // Calculate performance stats with real percentage changes
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const twoDaysAgo = startOfDay(subDays(now, 2));
  const weekAgo = subDays(now, 7);
  const twoWeeksAgo = subDays(now, 14);
  const monthAgo = subDays(now, 30);
  const twoMonthsAgo = subDays(now, 60);

  // Filter to only real leads (name + phone + email)
  const realLeads = leads?.filter(isRealLead) || [];
  
  // Current period - REAL LEADS only
  const todayLeads = realLeads.filter(l => new Date(l.created_at) >= todayStart).length;
  const weekLeads = realLeads.filter(l => new Date(l.created_at) >= weekAgo).length;
  const monthLeads = realLeads.filter(l => new Date(l.created_at) >= monthAgo).length;
  const totalLeads = realLeads.length;

  // Visitors (started but not real leads)
  const totalVisitors = (leads?.length || 0) - realLeads.length;
  const todayVisitors = (leads?.filter(l => new Date(l.created_at) >= todayStart).length || 0) - todayLeads;
  const weekVisitors = (leads?.filter(l => new Date(l.created_at) >= weekAgo).length || 0) - weekLeads;

  // Previous period leads for comparison (real leads only)
  const yesterdayLeads = realLeads.filter(l => {
    const date = new Date(l.created_at);
    return date >= twoDaysAgo && date < yesterdayStart;
  }).length;
  
  const previousWeekLeads = realLeads.filter(l => {
    const date = new Date(l.created_at);
    return date >= twoWeeksAgo && date < weekAgo;
  }).length;
  
  const previousMonthLeads = realLeads.filter(l => {
    const date = new Date(l.created_at);
    return date >= twoMonthsAgo && date < monthAgo;
  }).length;

  // Calculate percentage changes
  const calcPercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const todayChange = calcPercentChange(todayLeads, yesterdayLeads);
  const weekChange = calcPercentChange(weekLeads, previousWeekLeads);
  const monthChange = calcPercentChange(monthLeads, previousMonthLeads);
  
  // Conversion rate: real leads / total visitors
  const conversionRate = leads?.length ? Math.round((realLeads.length / leads.length) * 100) : 0;

  const optedInContacts = contacts?.filter(c => c.opt_in).length || 0;
  const bookedContacts = contacts?.filter(c => c.calendly_booked_at).length || 0;

  // Filter funnels by search
  const filteredFunnels = funnels?.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export functions
  const exportLeads = () => {
    if (!leads?.length) return;
    const csv = generateCSV(leads, FUNNEL_LEAD_COLUMNS);
    downloadCSV(csv, `funnel-leads-${format(now, 'yyyy-MM-dd')}.csv`);
    toast({ title: 'Leads exported' });
  };

  const exportContacts = () => {
    if (!contacts?.length) return;
    const csv = generateCSV(contacts, CONTACT_COLUMNS);
    downloadCSV(csv, `contacts-${format(now, 'yyyy-MM-dd')}.csv`);
    toast({ title: 'Contacts exported' });
  };

  const tabs = [
    { id: 'funnels' as const, label: 'Funnels', icon: LayoutGrid },
    { id: 'performance' as const, label: 'Performance', icon: BarChart3 },
    { id: 'contacts' as const, label: 'Contacts', icon: Users },
    { id: 'domains' as const, label: 'Domains', icon: Globe },
    { id: 'integrations' as const, label: 'Integrations', icon: Plug },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-3">
            {/* Back Button */}
            <button
              onClick={() => navigate(`/team/${teamId}/dashboard`)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Dashboard</span>
            </button>
            
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Spacer for balance */}
            <div className="w-24" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Funnels Tab */}
        {activeTab === 'funnels' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-foreground">All Funnels</h1>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search funnels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-l-lg transition-colors",
                      viewMode === 'list' ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 rounded-r-lg transition-colors",
                      viewMode === 'grid' ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                
                {isAdmin && (
                  <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-500 hover:bg-blue-600">
                    <Plus className="h-4 w-4 mr-2" />
                    New Funnel
                  </Button>
                )}
              </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredFunnels?.map((funnel) => (
                  <div
                    key={funnel.id}
                    className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => navigate(`/team/${teamId}/funnels/${funnel.id}`)}
                  >
                    {/* Thumbnail */}
                    <div 
                      className="aspect-video flex items-center justify-center relative"
                      style={{ backgroundColor: funnel.settings.background_color || '#1a1a2e' }}
                    >
                      {funnel.settings.logo_url ? (
                        <img 
                          src={funnel.settings.logo_url} 
                          alt={funnel.name}
                          className="max-w-[60%] max-h-[60%] object-contain"
                        />
                      ) : (
                        <span className="text-white/50 text-lg font-bold">{funnel.name.charAt(0)}</span>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); }}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-1 truncate">{funnel.name}</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Last edited {formatDistanceToNow(new Date(funnel.updated_at), { addSuffix: true })}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyFunnelUrl(funnel.slug); }}
                            className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                          >
                            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              funnel.status === 'published' 
                                ? "border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" 
                                : "border-muted"
                            )}
                          >
                            {funnel.status === 'published' ? 'Live' : 'Draft'}
                          </Badge>
                          
                          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-500/10">
                            {funnel.lead_count} {funnel.lead_count === 1 ? 'Contact' : 'Contacts'}
                          </Badge>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1 rounded hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/team/${teamId}/funnels/${funnel.id}`)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {funnel.status === 'published' && (
                              <DropdownMenuItem onClick={() => window.open(`/f/${funnel.slug}`, '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-2" /> View Live
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => copyFunnelUrl(funnel.slug)}>
                              <Copy className="h-4 w-4 mr-2" /> Copy URL
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem 
                                onClick={() => setFunnelToDelete(funnel)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Name</TableHead>
                      <TableHead>Favorite</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead className="w-[200px]">Progress</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFunnels?.map((funnel) => (
                      <TableRow 
                        key={funnel.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/team/${teamId}/funnels/${funnel.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                              style={{ backgroundColor: funnel.settings.background_color || '#1a1a2e' }}
                            >
                              {funnel.settings.logo_url ? (
                                <img src={funnel.settings.logo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white/50 text-sm font-bold">{funnel.name.charAt(0)}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{funnel.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Last updated {formatDistanceToNow(new Date(funnel.updated_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button className="text-amber-400 hover:text-amber-500">
                            <Star className="h-4 w-4" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                funnel.status === 'published' 
                                  ? "border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" 
                                  : "border-muted"
                              )}
                            >
                              {funnel.status === 'published' ? 'Live' : 'Draft'}
                            </Badge>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyFunnelUrl(funnel.slug); }}
                              className="p-1 rounded hover:bg-muted"
                            >
                              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {funnel.lead_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (funnel.lead_count || 0) * 5)}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/team/${teamId}/funnels/${funnel.id}`)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              {funnel.status === 'published' && (
                                <DropdownMenuItem onClick={() => window.open(`/f/${funnel.slug}`, '_blank')}>
                                  <ExternalLink className="h-4 w-4 mr-2" /> View Live
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <DropdownMenuItem 
                                  onClick={() => setFunnelToDelete(funnel)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredFunnels?.length === 0 && !funnelsLoading && (
              <div className="text-center py-16 text-muted-foreground">
                <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No funnels yet</h3>
                <p className="mb-4">Create your first funnel to start capturing leads</p>
                {isAdmin && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Funnel
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-foreground">Performance</h1>
              <div className="flex items-center gap-3">
                <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Funnels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Funnels</SelectItem>
                    {funnels?.map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>{funnel.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportLeads} disabled={!leads?.length}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Leads
                </Button>
              </div>
            </div>

            {/* Perspective-style Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-1">Today</p>
                <p className="text-2xl font-semibold">{todayLeads} Leads</p>
                <p className="text-sm mt-2 flex items-center gap-1">
                  {todayChange !== 0 ? (
                    <>
                      {todayChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={todayChange > 0 ? "text-emerald-500" : "text-red-500"}>
                        {todayChange > 0 ? '+' : ''}{todayChange}%
                      </span>
                    </>
                  ) : yesterdayLeads === 0 && todayLeads > 0 ? (
                    <span className="text-emerald-500">New</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-muted-foreground">vs. yesterday</span>
                </p>
              </div>
              
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-1">Last 7 days</p>
                <p className="text-2xl font-semibold">{weekLeads} Leads</p>
                <p className="text-sm mt-2 flex items-center gap-1">
                  {weekChange !== 0 ? (
                    <>
                      {weekChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={weekChange > 0 ? "text-emerald-500" : "text-red-500"}>
                        {weekChange > 0 ? '+' : ''}{weekChange}%
                      </span>
                    </>
                  ) : previousWeekLeads === 0 && weekLeads > 0 ? (
                    <span className="text-emerald-500">New</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-muted-foreground">vs. prev 7 days</span>
                </p>
              </div>
              
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-1">Last 30 days</p>
                <p className="text-2xl font-semibold">{monthLeads} Leads</p>
                <p className="text-sm mt-2 flex items-center gap-1">
                  {monthChange !== 0 ? (
                    <>
                      {monthChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={monthChange > 0 ? "text-emerald-500" : "text-red-500"}>
                        {monthChange > 0 ? '+' : ''}{monthChange}%
                      </span>
                    </>
                  ) : previousMonthLeads === 0 && monthLeads > 0 ? (
                    <span className="text-emerald-500">New</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-muted-foreground">vs. prev 30 days</span>
                </p>
              </div>
              
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Leads</p>
                <p className="text-2xl font-semibold">{totalLeads}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {totalVisitors} visitors
                </p>
              </div>
              
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-1">Conversion Rate</p>
                <p className="text-2xl font-semibold">{conversionRate}%</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Visitors to leads
                </p>
              </div>
            </div>

            {/* Leads vs Visitors Chart */}
            {leads && leads.length > 0 && (
              <div className="mb-8">
                <LeadsVsVisitorsChart 
                  leads={selectedFunnelId === 'all' 
                    ? leads 
                    : leads.filter(l => l.funnel?.id === selectedFunnelId)
                  }
                  selectedFunnelId={selectedFunnelId}
                />
              </div>
            )}

            {/* Drop-off Analytics - Only when specific funnel selected */}
            {selectedFunnelId !== 'all' && allSteps && leads && (
              <div className="mb-8">
                <FunnelDropOffChart 
                  steps={allSteps.filter(s => s.funnel_id === selectedFunnelId)}
                  leads={leads.filter(l => l.funnel?.id === selectedFunnelId)}
                  funnelName={funnels?.find(f => f.id === selectedFunnelId)?.name || ''}
                />
              </div>
            )}

            {/* Recent Leads Table - Only REAL leads (name + phone + email) */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Recent Leads</h2>
                <p className="text-sm text-muted-foreground">Only showing leads with complete contact info (name, phone, email)</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Funnel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedFunnelId === 'all' ? realLeads : realLeads.filter(l => l.funnel?.id === selectedFunnelId))
                    .slice(0, 20)
                    .map((lead) => (
                      <ExpandableLeadRow 
                        key={lead.id} 
                        lead={lead} 
                        steps={allSteps?.filter(s => s.funnel_id === lead.funnel?.id)}
                      />
                    ))}
                </TableBody>
              </Table>
              {!realLeads.length && (
                <div className="text-center py-12 text-muted-foreground">
                  No leads captured yet. Leads require name, phone, and email.
                </div>
              )}
            </div>
          </>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
              <Button variant="outline" onClick={exportContacts} disabled={!contacts?.length}>
                <Download className="h-4 w-4 mr-2" />
                Export to CRM
              </Button>
            </div>

            {/* Contact Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-card border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Contacts</p>
                    <p className="text-2xl font-bold">{contacts?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Opted In</p>
                    <p className="text-2xl font-bold">{optedInContacts}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-500/10">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">With Form Responses</p>
                    <p className="text-2xl font-bold">
                      {contacts?.filter(c => c.custom_fields && Object.keys(c.custom_fields).length > 0).length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts Table */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Opt-In</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts?.map((contact) => (
                    <TableRow 
                      key={contact.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedContact(contact)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {contact.name?.charAt(0)?.toUpperCase() || contact.email?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{contact.name || '—'}</p>
                            {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Object.keys(contact.custom_fields).length} response{Object.keys(contact.custom_fields).length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.email ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {contact.email}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {contact.source?.replace('Funnel: ', '') || 'Direct'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contact.opt_in ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/50 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!contacts?.length && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No contacts yet</p>
                  <p className="text-sm mt-1">Contacts will appear here when leads submit your funnels</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Contact Detail Drawer */}
        <ContactDetailDrawer 
          contact={selectedContact}
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
        />

        {/* Domains Tab */}
        {activeTab === 'domains' && (
          <DomainsSection teamId={teamId!} />
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <IntegrationsSection teamId={teamId!} />
        )}
      </div>

      <CreateFunnelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        teamId={teamId!}
        onSuccess={(funnelId) => {
          setShowCreateDialog(false);
          navigate(`/team/${teamId}/funnels/${funnelId}`);
        }}
      />

      <AlertDialog open={!!funnelToDelete} onOpenChange={() => setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Funnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{funnelToDelete?.name}"? This will also delete all leads captured by this funnel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => funnelToDelete && deleteMutation.mutate(funnelToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
