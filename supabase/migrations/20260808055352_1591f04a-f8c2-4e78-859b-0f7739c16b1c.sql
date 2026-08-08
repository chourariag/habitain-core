DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_completion_type') THEN
    CREATE TYPE public.task_completion_type AS ENUM ('live', 'completed_pre_hstack');
  END IF;
END $$;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS completion_type public.task_completion_type NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS backfilled_by uuid,
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_note text;

CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_project_task_id_key
  ON public.project_tasks (project_id, task_id_in_schedule);

CREATE OR REPLACE FUNCTION public.trg_archive_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _archive_id uuid;
  _project_id uuid;
  _project_name text;
BEGIN
  -- Backfilled (pre-HStack) tasks never fire archive confirmations or notifications
  IF NEW.completion_type = 'completed_pre_hstack' THEN RETURN NEW; END IF;

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
$function$;