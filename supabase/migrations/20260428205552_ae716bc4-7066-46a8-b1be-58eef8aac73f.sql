
-- Configs
CREATE TABLE public.weekly_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  assigned_role app_role,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline_day SMALLINT NOT NULL CHECK (deadline_day BETWEEN 1 AND 6), -- 1=Mon..6=Sat
  deadline_time TIME NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','fortnightly')),
  reviewer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_role app_role,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (assigned_role IS NOT NULL OR assigned_user_id IS NOT NULL)
);

CREATE TABLE public.weekly_report_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.weekly_report_configs(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  accomplishments TEXT NOT NULL,
  next_week_plan TEXT NOT NULL,
  risks_blockers TEXT,
  action_needed TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('on_time','late','missed','pending')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, submitted_by, report_period_start)
);

CREATE INDEX idx_wrs_config ON public.weekly_report_submissions(config_id, report_period_start);
CREATE INDEX idx_wrs_submitter ON public.weekly_report_submissions(submitted_by, report_period_start DESC);

ALTER TABLE public.weekly_report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_submissions ENABLE ROW LEVEL SECURITY;

-- Helper: can manage configs
CREATE OR REPLACE FUNCTION public.can_manage_weekly_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations')
  )
$$;

-- Configs policies
CREATE POLICY "Configs viewable by everyone authenticated" ON public.weekly_report_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Configs managed by directors" ON public.weekly_report_configs
  FOR ALL TO authenticated
  USING (public.can_manage_weekly_reports(auth.uid()))
  WITH CHECK (public.can_manage_weekly_reports(auth.uid()));

-- Submissions policies
CREATE POLICY "Submissions: submitter can insert own" ON public.weekly_report_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Submissions: visible to submitter, reviewer, directors" ON public.weekly_report_submissions
  FOR SELECT TO authenticated USING (
    submitted_by IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.can_manage_weekly_reports(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.weekly_report_configs c
      JOIN public.profiles p ON p.auth_user_id = auth.uid()
      WHERE c.id = weekly_report_submissions.config_id
        AND (c.reviewer_user_id = p.id OR c.reviewer_role = p.role)
    )
  );

CREATE POLICY "Submissions: reviewer or director can update" ON public.weekly_report_submissions
  FOR UPDATE TO authenticated USING (
    public.can_manage_weekly_reports(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.weekly_report_configs c
      JOIN public.profiles p ON p.auth_user_id = auth.uid()
      WHERE c.id = weekly_report_submissions.config_id
        AND (c.reviewer_user_id = p.id OR c.reviewer_role = p.role)
    )
  );

CREATE TRIGGER trg_wrc_updated BEFORE UPDATE ON public.weekly_report_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed standard configs (by role since named users may not be seeded yet)
INSERT INTO public.weekly_report_configs
  (report_name, assigned_role, deadline_day, deadline_time, frequency, reviewer_role, active)
VALUES
  ('Weekly Planning Summary', 'planning_engineer'::app_role, 5, '16:00', 'weekly', 'head_operations'::app_role, true),
  ('Weekly Ops Status', 'head_operations'::app_role, 1, '10:00', 'weekly', 'managing_director'::app_role, true),
  ('NCR Weekly Defect Summary', 'qc_inspector'::app_role, 5, '17:00', 'weekly', 'production_head'::app_role, true),
  ('Weekly Factory Status', 'production_head'::app_role, 1, '09:00', 'weekly', 'managing_director'::app_role, true),
  ('Weekly Site Status', 'site_installation_mgr'::app_role, 1, '09:00', 'weekly', 'head_operations'::app_role, true);
