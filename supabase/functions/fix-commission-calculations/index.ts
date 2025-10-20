import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all sales with their current values
    const { data: sales, error: fetchError } = await supabaseClient
      .from('sales')
      .select('id, revenue, setter, commission, setter_commission');

    if (fetchError) throw fetchError;

    console.log(`Found ${sales?.length || 0} sales to process`);

    let fixed = 0;
    let skipped = 0;

    // Recalculate commissions for each sale
    for (const sale of sales || []) {
      const revenue = Number(sale.revenue) || 0;
      const correctCloserCommission = revenue * 0.10; // 10%
      const correctSetterCommission = sale.setter && sale.setter !== 'No Setter' ? revenue * 0.05 : 0; // 5%

      // Check if commissions need fixing (allowing small floating point differences)
      const needsFix = 
        Math.abs((sale.commission || 0) - correctCloserCommission) > 0.01 ||
        Math.abs((sale.setter_commission || 0) - correctSetterCommission) > 0.01;

      if (needsFix) {
        const { error: updateError } = await supabaseClient
          .from('sales')
          .update({
            commission: correctCloserCommission,
            setter_commission: correctSetterCommission,
          })
          .eq('id', sale.id);

        if (updateError) {
          console.error(`Error updating sale ${sale.id}:`, updateError);
        } else {
          fixed++;
          console.log(`Fixed sale ${sale.id}: revenue=${revenue}, closer=${correctCloserCommission}, setter=${correctSetterCommission}`);
        }
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Commission fix complete: ${fixed} sales updated, ${skipped} already correct`,
        details: {
          total: sales?.length || 0,
          fixed,
          skipped,
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fixing commissions:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});