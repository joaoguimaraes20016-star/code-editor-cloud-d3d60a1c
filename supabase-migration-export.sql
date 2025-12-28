-- =====================================================
-- COMPLETE SUPABASE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: ENUM TYPES
-- =====================================================

CREATE TYPE public.global_role AS ENUM ('super_admin', 'creator', 'member');
CREATE TYPE public.appointment_status AS ENUM ('NEW', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'CLOSED');
CREATE TYPE public.task_type AS ENUM ('call_confirmation', 'follow_up', 'reschedule', 'manual_task');

-- =====================================================
-- PART 2: CORE TABLES
-- =====================================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  account_type TEXT DEFAULT 'invited',
  notification_preferences JSONB DEFAULT '{"new_leads": true, "task_reminders": true}'::jsonb,
  zoom_connected BOOLEAN DEFAULT false,
  google_meet_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (global permissions)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role global_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Creator codes (for signup)
CREATE TABLE public.creator_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID,
  is_active BOOLEAN DEFAULT true,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  logo_url TEXT,
  google_sheets_url TEXT,
  
  -- Calendly integration
  calendly_access_token TEXT,
  calendly_refresh_token TEXT,
  calendly_organization_uri TEXT,
  calendly_webhook_id TEXT,
  calendly_webhook_signing_key TEXT,
  calendly_event_types TEXT[] DEFAULT '{}',
  calendly_token_expires_at TIMESTAMPTZ,
  calendly_enabled_for_funnels BOOLEAN DEFAULT false,
  calendly_enabled_for_crm BOOLEAN DEFAULT false,
  calendly_funnel_scheduling_url TEXT,
  
  -- Commission settings
  setter_commission_percentage NUMERIC DEFAULT 5.0,
  closer_commission_percentage NUMERIC DEFAULT 10.0,
  
  -- Task settings
  auto_create_tasks BOOLEAN DEFAULT true,
  overdue_threshold_minutes INTEGER DEFAULT 30,
  minimum_booking_notice_hours NUMERIC DEFAULT 24,
  fallback_confirmation_minutes NUMERIC DEFAULT 60,
  no_answer_retry_minutes INTEGER DEFAULT 30,
  no_answer_callback_options JSONB DEFAULT '[15, 30, 60, 120]'::jsonb,
  
  -- Permissions
  allow_setter_pipeline_updates BOOLEAN DEFAULT false,
  
  -- Configuration JSONs
  dashboard_preferences JSONB DEFAULT '{"showRevenue": true, "showClosedDeals": true, "showMRRTracking": true, "showSetterPerformance": true, "showUpcomingAppointments": true}'::jsonb,
  confirmation_schedule JSONB DEFAULT '[{"label": "24h Before", "sequence": 1, "hours_before": 24}, {"label": "1h Before", "sequence": 2, "hours_before": 1}, {"label": "10min Before", "sequence": 3, "hours_before": 0.17}]'::jsonb,
  confirmation_flow_config JSONB DEFAULT '[{"label": "24h Before", "enabled": true, "sequence": 1, "hours_before": 24, "assigned_role": "setter"}, {"label": "1h Before", "enabled": true, "sequence": 2, "hours_before": 1, "assigned_role": "setter"}, {"label": "10min Before", "enabled": true, "sequence": 3, "hours_before": 0.17, "assigned_role": "closer"}]'::jsonb,
  default_task_routing JSONB DEFAULT '{"follow_up": "setter", "reschedule": "setter", "manual_task": "closer"}'::jsonb,
  task_routing_config JSONB DEFAULT '{}'::jsonb,
  last_task_assignment JSONB DEFAULT '{}'::jsonb,
  action_pipeline_mappings JSONB DEFAULT '{"rebook": "booked", "no_show": "no_show", "cancelled": "canceled", "no_answer": null, "double_book": "booked", "rescheduled": "rescheduled"}'::jsonb,
  asset_categories JSONB DEFAULT '[{"id": "resources", "icon": "BookOpen", "label": "Resources", "order_index": 0}, {"id": "offer", "icon": "Briefcase", "label": "Offer", "order_index": 1}, {"id": "scripts", "icon": "FileText", "label": "Scripts & SOPs", "order_index": 2}, {"id": "training", "icon": "Video", "label": "Training", "order_index": 3}, {"id": "tracking", "icon": "FileSpreadsheet", "label": "Tracking Sheets", "order_index": 4}, {"id": "team_onboarding", "icon": "Users", "label": "Team Onboarding", "order_index": 5}, {"id": "client_onboarding", "icon": "Briefcase", "label": "Prospect Onboarding", "order_index": 6}]'::jsonb,
  
  mrr_task_assignment TEXT DEFAULT 'closer_who_closed',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team members (user-team relationship)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  booking_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- Team invitations
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email aliases (for matching Calendly emails to users)
CREATE TABLE public.email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alias_email TEXT NOT NULL,
  source TEXT DEFAULT 'calendly',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (alias_email)
);

-- =====================================================
-- PART 3: SECURITY DEFINER FUNCTIONS (for RLS)
-- =====================================================

-- Check if user has a global role
CREATE OR REPLACE FUNCTION public.has_global_role(_user_id UUID, _role global_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
  )
$$;

-- Check if user has a specific team role
CREATE OR REPLACE FUNCTION public.has_team_role(_user_id UUID, _team_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND (
        role = _role 
        OR (role = 'owner' AND _role = 'admin')
      )
  )
$$;

-- Check if user is a team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Get user's team role
CREATE OR REPLACE FUNCTION public.get_team_role(_user_id UUID, _team_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.team_members
  WHERE user_id = _user_id
    AND team_id = _team_id
  LIMIT 1
$$;

-- Check if user is a creator (can create teams)
CREATE OR REPLACE FUNCTION public.is_creator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_type = 'creator' FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Check if user can create teams
CREATE OR REPLACE FUNCTION public.can_create_teams(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_creator(_user_id)
$$;

-- Check if user has valid invitation
CREATE OR REPLACE FUNCTION public.has_valid_invitation(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_invitations ti
    WHERE ti.team_id = _team_id
      AND ti.email = (SELECT email FROM auth.users WHERE id = _user_id)
      AND ti.accepted_at IS NULL
      AND ti.expires_at > now()
  )
$$;

-- =====================================================
-- PART 4: TRIGGERS
-- =====================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign global role based on creator_code
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_code_used TEXT;
BEGIN
  -- Get creator code from user metadata
  creator_code_used := NEW.raw_user_meta_data->>'creator_code';
  
  -- If user signed up with a valid creator code, assign 'creator' role
  IF creator_code_used IS NOT NULL AND creator_code_used != '' THEN
    -- Verify the code exists and is active
    IF EXISTS (
      SELECT 1 FROM public.creator_codes 
      WHERE code = UPPER(creator_code_used) AND is_active = true
    ) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'creator'::global_role);
      
      -- Update account_type in profiles
      UPDATE public.profiles SET account_type = 'creator' WHERE id = NEW.id;
      
      -- Increment uses_count
      UPDATE public.creator_codes 
      SET uses_count = uses_count + 1 
      WHERE code = UPPER(creator_code_used);
      
      RETURN NEW;
    END IF;
  END IF;
  
  -- Otherwise assign 'member' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member'::global_role);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PART 5: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 6: RLS POLICIES
-- =====================================================

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Team members can view teammate profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
    )
  );

-- USER_ROLES POLICIES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (has_global_role(auth.uid(), 'super_admin'));

-- CREATOR_CODES POLICIES
CREATE POLICY "Super admins can manage creator codes"
  ON public.creator_codes FOR ALL
  USING (has_global_role(auth.uid(), 'super_admin'));

-- TEAMS POLICIES
CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (can_create_teams(auth.uid()));

CREATE POLICY "Admins and offer owners can update teams"
  ON public.teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND team_members.role IN ('admin', 'offer_owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND team_members.role IN ('admin', 'offer_owner')
    )
  );

CREATE POLICY "Admins can delete their teams"
  ON public.teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND team_members.role = 'admin'
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Super admins can manage all teams"
  ON public.teams FOR ALL
  USING (has_global_role(auth.uid(), 'super_admin'));

-- TEAM_MEMBERS POLICIES
CREATE POLICY "Team members can view their team members"
  ON public.team_members FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (
    is_team_member(auth.uid(), team_id) 
    AND (
      has_team_role(auth.uid(), team_id, 'admin') 
      OR has_team_role(auth.uid(), team_id, 'offer_owner')
    )
  );

CREATE POLICY "Users can join teams via invitation"
  ON public.team_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND has_valid_invitation(auth.uid(), team_id)
  );

-- TEAM_INVITATIONS POLICIES
CREATE POLICY "Team admins can manage invitations"
  ON public.team_invitations FOR ALL
  USING (
    is_team_member(auth.uid(), team_id) 
    AND (
      has_team_role(auth.uid(), team_id, 'admin') 
      OR has_team_role(auth.uid(), team_id, 'offer_owner')
    )
  );

CREATE POLICY "Users can view their own invitations"
  ON public.team_invitations FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- EMAIL_ALIASES POLICIES
CREATE POLICY "Team admins can manage email aliases"
  ON public.email_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() 
        AND tm.role IN ('admin', 'owner', 'offer_owner')
    )
  );

CREATE POLICY "Users can view aliases in their teams"
  ON public.email_aliases FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = email_aliases.user_id
    )
  );

-- =====================================================
-- PART 7: INDEXES (for performance)
-- =====================================================

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- =====================================================
-- DONE! Your auth system is ready.
-- =====================================================
