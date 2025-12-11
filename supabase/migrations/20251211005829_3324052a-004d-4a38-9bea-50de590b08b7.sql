-- Add file attachment columns to team_messages
ALTER TABLE public.team_messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- Create storage bucket for team chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-chat-files', 'team-chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to team-chat-files bucket
CREATE POLICY "team_chat_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'team-chat-files');

-- Allow anyone to view chat files (public bucket)
CREATE POLICY "team_chat_view_policy"
ON storage.objects
FOR SELECT
USING (bucket_id = 'team-chat-files');