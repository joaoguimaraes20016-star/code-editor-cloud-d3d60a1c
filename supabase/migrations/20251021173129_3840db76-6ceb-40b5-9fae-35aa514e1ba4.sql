-- Add comprehensive help text explaining why each field is needed

-- Full Name
UPDATE asset_field_templates
SET help_text = 'We need your full legal name for account setup and official documentation. ONLY YOUR NAME - Nothing else.'
WHERE field_name = 'Full Name' AND team_id IS NULL;

-- Instagram Username
UPDATE asset_field_templates
SET help_text = 'We need access to your Instagram account to set up your professional profile, schedule posts, and manage your content strategy.'
WHERE field_name = 'Instagram Username' AND team_id IS NULL;

-- Instagram Password
UPDATE asset_field_templates
SET help_text = 'Your password is securely encrypted. We need this to manage your account, post content, and track analytics for your growth.'
WHERE field_name = 'Instagram Password' AND team_id IS NULL;

-- Domain Login
UPDATE asset_field_templates
SET help_text = 'We need your domain login to create your official sales funnel and landing pages. This is essential for your online presence and lead generation. If you don''t know your login credentials and have a tech person or website developer, enter their contact information and let them know we''ll be in touch. If you don''t have a domain yet, enter N/A.'
WHERE field_name = 'Domain Hoster Login & Password' AND team_id IS NULL;

-- ManyChat Username
UPDATE asset_field_templates
SET help_text = 'ManyChat helps automate your customer conversations and lead nurturing. Only fill this out if you already have a ManyChat account - we''ll integrate it with your sales funnel.'
WHERE field_name = 'ManyChat Username' AND team_id IS NULL;

-- ManyChat Password
UPDATE asset_field_templates
SET help_text = 'We need access to configure automated messaging sequences that will convert your leads into customers. Only fill this if you have a ManyChat account.'
WHERE field_name = 'ManyChat Password' AND team_id IS NULL;

-- Google Drive Link
UPDATE asset_field_templates
SET help_text = 'We need 30 different high-quality photos of yourself for creating engaging Instagram stories and promotional content. Please also include the voice memo from the document in your Google Drive. These photos are essential for building your personal brand and connecting with your audience.'
WHERE field_name = 'Google Drive Link - Photos' AND team_id IS NULL;

-- Instagram Backup Codes
UPDATE asset_field_templates
SET help_text = 'Backup codes are critical for account security and recovery. We need these to ensure we can always access your account if there are any authentication issues, preventing any disruption to your content schedule.'
WHERE field_name = 'Instagram Backup Codes' AND team_id IS NULL;