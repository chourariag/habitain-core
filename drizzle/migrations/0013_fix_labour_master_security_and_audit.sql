CREATE OR REPLACE FUNCTION public.commit_labour_master_upload(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  worker_status text;
  rate_value numeric;
  salary_value numeric;
  imported integer := 0;
  changed_status boolean;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY['planning_head', 'managing_director', 'super_admin', 'head_of_projects']), false) THEN
    RAISE EXCEPTION 'Not authorized to upload the labour master' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Upload must contain a row list'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) e
    GROUP BY lower(btrim(e->>'worker_code'))
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate worker_code values in upload'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row_number := row_number + 1;
    code := NULLIF(btrim(entry->>'worker_code'), '');
    worker_name := NULLIF(btrim(entry->>'name'), '');
    contractor_name := NULLIF(btrim(entry->>'contractor'), '');
    worker_status := COALESCE(NULLIF(btrim(entry->>'status'), ''), 'active');
    IF code IS NULL OR worker_name IS NULL OR NULLIF(btrim(entry->>'skill_type'), '') IS NULL THEN
      RAISE EXCEPTION 'Row %: worker_code, name, and skill_type are required', row_number + 1;
    END IF;
    IF worker_status NOT IN ('active', 'on_leave', 'inactive') THEN
      RAISE EXCEPTION 'Row %: invalid status', row_number + 1;
    END IF;
    rate_value := NULLIF(btrim(entry->>'hourly_rate'), '')::numeric;
    salary_value := COALESCE(NULLIF(btrim(entry->>'monthly_salary'), '')::numeric, 0);
    IF rate_value < 0 OR salary_value < 0 THEN RAISE EXCEPTION 'Row %: rates cannot be negative', row_number + 1; END IF;

    contractor_uuid := NULL;
    IF contractor_name IS NOT NULL THEN
      SELECT id INTO contractor_uuid FROM public.labour_contractors
      WHERE lower(btrim(company_name)) = lower(contractor_name)
      LIMIT 1;
      IF contractor_uuid IS NULL THEN RAISE EXCEPTION 'Row %: contractor not found', row_number + 1; END IF;
    END IF;

    SELECT id, name, status INTO worker_uuid, existing_name, worker_status
    FROM public.labour_workers WHERE worker_code = code;
    IF worker_uuid IS NOT NULL THEN
      IF existing_name IS DISTINCT FROM worker_name THEN
        RAISE EXCEPTION 'Row %: worker name cannot be changed for an existing code', row_number + 1;
      END IF;
      worker_status := COALESCE(NULLIF(btrim(entry->>'status'), ''), worker_status);
      IF worker_status NOT IN ('active', 'on_leave', 'inactive') THEN
        RAISE EXCEPTION 'Row %: invalid status', row_number + 1;
      END IF;
      changed_status := false;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid,
          skill_type = btrim(entry->>'skill_type'),
          status = worker_status,
          deactivated_at = CASE WHEN worker_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid AND status IS DISTINCT FROM worker_status
      RETURNING true INTO changed_status;
      IF COALESCE(changed_status, false) THEN
        INSERT INTO public.labour_worker_status_log (worker_id, old_status, new_status, changed_by)
        SELECT id, old_status, worker_status, auth.uid()
        FROM (SELECT id, status AS old_status FROM public.labour_workers WHERE id = worker_uuid) oldrow;
      END IF;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid, skill_type = btrim(entry->>'skill_type'),
          deactivated_at = CASE WHEN worker_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid;
    ELSE
      worker_status := COALESCE(NULLIF(btrim(entry->>'status'), ''), 'active');
      INSERT INTO public.labour_workers
        (worker_code, contractor_id, name, skill_type, department, status, deactivated_at)
      VALUES
        (code, contractor_uuid, worker_name, btrim(entry->>'skill_type'), 'site', worker_status,
         CASE WHEN worker_status = 'inactive' THEN now() ELSE NULL END)
      RETURNING id INTO worker_uuid;
    END IF;

    INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, hourly_rate)
    VALUES (worker_uuid, salary_value, rate_value)
    ON CONFLICT (worker_id) DO UPDATE
      SET monthly_salary = EXCLUDED.monthly_salary,
          hourly_rate = EXCLUDED.hourly_rate,
          updated_at = now();
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_labour_attendance(
  p_project_id uuid,
  p_work_date date,
  p_rows jsonb,
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry jsonb;
  imported integer := 0;
  reason_value text := NULLIF(btrim(p_reason), '');
  old_hours_value numeric;
  new_hours_value numeric;
  attendance_uuid uuid;
  worker_uuid uuid;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
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
    worker_uuid := NULLIF(entry->>'worker_id', '')::uuid;
    IF worker_uuid IS NULL OR NULLIF(entry->>'hours', '') IS NULL THEN
      RAISE EXCEPTION 'Each attendance row needs a worker and hours';
    END IF;
    new_hours_value := (entry->>'hours')::numeric;
    IF new_hours_value < 0 OR new_hours_value > 16 THEN
      RAISE EXCEPTION 'Attendance hours must be between 0 and 16';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.labour_workers w WHERE w.id = worker_uuid) THEN
      RAISE EXCEPTION 'Worker not found';
    END IF;
    SELECT a.id, a.hours INTO attendance_uuid, old_hours_value
    FROM public.labour_attendance a
    WHERE a.work_date = p_work_date AND a.project_id = p_project_id AND a.worker_id = worker_uuid;
    IF attendance_uuid IS NOT NULL AND old_hours_value IS DISTINCT FROM new_hours_value THEN
      IF reason_value IS NULL AND p_work_date < current_date THEN
        RAISE EXCEPTION 'A reason is required when changing a saved attendance record';
      END IF;
      INSERT INTO public.labour_attendance_edit_log
        (attendance_id, old_hours, new_hours, reason, edited_by)
      VALUES (attendance_uuid, old_hours_value, new_hours_value,
        COALESCE(reason_value, 'Routine attendance update'), auth.uid());
    END IF;
  END LOOP;

  INSERT INTO public.labour_attendance (work_date, worker_id, project_id, hours, recorded_by)
  SELECT p_work_date, (entry->>'worker_id')::uuid, p_project_id, (entry->>'hours')::numeric, auth.uid()
  FROM jsonb_array_elements(p_rows) entry
  ON CONFLICT (work_date, worker_id, project_id) DO UPDATE
    SET hours = EXCLUDED.hours,
        recorded_by = EXCLUDED.recorded_by,
        recorded_at = now()
    WHERE public.labour_attendance.hours IS DISTINCT FROM EXCLUDED.hours;
  GET DIAGNOSTICS imported = ROW_COUNT;
  RETURN imported;
END;
$$;