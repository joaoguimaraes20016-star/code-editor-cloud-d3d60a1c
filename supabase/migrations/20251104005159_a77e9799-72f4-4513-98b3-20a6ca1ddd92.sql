-- Add setting to control if setters can update pipeline stages
ALTER TABLE teams 
ADD COLUMN allow_setter_pipeline_updates boolean NOT NULL DEFAULT false;