-- Fix pipeline stage IDs to match the actual stages
UPDATE appointments 
SET pipeline_stage = 'new' 
WHERE pipeline_stage = 'new_lead' 
AND team_id = 'c2cbfeed-8710-428b-966d-534804a256fb';