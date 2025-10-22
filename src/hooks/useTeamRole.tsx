import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useTeamRole(teamId: string | undefined) {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !teamId) {
      setLoading(false);
      return;
    }

    const loadRole = async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setRole(data?.role || null);
      } catch (error) {
        console.error('Error loading user role:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, [user, teamId]);

  return { role, loading, isOwner: role === 'owner' || role === 'offer_owner' };
}
