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
      .select('auto_create_tasks, confirmation_schedule, confirmation_flow_config, minimum_booking_notice_hours, fallback_confirmation_minutes')
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

    // Get confirmation schedule and fallback settings
    const schedule = teamSettings?.confirmation_schedule || [
      {sequence: 1, hours_before: 24, label: "24h Before"},
      {sequence: 2, hours_before: 1, label: "1h Before"},
      {sequence: 3, hours_before: 0.17, label: "10min Before"}
    ];

    const minimumBookingNoticeHours = teamSettings?.minimum_booking_notice_hours ?? 24;
    const fallbackConfirmationMinutes = teamSettings?.fallback_confirmation_minutes ?? 60;

    const now = new Date();
    const appointmentTime = new Date(appointment.start_at_utc);
    const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let dueAt: Date;
    let usedFallback = false;

    // Check if this is a last-minute booking
    if (hoursUntilAppointment < minimumBookingNoticeHours) {
      console.log(`Last-minute booking detected (${hoursUntilAppointment.toFixed(1)}h notice < ${minimumBookingNoticeHours}h minimum)`);
      
      // Use fallback: create single task due X minutes before appointment
      const fallbackDueAt = new Date(appointmentTime.getTime() - (fallbackConfirmationMinutes * 60 * 1000));
      
      // Only use fallback if it's still in the future
      if (fallbackDueAt > now) {
        dueAt = fallbackDueAt;
        usedFallback = true;
        console.log(`Using fallback: task due at ${dueAt.toISOString()}`);
      } else {
        // If even fallback is too late, create immediate task
        dueAt = now;
        usedFallback = true;
        console.log(`Fallback window passed, creating immediate task`);
      }
    } else {
      // Normal schedule: use first confirmation window
      const firstWindow = schedule[0];
      dueAt = new Date(appointmentTime.getTime() - (firstWindow.hours_before * 60 * 60 * 1000));
      console.log(`Using normal schedule: task due at ${dueAt.toISOString()}`);
    }

    // Determine assignment based on confirmation flow config
    const confirmationFlowConfig = teamSettings?.confirmation_flow_config || [];
    const firstConfirmation = Array.isArray(confirmationFlowConfig) && confirmationFlowConfig.length > 0 
      ? confirmationFlowConfig[0] 
      : null;
    
    let assignedTo = null;
    let assignedRole = 'setter'; // default role
    let routingMode = 'round_robin'; // default mode

    // Get assignment settings from first confirmation step
    if (firstConfirmation) {
      assignedRole = firstConfirmation.assigned_role || 'setter';
      routingMode = firstConfirmation.assignment_mode || 'round_robin';
      
      // If individual assignment mode, use the specified user
      if (routingMode === 'individual' && firstConfirmation.assigned_user_id) {
        assignedTo = firstConfirmation.assigned_user_id;
        console.log(`Using individual assignment to user: ${assignedTo}`);
      }
    }

    // If not individual assignment or no user specified, use round-robin
    if (!assignedTo && routingMode === 'round_robin' && assignedRole !== 'off') {
      // Get active team members for the assigned role
      const { data: activeMembers, error: membersError } = await supabaseClient
        .from('team_members')
        .select('user_id')
        .eq('team_id', appointment.team_id)
        .eq('role', assignedRole)
        .eq('is_active', true);

      if (membersError) throw membersError;

      if (activeMembers && activeMembers.length > 0) {
        // Get task counts for each active member
        const { data: taskCounts, error: countError } = await supabaseClient
          .from('confirmation_tasks')
          .select('assigned_to')
          .eq('team_id', appointment.team_id)
          .eq('status', 'pending')
          .in('assigned_to', activeMembers.map(m => m.user_id));

        if (countError) throw countError;

        // Count tasks per member
        const counts: Record<string, number> = {};
        activeMembers.forEach(member => {
          counts[member.user_id] = 0;
        });
        taskCounts?.forEach(task => {
          if (task.assigned_to) {
            counts[task.assigned_to] = (counts[task.assigned_to] || 0) + 1;
          }
        });

        // Assign to member with fewest tasks
        assignedTo = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
        console.log(`Round-robin assignment to ${assignedRole}: ${assignedTo}`);
      }
    }

  // Check if task already exists for this appointment (idempotency)
  const { data: existingTask, error: existingTaskError } = await supabaseClient
    .from('confirmation_tasks')
    .select('id')
    .eq('appointment_id', appointment.id)
    .eq('task_type', 'call_confirmation')
    .maybeSingle();

  if (existingTaskError) {
    console.error('Error checking for existing task:', existingTaskError);
  }

  if (existingTask) {
    console.log('Task already exists for appointment:', appointment.id, '- skipping creation');
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'Task already exists' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create the task
  const taskData: any = {
    team_id: appointment.team_id,
    appointment_id: appointment.id,
    status: 'pending',
    required_confirmations: usedFallback ? 1 : schedule.length, // Only 1 confirmation for fallback
    confirmation_sequence: 1,
    due_at: dueAt.toISOString(),
    confirmation_attempts: [],
    completed_confirmations: 0,
    is_overdue: false
  };

  if (assignedTo) {
    taskData.assigned_to = assignedTo;
    taskData.assigned_role = assignedRole;
    taskData.routing_mode = routingMode;
    taskData.assigned_at = new Date().toISOString();
    taskData.auto_return_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }

  const { error: taskError } = await supabaseClient
    .from('confirmation_tasks')
    .insert(taskData);

  if (taskError) {
    // If it's a duplicate key error, log it but don't fail
    if (taskError.code === '23505') {
      console.log('Task already exists (caught duplicate key error) - this is okay');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented by constraint' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    throw taskError;
  }

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('activity_logs')
      .insert({
        team_id: appointment.team_id,
        appointment_id: appointment.id,
        actor_id: null,
        actor_name: 'System',
        action_type: 'Created',
        note: usedFallback 
          ? `Last-minute booking fallback: task due ${fallbackConfirmationMinutes}min before appointment`
          : (assignedTo 
            ? `Task auto-assigned to ${assignedRole} via ${routingMode === 'individual' ? 'individual assignment' : 'round-robin'}` 
            : 'Task created in queue')
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
