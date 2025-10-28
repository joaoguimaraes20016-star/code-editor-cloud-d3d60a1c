-- Clean up duplicate confirmation tasks
-- For each appointment with multiple pending tasks, keep only the most recent one
DELETE FROM confirmation_tasks
WHERE id IN (
  SELECT ct.id
  FROM confirmation_tasks ct
  INNER JOIN (
    SELECT appointment_id, MAX(created_at) as latest_created_at
    FROM confirmation_tasks
    WHERE status = 'pending'
    GROUP BY appointment_id
    HAVING COUNT(*) > 1
  ) duplicates ON ct.appointment_id = duplicates.appointment_id
  WHERE ct.status = 'pending'
    AND ct.created_at < duplicates.latest_created_at
);