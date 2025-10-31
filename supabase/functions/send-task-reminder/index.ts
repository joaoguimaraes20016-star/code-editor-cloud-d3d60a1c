import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderRequest {
  userId: string;
  userName: string;
  userEmail: string;
  overdueCount: number;
  teamId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, userName, userEmail, overdueCount, teamId }: ReminderRequest = await req.json();

    console.log(`Sending reminder to ${userName} (${userEmail}) about ${overdueCount} overdue tasks`);

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    // Get overdue tasks details
    const { data: overdueTasks } = await supabase
      .from('confirmation_tasks')
      .select('*, appointment:appointments(*)')
      .eq('assigned_to', userId)
      .eq('status', 'pending')
      .lt('created_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    // For now, just log the reminder (you can integrate with Resend or another email service)
    console.log('Reminder details:', {
      to: userEmail,
      subject: `⚠️ You have ${overdueCount} overdue tasks`,
      tasks: overdueTasks?.map(t => ({
        lead: t.appointment?.lead_name,
        created: t.created_at,
        type: t.task_type
      }))
    });

    // You can add email sending here using Resend:
    // const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    // await resend.emails.send({
    //   from: 'Team <noreply@yourdomain.com>',
    //   to: userEmail,
    //   subject: `⚠️ You have ${overdueCount} overdue tasks`,
    //   html: generateReminderEmail(userName, overdueCount, overdueTasks, team?.name)
    // });

    return new Response(
      JSON.stringify({ success: true, message: 'Reminder sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending reminder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
