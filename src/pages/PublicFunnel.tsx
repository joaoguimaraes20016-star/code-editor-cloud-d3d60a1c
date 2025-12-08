import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FunnelRenderer } from '@/components/funnel-public/FunnelRenderer';

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: Record<string, any>;
}

interface FunnelSettings {
  logo_url?: string;
  primary_color: string;
  background_color: string;
  button_text: string;
  ghl_webhook_url?: string;
}

interface Funnel {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  settings: FunnelSettings;
}

export default function PublicFunnel() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  
  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');

  const { data: funnel, isLoading: funnelLoading, error: funnelError } = useQuery({
    queryKey: ['public-funnel', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return { ...data, settings: data.settings as unknown as FunnelSettings } as Funnel;
    },
    enabled: !!slug,
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ['public-funnel-steps', funnel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_steps')
        .select('*')
        .eq('funnel_id', funnel!.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as FunnelStep[];
    },
    enabled: !!funnel?.id,
  });

  if (funnelLoading || stepsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (funnelError || !funnel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Funnel Not Found</h1>
          <p className="text-white/60">This funnel doesn't exist or is not published</p>
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Funnel Empty</h1>
          <p className="text-white/60">This funnel has no steps configured</p>
        </div>
      </div>
    );
  }

  return (
    <FunnelRenderer
      funnel={funnel}
      steps={steps}
      utmSource={utmSource}
      utmMedium={utmMedium}
      utmCampaign={utmCampaign}
    />
  );
}
