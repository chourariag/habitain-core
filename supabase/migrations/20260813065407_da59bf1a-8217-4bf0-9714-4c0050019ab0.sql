CREATE OR REPLACE FUNCTION public.trg_project_closure_create_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _archive_id uuid;
  _task_id uuid;
  _project_name text := COALESCE(NEW.name, 'Project');
  _project_code text := NEW.id::text;
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

  SELECT ur.user_id INTO _planning_engineer_id
  FROM public.user_roles ur
  WHERE ur.role::text = 'planning_engineer'
  LIMIT 1;

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
$function$;