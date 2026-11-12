CREATE OR REPLACE VIEW public.labour_worker_directory WITH (security_barrier = true) AS
SELECT
  w.id AS worker_id,
  w.worker_code,
  w.name,
  c.company_name AS contractor,
  w.skill_type,
  w.status,
  w.deactivated_at
FROM public.labour_workers w
LEFT JOIN public.labour_contractors c ON c.id = w.contractor_id
WHERE COALESCE(public.can_access_labour_register(auth.uid()), false)
   OR COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY[
     'site_engineer', 'head_of_projects', 'planning_head'
   ]), false);
GRANT SELECT ON public.labour_worker_directory TO authenticated;
GRANT ALL ON public.labour_worker_directory TO service_role;

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
  attendance_uuid uuid;
  current_hours numeric;
  proposed_hours numeric;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY[
    'site_engineer', 'site_installation_mgr', 'head_of_projects', 'planning_head',
    'managing_director', 'super_admin'
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
    IF NULLIF(entry->>'worker_id', '') IS NULL OR NULLIF(entry->>'hours', '') IS NULL THEN
      RAISE EXCEPTION 'Each attendance row needs a worker and hours';
    END IF;
    proposed_hours := (entry->>'hours')::numeric;
    IF proposed_hours < 0 OR proposed_hours > 16 THEN
      RAISE EXCEPTION 'Attendance hours must be between 0 and 16';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.labour_workers w WHERE w.id = (entry->>'worker_id')::uuid) THEN
      RAISE EXCEPTION 'Worker not found';
    END IF;
    SELECT id, hours INTO attendance_uuid, current_hours
    FROM public.labour_attendance
    WHERE work_date = p_work_date AND project_id = p_project_id AND worker_id = (entry->>'worker_id')::uuid;
    IF attendance_uuid IS NOT NULL AND current_hours IS DISTINCT FROM proposed_hours AND reason_value IS NULL THEN
      RAISE EXCEPTION 'A reason is required when changing saved attendance';
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