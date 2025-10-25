-- Assign default pipeline stage to all existing appointments without one
UPDATE appointments 
SET pipeline_stage = 'new_lead' 
WHERE pipeline_stage IS NULL;