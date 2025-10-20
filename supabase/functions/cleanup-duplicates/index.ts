import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teamId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all duplicate sales
    const { data: allSales, error: fetchError } = await supabase
      .from('sales')
      .select('id, customer_name, date, sales_rep, setter, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    // Normalize name for comparison (remove case sensitivity and partial matches)
    const normalizeName = (name: string) => {
      if (!name) return '';
      const lower = name.toLowerCase().trim();
      // Map common variations to full names
      if (lower.includes('jaxon')) return 'jaxon';
      if (lower.includes('isai')) return 'isai';
      return lower;
    };

    // Group by customer_name, date, and normalized sales_rep - keep only the one with the longest name (most complete)
    const groups = new Map<string, any[]>();

    for (const sale of allSales || []) {
      const normalizedRep = normalizeName(sale.sales_rep);
      const key = `${sale.customer_name.toLowerCase().trim()}-${sale.date}-${normalizedRep}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(sale);
    }

    // For each group, keep the sale with the longest sales_rep name (most complete) and delete the rest
    const duplicateIds: string[] = [];

    for (const [key, salesInGroup] of groups) {
      if (salesInGroup.length > 1) {
        // Sort by sales_rep name length (descending) and created_at (ascending)
        salesInGroup.sort((a, b) => {
          const lenDiff = b.sales_rep.length - a.sales_rep.length;
          if (lenDiff !== 0) return lenDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        // Keep the first one (longest name, earliest created), delete the rest
        for (let i = 1; i < salesInGroup.length; i++) {
          duplicateIds.push(salesInGroup[i].id);
        }
      }
    }

    console.log(`Found ${duplicateIds.length} duplicates to delete`);

    // Delete duplicates in batches
    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) throw deleteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: duplicateIds.length,
        remainingCount: groups.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
