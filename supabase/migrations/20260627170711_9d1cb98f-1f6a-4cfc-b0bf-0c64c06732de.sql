
-- Part 1+2: project setup approvals + timestamps
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_setup_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gfc_budget_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_setup_status TEXT NOT NULL DEFAULT 'not_submitted';

CREATE TABLE IF NOT EXISTS public.project_setup_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  role public.app_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  comments TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_setup_approvals TO authenticated;
GRANT ALL ON public.project_setup_approvals TO service_role;

ALTER TABLE public.project_setup_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view setup approvals"
  ON public.project_setup_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Planning engineer & admins can create approval requests"
  ON public.project_setup_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_md(auth.uid())
    OR public.user_has_any_role(auth.uid(), ARRAY['planning_engineer','planning_head','head_of_projects','head_operations']::public.app_role[])
  );

CREATE POLICY "Approver can update own approval row"
  ON public.project_setup_approvals FOR UPDATE TO authenticated
  USING (
    public.is_md(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND p.id = project_setup_approvals.approver_id
    )
  )
  WITH CHECK (
    public.is_md(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND p.id = project_setup_approvals.approver_id
    )
  );

CREATE POLICY "MD can delete approvals"
  ON public.project_setup_approvals FOR DELETE TO authenticated
  USING (public.is_md(auth.uid()));

CREATE TRIGGER update_project_setup_approvals_updated_at
  BEFORE UPDATE ON public.project_setup_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when both planning_head AND head_of_projects approve, flip project flag
CREATE OR REPLACE FUNCTION public.sync_project_setup_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ph_ok BOOLEAN;
  hop_ok BOOLEAN;
  any_reject BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'planning_head' AND status = 'approved')
    INTO ph_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'head_of_projects' AND status = 'approved')
    INTO hop_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND status = 'rejected')
    INTO any_reject;

  IF ph_ok AND hop_ok THEN
    UPDATE public.projects
      SET project_setup_approved = true,
          project_setup_approved_at = COALESCE(project_setup_approved_at, now()),
          project_setup_status = 'approved'
      WHERE id = NEW.project_id;
  ELSIF any_reject THEN
    UPDATE public.projects
      SET project_setup_status = 'rejected'
      WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_project_setup_approval ON public.project_setup_approvals;
CREATE TRIGGER trg_sync_project_setup_approval
  AFTER INSERT OR UPDATE ON public.project_setup_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_setup_approval();
