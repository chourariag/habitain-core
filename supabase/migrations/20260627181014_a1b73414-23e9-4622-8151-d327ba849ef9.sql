
-- 1) Add `type` column to project_setup_approvals, supporting site_schedule
ALTER TABLE public.project_setup_approvals
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'project_setup';

ALTER TABLE public.project_setup_approvals
  DROP CONSTRAINT IF EXISTS project_setup_approvals_type_check;
ALTER TABLE public.project_setup_approvals
  ADD CONSTRAINT project_setup_approvals_type_check
  CHECK (type IN ('project_setup','site_schedule'));

ALTER TABLE public.project_setup_approvals
  DROP CONSTRAINT IF EXISTS project_setup_approvals_project_id_role_key;
ALTER TABLE public.project_setup_approvals
  ADD CONSTRAINT project_setup_approvals_project_role_type_key UNIQUE (project_id, role, type);

-- Update existing trigger function to only act on project_setup type
CREATE OR REPLACE FUNCTION public.sync_project_setup_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ph_ok BOOLEAN;
  hop_ok BOOLEAN;
  any_reject BOOLEAN;
BEGIN
  IF COALESCE(NEW.type,'project_setup') <> 'project_setup' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'planning_head'
                    AND status = 'approved' AND type = 'project_setup')
    INTO ph_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'head_of_projects'
                    AND status = 'approved' AND type = 'project_setup')
    INTO hop_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND status = 'rejected'
                    AND type = 'project_setup')
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
END $function$;

-- 2) site_schedules table
CREATE TABLE IF NOT EXISTS public.site_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_start_date date,
  installation_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  handover_date date,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected')),
  approved_at timestamptz,
  rejection_reason text,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_schedules TO authenticated;
GRANT ALL ON public.site_schedules TO service_role;

ALTER TABLE public.site_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view site schedules"
  ON public.site_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Planning/admin can insert site schedules"
  ON public.site_schedules FOR INSERT TO authenticated
  WITH CHECK (
    public.is_md(auth.uid())
    OR public.user_has_any_role(auth.uid(),
      ARRAY['planning_engineer','planning_head','head_of_projects','head_operations']::app_role[])
  );

CREATE POLICY "Planning/admin can update site schedules"
  ON public.site_schedules FOR UPDATE TO authenticated
  USING (
    public.is_md(auth.uid())
    OR public.user_has_any_role(auth.uid(),
      ARRAY['planning_engineer','planning_head','head_of_projects','head_operations']::app_role[])
  )
  WITH CHECK (true);

CREATE POLICY "MD can delete site schedules"
  ON public.site_schedules FOR DELETE TO authenticated USING (public.is_md(auth.uid()));

CREATE TRIGGER trg_site_schedules_updated_at
  BEFORE UPDATE ON public.site_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Sync site_schedule approvals -> site_schedules status + notifications
CREATE OR REPLACE FUNCTION public.sync_site_schedule_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ph_ok boolean; hop_ok boolean; any_reject boolean;
  pname text; recip record;
BEGIN
  IF COALESCE(NEW.type,'project_setup') <> 'site_schedule' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'planning_head'
                    AND status='approved' AND type='site_schedule') INTO ph_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'head_of_projects'
                    AND status='approved' AND type='site_schedule') INTO hop_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND status='rejected'
                    AND type='site_schedule') INTO any_reject;

  IF ph_ok AND hop_ok THEN
    UPDATE public.site_schedules
      SET status='approved', approved_at = COALESCE(approved_at, now())
      WHERE project_id = NEW.project_id;

    SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active=true AND role IN ('site_installation_mgr','site_engineer')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'success', 'site_schedule',
              'Site Schedule approved',
              'Site Schedule approved for ' || COALESCE(pname,'project') || '. View installation milestones in Site Hub.',
              'Site Schedule approved for ' || COALESCE(pname,'project') || '. View installation milestones in Site Hub.',
              '/site-hub?project=' || NEW.project_id || '&tab=schedule',
              'normal');
    END LOOP;
  ELSIF any_reject THEN
    UPDATE public.site_schedules
      SET status='rejected', rejection_reason = COALESCE(NEW.comments, rejection_reason)
      WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_site_schedule_approval ON public.project_setup_approvals;
CREATE TRIGGER trg_sync_site_schedule_approval
  AFTER INSERT OR UPDATE ON public.project_setup_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_schedule_approval();

-- 4) 14-day-before-dispatch reminder to planning_engineer
CREATE OR REPLACE FUNCTION public.site_schedule_dispatch_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record; recip record; pname text; sent int := 0;
  dispatch_date date; days_to_dispatch int; has_uploaded boolean;
BEGIN
  FOR r IN
    SELECT p.id AS project_id, p.project_name,
           (SELECT MIN(planned_end) FROM public.project_stages
              WHERE project_id = p.id AND stage_number = 15) AS planned_dispatch
    FROM public.projects p
    WHERE COALESCE(p.is_archived,false) = false
  LOOP
    dispatch_date := r.planned_dispatch;
    IF dispatch_date IS NULL THEN CONTINUE; END IF;
    days_to_dispatch := dispatch_date - CURRENT_DATE;
    IF days_to_dispatch > 14 OR days_to_dispatch < 0 THEN CONTINUE; END IF;

    SELECT EXISTS (SELECT 1 FROM public.site_schedules
                    WHERE project_id = r.project_id
                      AND status IN ('pending_approval','approved'))
      INTO has_uploaded;
    IF has_uploaded THEN CONTINUE; END IF;

    pname := r.project_name;
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active=true AND role IN ('planning_engineer','planning_head')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'site_schedule',
              'Upload Site Schedule',
              'Dispatch is in ' || days_to_dispatch || ' days for ' || COALESCE(pname,'project') || '. Upload Site Schedule now.',
              'Dispatch is in ' || days_to_dispatch || ' days for ' || COALESCE(pname,'project') || '. Upload Site Schedule now.',
              '/projects/' || r.project_id || '?tab=schedule',
              CASE WHEN days_to_dispatch <= 7 THEN 'high' ELSE 'normal' END);
      sent := sent + 1;
    END LOOP;
  END LOOP;
  RETURN sent;
END $$;
