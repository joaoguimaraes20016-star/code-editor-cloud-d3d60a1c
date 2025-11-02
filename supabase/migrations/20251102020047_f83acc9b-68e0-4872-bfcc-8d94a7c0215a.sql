
-- First, clean up existing duplicates (keep most recent)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY appointment_id, task_type 
           ORDER BY created_at DESC
         ) as rn
  FROM confirmation_tasks
)
DELETE FROM confirmation_tasks
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE confirmation_tasks 
ADD CONSTRAINT unique_appointment_task 
UNIQUE (appointment_id, task_type);
