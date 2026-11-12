ALTER TABLE public.labour_workers ADD COLUMN worker_code text UNIQUE;

WITH numbered AS (
  SELECT id, 'LW-' || lpad(row_number() OVER (ORDER BY created_at, id)::text, 3, '0') AS worker_code
  FROM public.labour_workers
)
UPDATE public.labour_workers w
SET worker_code = numbered.worker_code
FROM numbered
WHERE numbered.id = w.id;

CREATE OR REPLACE VIEW public.labour_worker_rates WITH (security_barrier = true) AS
SELECT
  w.id AS worker_id,
  w.worker_code,
  w.name,
  c.company_name AS contractor,
  w.skill_type,
  w.status,
  comp.hourly_rate,
  comp.monthly_salary,
  COALESCE(comp.hourly_rate, comp.monthly_salary / 208) AS effective_hourly_rate
FROM public.labour_workers w
LEFT JOIN public.labour_contractors c ON c.id = w.contractor_id
LEFT JOIN public.labour_worker_compensation comp ON comp.worker_id = w.id
WHERE public.get_user_role(auth.uid())::text = ANY (ARRAY[
  'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
  'managing_director', 'super_admin', 'finance_manager'
]);
GRANT SELECT ON public.labour_worker_rates TO authenticated;
GRANT ALL ON public.labour_worker_rates TO service_role;

CREATE TABLE public.labour_worker_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.labour_workers(id),
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.labour_worker_status_log TO service_role;
ALTER TABLE public.labour_worker_status_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_labour_worker_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.labour_worker_status_log (worker_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER labour_worker_status_audit
AFTER UPDATE OF status ON public.labour_workers
FOR EACH ROW EXECUTE FUNCTION public.log_labour_worker_status_change();

CREATE TABLE public.labour_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date date NOT NULL,
  worker_id uuid NOT NULL REFERENCES public.labour_workers(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  hours numeric NOT NULL CHECK (hours >= 0 AND hours <= 16),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_date, worker_id, project_id)
);
GRANT SELECT, INSERT, UPDATE ON public.labour_attendance TO authenticated;
GRANT ALL ON public.labour_attendance TO service_role;
ALTER TABLE public.labour_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Labour roles read project attendance"
ON public.labour_attendance FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ])
  AND public.user_can_access_project(auth.uid(), project_id)
);
CREATE POLICY "Labour roles insert project attendance"
ON public.labour_attendance FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ])
  AND public.user_can_access_project(auth.uid(), project_id)
);
CREATE POLICY "Labour roles update project attendance"
ON public.labour_attendance FOR UPDATE TO authenticated
USING (
  public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ])
  AND public.user_can_access_project(auth.uid(), project_id)
)
WITH CHECK (
  public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ])
  AND public.user_can_access_project(auth.uid(), project_id)
);

CREATE TABLE public.labour_attendance_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.labour_attendance(id),
  old_hours numeric NOT NULL,
  new_hours numeric NOT NULL,
  reason text NOT NULL,
  edited_by uuid,
  edited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.labour_attendance_edit_log TO authenticated;
GRANT ALL ON public.labour_attendance_edit_log TO service_role;
ALTER TABLE public.labour_attendance_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Labour roles read attendance edit history"
ON public.labour_attendance_edit_log FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ])
  AND EXISTS (
    SELECT 1 FROM public.labour_attendance a
    WHERE a.id = attendance_id
      AND public.user_can_access_project(auth.uid(), a.project_id)
  )
);

CREATE OR REPLACE FUNCTION public.log_labour_attendance_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE edit_reason text;
BEGIN
  IF OLD.hours IS DISTINCT FROM NEW.hours THEN
    edit_reason := NULLIF(btrim(current_setting('app.labour_attendance_reason', true)), '');
    IF OLD.work_date < current_date - 2 AND edit_reason IS NULL THEN
      RAISE EXCEPTION 'A reason is required for attendance changes more than two days old';
    END IF;
    INSERT INTO public.labour_attendance_edit_log
      (attendance_id, old_hours, new_hours, reason, edited_by)
    VALUES
      (OLD.id, OLD.hours, NEW.hours, COALESCE(edit_reason, 'Routine attendance update'), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER labour_attendance_edit_audit
BEFORE UPDATE OF hours ON public.labour_attendance
FOR EACH ROW EXECUTE FUNCTION public.log_labour_attendance_edit();

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
  contractor_name text;
  contractor_uuid uuid;
  worker_uuid uuid;
  worker_status text;
  rate_value numeric;
  salary_value numeric;
  imported integer := 0;
BEGIN
  IF public.get_user_role(auth.uid())::text <> ALL (ARRAY['planning_head', 'managing_director', 'super_admin', 'head_of_projects']) THEN
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

    SELECT id, name INTO worker_uuid, contractor_name FROM public.labour_workers WHERE worker_code = code;
    IF worker_uuid IS NOT NULL THEN
      IF contractor_name IS DISTINCT FROM worker_name THEN
        RAISE EXCEPTION 'Row %: worker name cannot be changed for an existing code', row_number + 1;
      END IF;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid,
          skill_type = btrim(entry->>'skill_type'),
          status = worker_status,
          deactivated_at = CASE WHEN worker_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid;
    ELSE
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
REVOKE ALL ON FUNCTION public.commit_labour_master_upload(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_labour_master_upload(jsonb) TO authenticated;

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
BEGIN
  IF public.get_user_role(auth.uid())::text <> ALL (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin', 'finance_manager'
  ]) THEN
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
    IF NULLIF(entry->>'worker_id', '') IS NULL OR NULLIF(entry->>'hours', '') IS NULL THEN
      RAISE EXCEPTION 'Each attendance row needs a worker and hours';
    END IF;
    IF (entry->>'hours')::numeric < 0 OR (entry->>'hours')::numeric > 16 THEN
      RAISE EXCEPTION 'Attendance hours must be between 0 and 16';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.labour_workers w WHERE w.id = (entry->>'worker_id')::uuid) THEN
      RAISE EXCEPTION 'Worker not found';
    END IF;
  END LOOP;

  PERFORM set_config('app.labour_attendance_reason', COALESCE(reason_value, 'Routine attendance update'), true);
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
REVOKE ALL ON FUNCTION public.save_labour_attendance(uuid, date, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_labour_attendance(uuid, date, jsonb, text) TO authenticated;