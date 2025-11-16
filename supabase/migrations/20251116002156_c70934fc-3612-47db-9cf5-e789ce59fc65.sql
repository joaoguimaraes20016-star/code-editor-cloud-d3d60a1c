-- Add assignment tracking to teams table for round-robin
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS last_task_assignment jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN teams.last_task_assignment IS 'Tracks last assigned user per role for round-robin: {"setter": "user_id", "closer": "user_id"}';

-- Update confirmation_flow_config to support new assignment modes
-- The JSONB structure will now support:
-- {
--   "sequence": 1,
--   "label": "24h Before",
--   "hours_before": 24,
--   "assigned_role": "setter",
--   "assignment_mode": "round_robin",  -- NEW: "role" | "round_robin" | "individual"
--   "assigned_user_id": null,           -- NEW: specific user ID if mode = "individual"
--   "enabled": true
-- }

-- No schema change needed as confirmation_flow_config is already JSONB
-- We just need to ensure existing configs have default values

UPDATE teams
SET confirmation_flow_config = (
  SELECT jsonb_agg(
    config || 
    jsonb_build_object(
      'assignment_mode', 
      CASE 
        WHEN config->>'assigned_role' = 'setter' THEN 'round_robin'::text
        ELSE 'role'::text
      END,
      'assigned_user_id', null
    )
  )
  FROM jsonb_array_elements(confirmation_flow_config) AS config
)
WHERE confirmation_flow_config IS NOT NULL
  AND confirmation_flow_config != '[]'::jsonb;