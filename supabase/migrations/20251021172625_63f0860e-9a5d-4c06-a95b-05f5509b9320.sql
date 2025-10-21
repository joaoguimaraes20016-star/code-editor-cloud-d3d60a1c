-- Update field templates with detailed help text using existing categories

-- Update Full Name field
UPDATE asset_field_templates
SET help_text = 'ONLY YOUR NAME Nothing else'
WHERE field_name = 'Full Name' AND team_id IS NULL;

-- Update Instagram Username
UPDATE asset_field_templates
SET help_text = 'Enter your Instagram username'
WHERE field_name = 'Instagram Username' AND team_id IS NULL;

-- Update Instagram Password
UPDATE asset_field_templates
SET help_text = 'Enter your Instagram password (securely encrypted)'
WHERE field_name = 'Instagram Password' AND team_id IS NULL;

-- Update Domain Login field with detailed help text
UPDATE asset_field_templates
SET 
  field_name = 'Domain Hoster Login & Password',
  help_text = 'We need your domain login for the official funnel we create. Enter your domain hosting login and password below (if you don''t know it and have a tech person or website developer that handles that for you, enter their contact information and let them know we''ll be in touch with them shortly). If you don''t have one, enter N/A',
  placeholder_text = 'Domain login details or N/A'
WHERE field_name = 'Domain Login' AND team_id IS NULL;

-- Update ManyChat Username with help text
UPDATE asset_field_templates
SET help_text = 'Only fill this out if you have a ManyChat account setup'
WHERE field_name = 'ManyChat Username' AND team_id IS NULL;

-- Update ManyChat Password with help text
UPDATE asset_field_templates
SET help_text = 'Only fill this out if you have a ManyChat account setup'
WHERE field_name = 'ManyChat Password' AND team_id IS NULL;

-- Update Google Drive Link field
UPDATE asset_field_templates
SET 
  field_name = 'Google Drive Link - Photos',
  help_text = 'Please upload 30 different photos of yourself for promotion. Include voice memo from doc in Google Drive',
  placeholder_text = 'https://drive.google.com/...'
WHERE field_category = 'media' AND field_type = 'url' AND team_id IS NULL;

-- Update Instagram Backup Codes field
UPDATE asset_field_templates
SET 
  field_name = 'Instagram Backup Codes',
  help_text = 'Upload your Instagram backup code screenshot'
WHERE field_category = 'instagram' AND field_type = 'file' AND team_id IS NULL;