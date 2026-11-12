REVOKE INSERT, UPDATE ON public.labour_attendance FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_labour_attendance(
  p_project_id uuid, p_work_date date, p_rows jsonb, p_reason text DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  entry jsonb;
  imported integer := 0;
  reason_value text := NULLIF(btrim(p_reason), '');
  attendance_uuid uuid;
  current_hours numeric;
  proposed_hours numeric;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer','site_installation_mgr','head_of_projects','planning_head','managing_director','super_admin'
  ]), false) THEN
    RAISE EXCEPTION 'Not authorized to save labour attendance' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_can_access_project(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'You do not have access to this project' USING ERRCODE = '42501';
  END IF;
  IF p_work_date > current_date THEN RAISE EXCEPTION 'Future attendance cannot be saved'; END IF;
  IF p_work_date < current_date - 2 AND reason_value IS NULL THEN
    RAISE EXCEPTION 'A reason is required for attendance more than two days old';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Attendance must contain a row list'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF NULLIF(entry->>'worker_id','') IS NULL OR NULLIF(entry->>'hours','') IS NULL THEN
      RAISE EXCEPTION 'Each attendance row needs a worker and hours';
    END IF;
    proposed_hours := (entry->>'hours')::numeric;
    IF proposed_hours < 0 OR proposed_hours > 16 THEN RAISE EXCEPTION 'Attendance hours must be between 0 and 16'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.labour_workers w WHERE w.id = (entry->>'worker_id')::uuid) THEN
      RAISE EXCEPTION 'Worker not found';
    END IF;
    attendance_uuid := NULL; current_hours := NULL;
    SELECT id, hours INTO attendance_uuid, current_hours FROM public.labour_attendance
    WHERE work_date = p_work_date AND project_id = p_project_id AND worker_id = (entry->>'worker_id')::uuid;
    IF attendance_uuid IS NOT NULL AND current_hours IS DISTINCT FROM proposed_hours THEN
      IF reason_value IS NULL THEN RAISE EXCEPTION 'A reason is required when changing saved attendance'; END IF;
      INSERT INTO public.labour_attendance_edit_log (attendance_id, old_hours, new_hours, reason, edited_by)
      VALUES (attendance_uuid, current_hours, proposed_hours, reason_value, auth.uid());
    END IF;
  END LOOP;

  INSERT INTO public.labour_attendance (work_date, worker_id, project_id, hours, recorded_by)
  SELECT p_work_date, (e->>'worker_id')::uuid, p_project_id, (e->>'hours')::numeric, auth.uid()
  FROM jsonb_array_elements(p_rows) e
  ON CONFLICT (work_date, worker_id, project_id) DO UPDATE
    SET hours = EXCLUDED.hours, recorded_by = EXCLUDED.recorded_by, recorded_at = now()
    WHERE public.labour_attendance.hours IS DISTINCT FROM EXCLUDED.hours;
  GET DIAGNOSTICS imported = ROW_COUNT;
  RETURN imported;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_labour_master_upload(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  entry jsonb;
  row_number integer := 0;
  code text;
  worker_name text;
  existing_name text;
  contractor_name text;
  contractor_uuid uuid;
  worker_uuid uuid;
  desired_status text;
  rate_value numeric;
  salary_value numeric;
  imported integer := 0;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY['planning_head','managing_director','super_admin','head_of_projects']), false) THEN
    RAISE EXCEPTION 'Not authorized to upload the labour master' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Upload must contain a row list'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) e
    WHERE NULLIF(btrim(e->>'worker_code'),'') IS NOT NULL
    GROUP BY lower(btrim(e->>'worker_code')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate worker_code values in upload'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row_number := row_number + 1;
    code := NULLIF(btrim(entry->>'worker_code'),'');
    worker_name := NULLIF(btrim(entry->>'name'),'');
    contractor_name := NULLIF(btrim(entry->>'contractor'),'');
    desired_status := COALESCE(NULLIF(btrim(entry->>'status'),''),'active');
    IF worker_name IS NULL OR NULLIF(btrim(entry->>'skill_type'),'') IS NULL THEN
      RAISE EXCEPTION 'Row %: name and skill_type are required', row_number + 1;
    END IF;
    IF desired_status NOT IN ('active','on_leave','inactive') THEN RAISE EXCEPTION 'Row %: invalid status', row_number + 1; END IF;
    IF NULLIF(btrim(entry->>'hourly_rate'),'') IS NOT NULL AND btrim(entry->>'hourly_rate') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: hourly_rate must be numeric', row_number + 1;
    END IF;
    IF NULLIF(btrim(entry->>'monthly_salary'),'') IS NOT NULL AND btrim(entry->>'monthly_salary') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: monthly_salary must be numeric', row_number + 1;
    END IF;
    rate_value := NULLIF(btrim(entry->>'hourly_rate'),'')::numeric;
    salary_value := COALESCE(NULLIF(btrim(entry->>'monthly_salary'),'')::numeric, 0);

    contractor_uuid := NULL;
    IF contractor_name IS NOT NULL THEN
      SELECT id INTO contractor_uuid FROM public.labour_contractors
      WHERE lower(btrim(company_name)) = lower(contractor_name) LIMIT 1;
      IF contractor_uuid IS NULL THEN RAISE EXCEPTION 'Row %: contractor not found', row_number + 1; END IF;
    END IF;

    worker_uuid := NULL; existing_name := NULL;
    IF code IS NOT NULL THEN
      SELECT id, name INTO worker_uuid, existing_name FROM public.labour_workers WHERE lower(worker_code) = lower(code);
    END IF;
    IF worker_uuid IS NOT NULL THEN
      IF existing_name IS DISTINCT FROM worker_name THEN
        RAISE EXCEPTION 'Row %: worker name cannot be changed for an existing code', row_number + 1;
      END IF;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid, skill_type = btrim(entry->>'skill_type'), status = desired_status,
          deactivated_at = CASE WHEN desired_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid;
    ELSE
      INSERT INTO public.labour_workers (worker_code, contractor_id, name, skill_type, department, status, deactivated_at)
      VALUES (code, contractor_uuid, worker_name, btrim(entry->>'skill_type'), 'site', desired_status,
              CASE WHEN desired_status = 'inactive' THEN now() ELSE NULL END)
      RETURNING id INTO worker_uuid;
    END IF;

    INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, hourly_rate)
    VALUES (worker_uuid, salary_value, rate_value)
    ON CONFLICT (worker_id) DO UPDATE
      SET monthly_salary = EXCLUDED.monthly_salary, hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$$;