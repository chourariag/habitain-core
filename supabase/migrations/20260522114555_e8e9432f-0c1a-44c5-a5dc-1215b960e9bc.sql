
-- 4A: project_team_members
CREATE TABLE public.project_team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL,
  access_level  text NOT NULL DEFAULT 'read',
  assigned_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at   timestamptz DEFAULT now(),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (project_id, profile_id)
);
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their own project memberships"
ON public.project_team_members FOR SELECT
USING (
  profile_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  OR get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role,'planning_engineer'::app_role,'finance_director'::app_role)
);
CREATE POLICY "Managers can add team members"
ON public.project_team_members FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role,'planning_engineer'::app_role));
CREATE POLICY "Managers can update team members"
ON public.project_team_members FOR UPDATE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role,'planning_engineer'::app_role));
CREATE POLICY "Managers can remove team members"
ON public.project_team_members FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role));

CREATE INDEX idx_project_team_members_project ON public.project_team_members(project_id);
CREATE INDEX idx_project_team_members_profile ON public.project_team_members(profile_id);

CREATE TRIGGER trg_project_team_members_updated_at
BEFORE UPDATE ON public.project_team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4B: file_attachments
CREATE TABLE public.file_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  file_type       text NOT NULL,
  file_url        text NOT NULL,
  file_name       text,
  file_size_bytes bigint,
  mime_type       text,
  storage_bucket  text,
  storage_path    text,
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz DEFAULT now(),
  is_archived     boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view file attachments"
ON public.file_attachments FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can upload files"
ON public.file_attachments FOR INSERT
WITH CHECK (uploaded_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Uploader or admin can delete files"
ON public.file_attachments FOR DELETE
USING (
  uploaded_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  OR get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role)
);

CREATE INDEX idx_file_attachments_entity ON public.file_attachments(entity_type, entity_id);
CREATE INDEX idx_file_attachments_uploaded_by ON public.file_attachments(uploaded_by);

-- 4C: expense_approvals
CREATE TABLE public.expense_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES public.expense_reports(id) ON DELETE CASCADE,
  approver_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action        text NOT NULL CHECK (action IN ('approved','rejected','queried')),
  remarks       text,
  actioned_at   timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.expense_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View expense approvals"
ON public.expense_approvals FOR SELECT
USING (
  approver_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  OR get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'finance_manager'::app_role)
);
CREATE POLICY "Finance roles can insert expense approvals"
ON public.expense_approvals FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'finance_manager'::app_role));
CREATE POLICY "Finance directors can delete expense approvals"
ON public.expense_approvals FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role));

CREATE INDEX idx_expense_approvals_report ON public.expense_approvals(report_id);

-- 4D: notification_preferences
CREATE TABLE public.notification_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled         boolean NOT NULL DEFAULT true,
  push_enabled          boolean NOT NULL DEFAULT true,
  notify_qc             boolean NOT NULL DEFAULT true,
  notify_production     boolean NOT NULL DEFAULT true,
  notify_dispatch       boolean NOT NULL DEFAULT true,
  notify_design_queries boolean NOT NULL DEFAULT true,
  notify_material       boolean NOT NULL DEFAULT true,
  notify_labour         boolean NOT NULL DEFAULT true,
  notify_announcements  boolean NOT NULL DEFAULT true,
  notify_rm_tickets     boolean NOT NULL DEFAULT true,
  quiet_hours_enabled   boolean NOT NULL DEFAULT false,
  quiet_from            time,
  quiet_to              time,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
USING (
  profile_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  OR is_full_admin(auth.uid())
);
CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (profile_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (profile_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_notification_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();

-- Backfill prefs for existing profiles
INSERT INTO public.notification_preferences (profile_id)
SELECT id FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;
