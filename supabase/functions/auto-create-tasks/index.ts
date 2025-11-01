import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();
    const appointment = record;

    console.log('Processing new appointment:', appointment.id);

    // Check if team has auto_create_tasks enabled (defaults to true if not set)
    const { data: teamSettings, error: teamError } = await supabaseClient
      .from('teams')
      .select('auto_create_tasks, confirmation_schedule')
      .eq('id', appointment.team_id)
      .single();

    if (teamError) {
      console.error('Error fetching team settings:', teamError);
    }

    // If auto_create_tasks is explicitly disabled, skip task creation
    if (teamSettings && teamSettings.auto_create_tasks === false) {
      console.log('Auto-create tasks disabled for team, skipping task creation');
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get confirmation schedule
    const schedule = teamSettings?.confirmation_schedule || [
      {sequence: 1, hours_before: 24, label: "24h Before"},
      {sequence: 2, hours_before: 1, label: "1h Before"},
      {sequence: 3, hours_before: 0.17, label: "10min Before"}
    ];

    const firstWindow = schedule[0];

    // Calculate due_at for first confirmation window
    const appointmentTime = new Date(appointment.start_at_utc);
    const dueAt = new Date(appointmentTime.getTime() - (firstWindow.hours_before * 60 * 60 * 1000));

    // Get active setters for this team
    const { data: activeSetters, error: settersError } = await supabaseClient
      .from('team_members')
      .select('user_id')
      .eq('team_id', appointment.team_id)
      .eq('role', 'setter')
      .eq('is_active', true);

    if (settersError) throw settersError;

    let assignedTo = null;

    if (activeSetters && activeSetters.length > 0) {
      // Get task counts for each active setter
      const { data: taskCounts, error: countError } = await supabaseClient
        .from('confirmation_tasks')
        .select('assigned_to')
        .eq('team_id', appointment.team_id)
        .eq('status', 'pending')
        .in('assigned_to', activeSetters.map(s => s.user_id));

      if (countError) throw countError;

      // Count tasks per setter
      const counts: Record<string, number> = {};
      activeSetters.forEach(setter => {
        counts[setter.user_id] = 0;
      });
      taskCounts?.forEach(task => {
        if (task.assigned_to) {
          counts[task.assigned_to] = (counts[task.assigned_to] || 0) + 1;
        }
      });

      // Assign to setter with fewest tasks
      assignedTo = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
    }

    // Create the task
    const taskData: any = {
      team_id: appointment.team_id,
      appointment_id: appointment.id,
      status: 'pending',
      required_confirmations: schedule.length,
      confirmation_sequence: 1,
      due_at: dueAt.toISOString(),
      confirmation_attempts: [],
      completed_confirmations: 0,
      is_overdue: false
    };

    if (assignedTo) {
      taskData.assigned_to = assignedTo;
      taskData.assigned_at = new Date().toISOString();
      taskData.auto_return_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    }

    const { error: taskError } = await supabaseClient
      .from('confirmation_tasks')
      .insert(taskData);

    if (taskError) throw taskError;

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('activity_logs')
      .insert({
        team_id: appointment.team_id,
        appointment_id: appointment.id,
        actor_id: null,
        actor_name: 'System',
        action_type: 'Created',
        note: assignedTo ? 'Task auto-assigned via round-robin' : 'Task created in queue'
      });

    if (activityError) console.error('Error logging activity:', activityError);

    console.log('Task created successfully for appointment:', appointment.id);

    // Check for upcoming MRR renewals (within next 7 days)
    console.log('Checking for upcoming MRR renewals...');
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysDate = sevenDaysFromNow.toISOString().split('T')[0];

    const { data: upcomingRenewals, error: renewalsError } = await supabaseClient
      .from('mrr_schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_renewal_date', sevenDaysDate)
      .gte('next_renewal_date', today);

    if (renewalsError) {
      console.error('Error fetching MRR schedules:', renewalsError);
    } else if (upcomingRenewals && upcomingRenewals.length > 0) {
      console.log(`Found ${upcomingRenewals.length} upcoming MRR renewals`);
      
      for (const schedule of upcomingRenewals) {
        // Check if task already exists for this due date
        const { data: existingTask } = await supabaseClient
          .from('mrr_follow_up_tasks')
          .select('id')
          .eq('mrr_schedule_id', schedule.id)
          .eq('due_date', schedule.next_renewal_date)
          .maybeSingle();
        
        if (!existingTask) {
          console.log(`Creating MRR follow-up task for schedule ${schedule.id}`);
          
          const { error: taskError } = await supabaseClient
            .from('mrr_follow_up_tasks')
            .insert({
              team_id: schedule.team_id,
              mrr_schedule_id: schedule.id,
              due_date: schedule.next_renewal_date,
              status: 'due'
            });
          
          if (taskError) {
            console.error('Error creating MRR task:', taskError);
          } else {
            console.log(`MRR task created successfully for ${schedule.client_name}`);
            
            // Log activity
            await supabaseClient.from('activity_logs').insert({
              team_id: schedule.team_id,
              appointment_id: schedule.appointment_id,
              actor_name: 'System',
              action_type: 'MRR Task Created',
              note: `Follow-up task created for renewal on ${schedule.next_renewal_date}`
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
