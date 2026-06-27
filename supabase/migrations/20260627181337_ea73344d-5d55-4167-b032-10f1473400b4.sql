
-- Project Archive: table, triggers, task creation, daily reminder

CREATE TABLE IF NOT EXISTS public.project_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  archive_generated_at timestamptz NOT NULL DEFAULT now(),
  cloud_report_url text,
  zip_download_url text,
  zip_generated_at timestamptz,
  zip_generation_status text NOT NULL DEFAULT 'pending', -- pending | generating | ready | failed
  zip_generation_error text,
  karthik_upload_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  karthik_upload_confirmed_at timestamptz,
  storage_cleanup_eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_archives TO authenticated;
GRANT ALL ON public.project_archives TO service_role;

ALTER TABLE public.project_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archive_select_leadership" ON public.project_archives
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid())::text = ANY (ARRAY[
      'managing_director','super_admin','finance_director','head_of_projects',
      'planning_head','sales_director','principal_architect','planning_engineer'
    ])
  );

CREATE POLICY "archive_service_write" ON public.project_archives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "archive_update_leadership" ON public.project_archives
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid())::text = ANY (ARRAY['managing_director','super_admin','head_of_projects','planning_head','planning_engineer']))
  WITH CHECK (true);

CREATE TRIGGER trg_project_archives_updated_at
  BEFORE UPDATE ON public.project_archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when a project closes, create the archive row + Karthik task + notify 6 roles.
CREATE OR REPLACE FUNCTION public.trg_project_closure_create_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archive_id uuid;
  _task_id uuid;
  _project_name text := COALESCE(NEW.name, 'Project');
  _project_code text := COALESCE(NEW.project_code, NEW.id::text);
  _cloud_report_url text := '/projects/' || NEW.id || '/archive';
  _planning_engineer_id uuid;
BEGIN
  IF NEW.status <> 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_archives (project_id, cloud_report_url)
  VALUES (NEW.id, _cloud_report_url)
  ON CONFLICT (project_id) DO UPDATE SET cloud_report_url = EXCLUDED.cloud_report_url
  RETURNING id INTO _archive_id;

  -- Pick a planning_engineer to assign
  SELECT ur.user_id INTO _planning_engineer_id
  FROM public.user_roles ur
  WHERE ur.role::text = 'planning_engineer'
  LIMIT 1;

  -- Create Karthik's upload task
  INSERT INTO public.project_tasks (
    project_id, task_id_in_schedule, task_name, phase,
    planned_start_date, planned_finish_date,
    responsible_role, status, task_type
  ) VALUES (
    NEW.id,
    'ARCHIVE-UPLOAD-' || substring(NEW.id::text, 1, 8),
    'Upload ' || _project_name || ' archive to Zoho Drive',
    'Closure',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days',
    'planning_engineer', 'Upcoming', 'task'
  ) RETURNING id INTO _task_id;

  UPDATE public.project_archives
     SET karthik_upload_task_id = _task_id
   WHERE id = _archive_id;

  -- Notify the 6 roles
  INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
  SELECT DISTINCT ur.user_id,
         _project_name || ' archive is being prepared',
         'Cloud Report: ' || _cloud_report_url || E'\nDownload ZIP will be available shortly.',
         'Cloud Report: ' || _cloud_report_url || E'\nDownload ZIP will be available shortly.\n\nAction for Planning Engineer: Download the ZIP and upload to Zoho Drive under Projects/' || _project_code || '/Archive. Mark the task complete in HStack.',
         'info', 'project_closure', 'project_archives', _archive_id
  FROM public.user_roles ur
  WHERE ur.role::text = ANY (ARRAY[
    'managing_director','principal_architect','sales_director',
    'head_of_projects','planning_head','planning_engineer'
  ]);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_closure_create_archive ON public.projects;
CREATE TRIGGER trg_project_closure_create_archive
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_project_closure_create_archive();

-- When Karthik marks the upload task complete, flag the archive + notify HoP
CREATE OR REPLACE FUNCTION public.trg_archive_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archive_id uuid;
  _project_id uuid;
  _project_name text;
BEGIN
  IF NEW.status <> 'Completed' OR OLD.status = 'Completed' THEN RETURN NEW; END IF;

  SELECT id, project_id INTO _archive_id, _project_id
  FROM public.project_archives
  WHERE karthik_upload_task_id = NEW.id;

  IF _archive_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.project_archives
     SET karthik_upload_confirmed_at = now(),
         storage_cleanup_eligible = true
   WHERE id = _archive_id;

  SELECT name INTO _project_name FROM public.projects WHERE id = _project_id;

  INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
  SELECT ur.user_id,
         _project_name || ' archive uploaded to Zoho Drive',
         _project_name || ' archive uploaded to Zoho Drive by Karthik.',
         _project_name || ' archive uploaded to Zoho Drive by Karthik.',
         'info', 'project_closure', 'project_archives', _archive_id
  FROM public.user_roles ur
  WHERE ur.role::text IN ('head_of_projects','managing_director');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_task_completed ON public.project_tasks;
CREATE TRIGGER trg_archive_task_completed
  AFTER UPDATE OF status ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_archive_task_completed();

-- Daily reminder for outstanding archive upload tasks
CREATE OR REPLACE FUNCTION public.project_archive_upload_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pa.id AS archive_id, pa.karthik_upload_task_id, p.name AS project_name
    FROM public.project_archives pa
    JOIN public.projects p ON p.id = pa.project_id
    WHERE pa.karthik_upload_confirmed_at IS NULL
      AND pa.karthik_upload_task_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
    SELECT ur.user_id,
           'Reminder: Upload ' || r.project_name || ' archive to Zoho Drive',
           'Please download the archive ZIP and upload it to Zoho Drive, then mark the task complete.',
           'Please download the archive ZIP and upload it to Zoho Drive, then mark the task complete.',
           'warning', 'project_closure', 'project_archives', r.archive_id
    FROM public.user_roles ur
    WHERE ur.role::text = 'planning_engineer';
  END LOOP;
END;
$$;
