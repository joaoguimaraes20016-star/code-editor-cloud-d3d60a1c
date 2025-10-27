-- Assign existing tasks to the setter if appointment has a setter_id
UPDATE confirmation_tasks ct
SET 
  assigned_to = a.setter_id,
  assigned_at = COALESCE(ct.assigned_at, NOW()),
  auto_return_at = COALESCE(ct.auto_return_at, NOW() + interval '2 hours')
FROM appointments a
WHERE ct.appointment_id = a.id
  AND ct.status = 'pending'
  AND ct.assigned_to IS NULL
  AND a.setter_id IS NOT NULL;

-- For remaining unassigned tasks, assign via round-robin to active setters in rotation
DO $$
DECLARE
  active_setters UUID[];
  unassigned_task RECORD;
  setter_counts RECORD;
  assigned_setter UUID;
BEGIN
  -- Get active setters in rotation
  SELECT ARRAY_AGG(tm.user_id) INTO active_setters
  FROM team_members tm
  WHERE tm.role = 'setter'
    AND tm.is_active = true
    AND (
      NOT EXISTS (
        SELECT 1 FROM setter_rotation_settings srs 
        WHERE srs.setter_id = tm.user_id
      )
      OR EXISTS (
        SELECT 1 FROM setter_rotation_settings srs 
        WHERE srs.setter_id = tm.user_id 
        AND srs.is_in_rotation = true
      )
    );

  -- If we have active setters, assign the remaining unassigned tasks
  IF active_setters IS NOT NULL AND array_length(active_setters, 1) > 0 THEN
    FOR unassigned_task IN 
      SELECT ct.id, ct.team_id
      FROM confirmation_tasks ct
      JOIN appointments a ON a.id = ct.appointment_id
      WHERE ct.status = 'pending'
        AND ct.assigned_to IS NULL
        AND a.setter_id IS NULL
      ORDER BY ct.created_at
    LOOP
      -- Find setter with fewest pending tasks
      SELECT user_id INTO assigned_setter
      FROM (
        SELECT 
          unnest(active_setters) as user_id,
          COUNT(ct.id) as task_count
        FROM confirmation_tasks ct
        WHERE ct.status = 'pending'
          AND ct.assigned_to = ANY(active_setters)
        GROUP BY user_id
        ORDER BY task_count ASC
        LIMIT 1
      ) counts;

      -- If no setter has tasks yet, use first one
      IF assigned_setter IS NULL THEN
        assigned_setter := active_setters[1];
      END IF;

      -- Assign the task
      UPDATE confirmation_tasks
      SET 
        assigned_to = assigned_setter,
        assigned_at = NOW(),
        auto_return_at = NOW() + interval '2 hours'
      WHERE id = unassigned_task.id;
    END LOOP;
  END IF;
END $$;