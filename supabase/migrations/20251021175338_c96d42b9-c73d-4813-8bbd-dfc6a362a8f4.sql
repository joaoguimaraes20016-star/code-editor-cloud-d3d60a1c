-- Clean up all default templates (where team_id is NULL) and insert a fresh, clean blueprint
DELETE FROM asset_field_templates WHERE team_id IS NULL;

-- Insert fresh onboarding survey blueprint with correct order (using lowercase categories)
INSERT INTO asset_field_templates (team_id, field_category, field_name, field_type, is_required, order_index, placeholder_text, help_text) VALUES
-- Instagram fields
(NULL, 'instagram', 'Full Name', 'text', true, 1, 'John Doe', 'Your full legal name as it appears on documents'),
(NULL, 'instagram', 'Instagram Username', 'text', true, 2, '@username', 'Your Instagram username without the @ symbol'),
(NULL, 'instagram', 'Instagram Password', 'password', true, 3, '', 'Your Instagram account password - stored securely'),
(NULL, 'instagram', 'Instagram Backup Codes', 'file', true, 4, '', 'Upload your 2FA backup codes for account recovery'),

-- Domain fields
(NULL, 'domain', 'Domain Provider/Contact', 'text', true, 5, 'GoDaddy, Namecheap, etc.', 'Where your domain is registered'),
(NULL, 'domain', 'Domain Hosting Login', 'text', true, 6, 'username or email', 'Login credentials for your domain hosting'),
(NULL, 'domain', 'Domain Hosting Password', 'password', false, 7, '', 'Password for your domain hosting account'),

-- ManyChat fields
(NULL, 'manychat', 'ManyChat Username', 'text', false, 8, 'username or email', 'Your ManyChat account username'),
(NULL, 'manychat', 'ManyChat Password', 'password', false, 9, '', 'Your ManyChat account password'),

-- Media fields
(NULL, 'media', 'Full Name', 'text', true, 10, 'John Doe', 'Name for media assets'),
(NULL, 'media', 'Google Drive Link', 'url', true, 11, 'https://drive.google.com/...', 'Shared Google Drive folder with your media assets');