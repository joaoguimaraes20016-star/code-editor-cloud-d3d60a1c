
-- Update auto_assign_unassigned_tasks to respect confirmation_flow_config
CREATE OR REPLACE FUNCTION auto_assign_unassigned_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record RECORD;
  team_config JSONB;
  target_role TEXT;
  active_member_id uuid;
BEGIN
  -- Loop through all unassigned pending tasks
  FOR task_record IN
    SELECT ct.id, ct.team_id, ct.appointment_id, ct.assigned_role
    FROM confirmation_tasks ct
    WHERE ct.assigned_to IS NULL
      AND ct.status = 'pending'
    ORDER BY ct.created_at ASC
  LOOP
    -- Get the target role - either from task's assigned_role or from team config
    IF task_record.assigned_role IS NOT NULL AND task_record.assigned_role != '' THEN
      target_role := task_record.assigned_role;
    ELSE
      -- Get team's confirmation_flow_config
      SELECT confirmation_flow_config INTO team_config
      FROM teams
      WHERE id = task_record.team_id;
      
      -- Get the assigned_role from first confirmation step, default to 'setter'
      IF team_config IS NOT NULL AND jsonb_array_length(team_config) > 0 THEN
        target_role := COALESCE(team_config->0->>'assigned_role', 'setter');
      ELSE
        target_role := 'setter';
      END IF;
    END IF;
    
    -- Skip if role is 'off'
    IF target_role = 'off' THEN
      CONTINUE;
    END IF;

    -- Find the team member with that role who has the fewest pending tasks
    SELECT tm.user_id INTO active_member_id
    FROM team_members tm
    WHERE tm.team_id = task_record.team_id
      AND tm.role = target_role
      AND tm.is_active = true
    ORDER BY (
      SELECT COUNT(*)
      FROM confirmation_tasks ct2
      WHERE ct2.team_id = task_record.team_id
        AND ct2.assigned_to = tm.user_id
        AND ct2.status = 'pending'
    ) ASC
    LIMIT 1;

    -- If we found a member, assign the task
    IF active_member_id IS NOT NULL THEN
      UPDATE confirmation_tasks
      SET 
        assigned_to = active_member_id,
        assigned_role = target_role,
        assigned_at = now(),
        auto_return_at = now() + interval '2 hours'
      WHERE id = task_record.id;

      -- Log the assignment
      INSERT INTO activity_logs (
        team_id,
        appointment_id,
        actor_name,
        action_type,
        note
      ) VALUES (
        task_record.team_id,
        task_record.appointment_id,
        'System',
        'Assigned',
        'Task auto-assigned to ' || target_role || ' via round-robin'
      );
    END IF;
  END LOOP;
END;
$$;
