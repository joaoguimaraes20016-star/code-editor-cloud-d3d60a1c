-- Delete the duplicate unassigned Serge Tati appointment
DELETE FROM appointments 
WHERE id = 'c19979d6-c17c-4ee2-98e7-f1a6fa743612' 
AND team_id = 'c2cbfeed-8710-428b-966d-534804a256fb';