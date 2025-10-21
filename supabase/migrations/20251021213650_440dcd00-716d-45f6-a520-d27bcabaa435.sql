-- Create team_assets table
CREATE TABLE public.team_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  loom_url TEXT,
  external_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_messages table
CREATE TABLE public.team_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE,
  is_edited BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.team_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_assets
CREATE POLICY "Team members can view team assets"
  ON public.team_assets FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Owners and admins can create team assets"
  ON public.team_assets FOR INSERT
  WITH CHECK (
    is_team_member(auth.uid(), team_id) AND 
    (has_team_role(auth.uid(), team_id, 'owner') OR 
     has_team_role(auth.uid(), team_id, 'admin') OR 
     has_team_role(auth.uid(), team_id, 'offer_owner'))
  );

CREATE POLICY "Owners and admins can update team assets"
  ON public.team_assets FOR UPDATE
  USING (
    is_team_member(auth.uid(), team_id) AND 
    (has_team_role(auth.uid(), team_id, 'owner') OR 
     has_team_role(auth.uid(), team_id, 'admin') OR 
     has_team_role(auth.uid(), team_id, 'offer_owner'))
  );

CREATE POLICY "Owners and admins can delete team assets"
  ON public.team_assets FOR DELETE
  USING (
    is_team_member(auth.uid(), team_id) AND 
    (has_team_role(auth.uid(), team_id, 'owner') OR 
     has_team_role(auth.uid(), team_id, 'admin') OR 
     has_team_role(auth.uid(), team_id, 'offer_owner'))
  );

-- RLS Policies for team_messages
CREATE POLICY "Team members can view team messages"
  ON public.team_messages FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can send messages"
  ON public.team_messages FOR INSERT
  WITH CHECK (is_team_member(auth.uid(), team_id) AND auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.team_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.team_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_team_assets_team_id ON public.team_assets(team_id);
CREATE INDEX idx_team_assets_category ON public.team_assets(category);
CREATE INDEX idx_team_messages_team_id ON public.team_messages(team_id);
CREATE INDEX idx_team_messages_created_at ON public.team_messages(created_at DESC);

-- Create storage bucket for team assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('team-assets', 'team-assets', false);

-- Storage RLS policies
CREATE POLICY "Team members can view team asset files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'team-assets' AND
    EXISTS (
      SELECT 1 FROM public.team_assets ta
      WHERE ta.file_path = name AND is_team_member(auth.uid(), ta.team_id)
    )
  );

CREATE POLICY "Team members can upload team asset files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'team-assets' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Owners and admins can delete team asset files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'team-assets' AND
    EXISTS (
      SELECT 1 FROM public.team_assets ta
      WHERE ta.file_path = name AND 
      is_team_member(auth.uid(), ta.team_id) AND
      (has_team_role(auth.uid(), ta.team_id, 'owner') OR 
       has_team_role(auth.uid(), ta.team_id, 'admin') OR 
       has_team_role(auth.uid(), ta.team_id, 'offer_owner'))
    )
  );

-- Add trigger for updated_at on team_assets
CREATE TRIGGER update_team_assets_updated_at
  BEFORE UPDATE ON public.team_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for team_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;