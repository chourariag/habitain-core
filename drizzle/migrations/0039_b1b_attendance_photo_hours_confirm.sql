ALTER TABLE public.labour_attendance
  ADD COLUMN IF NOT EXISTS hours_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS hours_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_photo_exception boolean NOT NULL DEFAULT false;
UPDATE public.labour_attendance SET hours_confirmed = true WHERE hours_confirmed = false;

CREATE TABLE public.labour_attendance_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  work_date date NOT NULL,
  storage_path text NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  gps_lat numeric NOT NULL,
  gps_lng numeric NOT NULL,
  gps_accuracy_m numeric NOT NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid NOT NULL
);
CREATE INDEX ON public.labour_attendance_photos(project_id, work_date);
GRANT SELECT ON public.labour_attendance_photos TO authenticated;
GRANT ALL ON public.labour_attendance_photos TO service_role;
ALTER TABLE public.labour_attendance_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.labour_attendance_photo_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  work_date date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  rows_affected integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.labour_attendance_photo_exceptions TO authenticated;
GRANT ALL ON public.labour_attendance_photo_exceptions TO service_role;
ALTER TABLE public.labour_attendance_photo_exceptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ist_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;

CREATE OR REPLACE FUNCTION public.can_record_labour_attendance(_uid uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND COALESCE(public.get_user_role(_uid)::text = ANY (ARRAY[
    'site_engineer','site_installation_mgr','head_of_projects','planning_head','managing_director','finance_director','sales_director','architecture_director','super_admin']), false)
    AND public.user_can_access_project(_uid, _project)
$$;

CREATE OR REPLACE FUNCTION public.can_read_attendance_photos(_uid uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_record_labour_attendance(_uid, _project)
      OR public.is_tier1_or_super(_uid)
      OR COALESCE(public.get_user_role(_uid)::text IN ('head_of_projects','planning_head'), false)
$$;

CREATE OR REPLACE FUNCTION public.can_attendance_photo_exception(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_tier1_or_super(_uid) OR COALESCE(public.get_user_role(_uid)::text IN ('head_of_projects','super_admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.attendance_photo_object_project(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN split_part(_name, '/', 1)::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE POLICY "attendance photos readers" ON public.labour_attendance_photos FOR SELECT TO authenticated
  USING (public.can_read_attendance_photos(auth.uid(), project_id));
CREATE POLICY "attendance photo exceptions readers" ON public.labour_attendance_photo_exceptions FOR SELECT TO authenticated
  USING (public.can_read_attendance_photos(auth.uid(), project_id));

CREATE POLICY "attendance-photos upload today by writers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos'
    AND public.can_record_labour_attendance(auth.uid(), public.attendance_photo_object_project(name))
    AND split_part(name, '/', 2) = to_char(public.ist_today(), 'YYYY-MM-DD'));
CREATE POLICY "attendance-photos read by readers" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-photos'
    AND public.can_read_attendance_photos(auth.uid(), public.attendance_photo_object_project(name)));

CREATE OR REPLACE FUNCTION public.add_attendance_photo(p_project_id uuid, p_storage_path text, p_captured_at timestamptz,
  p_lat numeric, p_lng numeric, p_accuracy_m numeric)
RETURNS public.labour_attendance_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := public.ist_today(); v_p record; v_radius numeric; v_dist numeric; v_flags jsonb := '{}'::jsonb; v_row public.labour_attendance_photos;
BEGIN
  IF NOT public.can_record_labour_attendance(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'You cannot record attendance on this project' USING ERRCODE = '42501'; END IF;
  IF p_storage_path IS NULL OR split_part(p_storage_path,'/',1) <> p_project_id::text OR split_part(p_storage_path,'/',2) <> to_char(v_today,'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'Toolbox talk photos can only be added for today'; END IF;
  IF p_captured_at IS NULL OR abs(extract(epoch FROM (now() - p_captured_at))) > 600 THEN
    RAISE EXCEPTION 'Photo time is more than 10 minutes from server time. Check the phone clock and take the photo again.'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL THEN RAISE EXCEPTION 'A GPS location is required'; END IF;
  IF (SELECT count(*) FROM public.labour_attendance_photos WHERE project_id=p_project_id AND work_date=v_today) >= 3 THEN
    RAISE EXCEPTION 'Up to 3 toolbox talk photos per day'; END IF;
  SELECT site_lat, site_lng, site_radius INTO v_p FROM public.projects WHERE id=p_project_id;
  v_radius := COALESCE(v_p.site_radius::numeric, 500);
  IF v_p.site_lat IS NOT NULL AND v_p.site_lng IS NOT NULL THEN
    v_dist := 2 * 6371000 * asin(sqrt(power(sin(radians(p_lat - v_p.site_lat::numeric)/2),2)
      + cos(radians(v_p.site_lat::numeric)) * cos(radians(p_lat)) * power(sin(radians(p_lng - v_p.site_lng::numeric)/2),2)));
    IF v_dist > v_radius THEN v_flags := v_flags || jsonb_build_object('far_from_site', true, 'distance_m', round(v_dist)); END IF;
  END IF;
  IF p_accuracy_m > 100 THEN v_flags := v_flags || jsonb_build_object('low_accuracy', true); END IF;
  INSERT INTO public.labour_attendance_photos(project_id, work_date, storage_path, captured_at, gps_lat, gps_lng, gps_accuracy_m, flags, uploaded_by)
  VALUES (p_project_id, v_today, p_storage_path, p_captured_at, p_lat, p_lng, p_accuracy_m, v_flags, auth.uid()) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.get_labour_standard_hours() RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(value,'')::numeric FROM public.app_settings WHERE key='labour_standard_hours' LIMIT 1), 8)
$$;

CREATE OR REPLACE FUNCTION public.set_labour_standard_hours(p_hours numeric) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_hours IS NULL OR p_hours <= 0 OR p_hours > 16 THEN RAISE EXCEPTION 'Standard hours must be more than 0 and at most 16'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_settings WHERE key='labour_standard_hours') THEN
    UPDATE public.app_settings SET value=p_hours::text, updated_by=auth.uid(), updated_at=now() WHERE key='labour_standard_hours';
  ELSE
    INSERT INTO public.app_settings(key, value, updated_by, updated_at) VALUES ('labour_standard_hours', p_hours::text, auth.uid(), now());
  END IF;
  RETURN p_hours;
END $$;

CREATE OR REPLACE FUNCTION public.save_labour_attendance(p_project_id uuid, p_work_date date, p_rows jsonb, p_reason text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  entry jsonb; imported integer := 0; reason_value text := NULLIF(btrim(p_reason), '');
  attendance_uuid uuid; current_hours numeric; proposed_hours numeric; v_exception boolean := false;
BEGIN
  IF NOT public.can_record_labour_attendance(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Not authorized to save labour attendance for this project' USING ERRCODE = '42501';
  END IF;
  IF p_work_date > public.ist_today() THEN RAISE EXCEPTION 'Future attendance cannot be saved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labour_attendance_photos WHERE project_id=p_project_id AND work_date=p_work_date) THEN
    IF p_work_date >= public.ist_today() THEN RAISE EXCEPTION 'Take the toolbox talk photo first.'; END IF;
    IF NOT public.can_attendance_photo_exception(auth.uid()) THEN
      RAISE EXCEPTION 'Take the toolbox talk photo first.'; END IF;
    IF reason_value IS NULL OR length(reason_value) < 10 THEN
      RAISE EXCEPTION 'No toolbox talk photo for this day. Enter a reason of at least 10 characters.'; END IF;
    v_exception := true;
  END IF;
  IF p_work_date < public.ist_today() - 2 AND reason_value IS NULL THEN
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

  INSERT INTO public.labour_attendance (work_date, worker_id, project_id, hours, recorded_by, hours_confirmed, no_photo_exception)
  SELECT p_work_date, (e->>'worker_id')::uuid, p_project_id, (e->>'hours')::numeric, auth.uid(), false, v_exception
  FROM jsonb_array_elements(p_rows) e
  ON CONFLICT (work_date, worker_id, project_id) DO UPDATE
    SET hours = EXCLUDED.hours, recorded_by = EXCLUDED.recorded_by, recorded_at = now(),
        hours_confirmed = false, no_photo_exception = public.labour_attendance.no_photo_exception OR EXCLUDED.no_photo_exception
    WHERE public.labour_attendance.hours IS DISTINCT FROM EXCLUDED.hours OR (EXCLUDED.no_photo_exception AND NOT public.labour_attendance.no_photo_exception);
  GET DIAGNOSTICS imported = ROW_COUNT;
  IF v_exception THEN
    INSERT INTO public.labour_attendance_photo_exceptions(project_id, work_date, reason, rows_affected, created_by)
    VALUES (p_project_id, p_work_date, reason_value, imported, auth.uid());
  END IF;
  RETURN imported;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_labour_hours(p_project_id uuid, p_work_date date, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry jsonb; v_id uuid; v_old numeric; v_new numeric; v_exc boolean; n integer := 0;
BEGIN
  IF NOT public.can_record_labour_attendance(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Not authorized to confirm hours for this project' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Hours must contain a row list'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_new := NULLIF(entry->>'hours','')::numeric;
    IF v_new IS NULL OR v_new < 0 OR v_new > 16 THEN RAISE EXCEPTION 'Hours must be between 0 and 16'; END IF;
    v_id := NULL;
    SELECT id, hours, no_photo_exception INTO v_id, v_old, v_exc FROM public.labour_attendance
      WHERE project_id=p_project_id AND work_date=p_work_date AND worker_id=(entry->>'worker_id')::uuid FOR UPDATE;
    IF v_id IS NULL OR v_old <= 0 THEN RAISE EXCEPTION 'Worker is not marked present on this day'; END IF;
    IF NOT v_exc AND NOT EXISTS (SELECT 1 FROM public.labour_attendance_photos WHERE project_id=p_project_id AND work_date=p_work_date) THEN
      RAISE EXCEPTION 'Take the toolbox talk photo first.'; END IF;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.labour_attendance_edit_log (attendance_id, old_hours, new_hours, reason, edited_by)
      VALUES (v_id, v_old, v_new, 'Evening hours confirmation', auth.uid());
    END IF;
    UPDATE public.labour_attendance SET hours=v_new, hours_confirmed=true, hours_confirmed_by=auth.uid(), hours_confirmed_at=now() WHERE id=v_id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.add_attendance_photo(uuid,text,timestamptz,numeric,numeric,numeric) FROM anon, public;
REVOKE ALL ON FUNCTION public.confirm_labour_hours(uuid,date,jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.set_labour_standard_hours(numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_attendance_photo(uuid,text,timestamptz,numeric,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_labour_hours(uuid,date,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_labour_standard_hours(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_labour_standard_hours() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.daily_measurements%ROWTYPE; p record; v_tasks int := 0; v_skipped jsonb := '[]'::jsonb; v_wip numeric; v_rated int; v_qty int;
  q public.site_report_quantities%ROWTYPE; v_rate public.subcontract_rates%ROWTYPE; v_used numeric; v_ru numeric; v_sub numeric := 0; v_missing jsonb;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id AND trade='daily_site_report' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  PERFORM public._site_report_check_window(r.project_id, r.measurement_date);
  IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the submitter can edit this report'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_elevations WHERE project_id=r.project_id AND is_active) THEN
    RAISE EXCEPTION 'No elevations defined for this project'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_elevations e WHERE e.project_id=r.project_id AND e.is_active
      AND NOT EXISTS (SELECT 1 FROM public.site_report_photos ph WHERE ph.report_id=r.id AND ph.is_archived=false AND ph.kind='elevation' AND ph.elevation_id=e.id)) THEN
    RAISE EXCEPTION 'One photo is required for every elevation'; END IF;
  IF NOT r.site_clean OR r.site_clean_photo_path IS NULL THEN RAISE EXCEPTION 'Site clean tick and photo are required'; END IF;
  SELECT count(*) INTO v_qty FROM public.labour_attendance la WHERE la.project_id=r.project_id AND la.work_date=r.measurement_date AND la.hours>0 AND NOT la.hours_confirmed;
  IF v_qty > 0 THEN RAISE EXCEPTION 'Confirm hours for % workers in People.', v_qty; END IF;
  v_qty := NULL;
  IF NOT EXISTS (SELECT 1 FROM public.site_report_task_progress WHERE report_id=r.id AND completion_percentage_after IS NOT NULL)
     AND length(btrim(coalesce(r.notes,''))) < 5 THEN RAISE EXCEPTION 'Enter progress on at least one task, or explain in notes why no work happened'; END IF;

  FOR p IN SELECT sp.task_id, sp.completion_percentage_after pct, t.completion_percentage old_pct, t.task_id_in_schedule code
           FROM public.site_report_task_progress sp JOIN public.project_tasks t ON t.id=sp.task_id
           WHERE sp.report_id=r.id AND sp.completion_percentage_after IS NOT NULL LOOP
    IF EXISTS (SELECT 1 FROM public.site_report_task_progress o JOIN public.daily_measurements d ON d.id=o.report_id
               WHERE o.task_id=p.task_id AND o.completion_percentage_after IS NOT NULL AND d.id<>r.id
                 AND d.report_status='submitted' AND d.is_archived=false AND d.measurement_date>r.measurement_date) THEN
      v_skipped := v_skipped || jsonb_build_object('task_id',p.task_id,'code',p.code);
      CONTINUE;
    END IF;
    UPDATE public.project_tasks SET
      completion_percentage = round(p.pct)::int,
      actual_start_date = coalesce(actual_start_date, r.measurement_date),
      actual_finish_date = CASE WHEN round(p.pct)>=100 THEN coalesce(actual_finish_date, r.measurement_date) ELSE actual_finish_date END,
      updated_at = now()
    WHERE id=p.task_id;
    PERFORM public._site_report_log(r.id,r.project_id,'task_pct:'||p.task_id,p.old_pct::text,round(p.pct)::text);
    v_tasks := v_tasks+1;
  END LOOP;

  FOR q IN SELECT * FROM public.site_report_quantities WHERE report_id=r.id AND contractor_id IS NOT NULL AND today_qty>0 FOR UPDATE LOOP
    v_rate := NULL;
    IF q.boq_item_id IS NOT NULL THEN
      SELECT * INTO v_rate FROM public.subcontract_rates WHERE project_id=r.project_id AND contractor_id=q.contractor_id AND boq_item_id=q.boq_item_id AND is_active;
    ELSE
      SELECT * INTO v_rate FROM public.subcontract_rates WHERE project_id=r.project_id AND contractor_id=q.contractor_id AND boq_item_id IS NULL
        AND lower(btrim(work_description))=lower(btrim(q.extra_work_description)) AND is_active;
    END IF;
    IF v_rate.id IS NULL THEN RAISE EXCEPTION 'No rate for this contractor on this item. Ask Planning to add it in Setup.'; END IF;
    IF v_rate.rate_type='lump_sum' THEN
      SELECT coalesce(sum(o.today_qty),0) INTO v_used FROM public.site_report_quantities o JOIN public.daily_measurements d ON d.id=o.report_id
        WHERE o.rate_id=v_rate.id AND o.report_id<>r.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted';
      IF v_used + q.today_qty > v_rate.package_qty THEN
        RAISE EXCEPTION 'This takes the lump-sum package past its total: % of % % already recorded.', v_used, v_rate.package_qty, v_rate.unit;
      END IF;
    END IF;
    v_ru := CASE WHEN q.rate_used IS NOT NULL AND q.rate_id = v_rate.id THEN q.rate_used
                 ELSE public.subcontract_effective_rate(v_rate.rate_type,v_rate.rate_inr,v_rate.lump_sum_inr,v_rate.package_qty) END;
    UPDATE public.site_report_quantities SET rate_id=v_rate.id, rate_used=v_ru, amount_inr=round(q.today_qty*v_ru,2), updated_at=now() WHERE id=q.id;
    v_sub := v_sub + round(q.today_qty*v_ru,2);
  END LOOP;
  SELECT coalesce(jsonb_agg(DISTINCT c.company_name),'[]'::jsonb) INTO v_missing
    FROM public.site_report_quantities li JOIN public.labour_contractors c ON c.id=li.contractor_id
    WHERE li.report_id=r.id AND li.today_qty>0
      AND NOT EXISTS (SELECT 1 FROM public.site_report_subcontractor_headcount h WHERE h.report_id=r.id AND h.contractor_id=li.contractor_id AND h.headcount>0);

  SELECT count(*) FILTER (WHERE li.today_qty>0), count(*) FILTER (WHERE li.today_qty>0 AND b.boq_rate>0),
         sum(li.today_qty*b.boq_rate) FILTER (WHERE b.boq_rate>0)
    INTO v_qty, v_rated, v_wip
  FROM public.site_report_quantities li JOIN public.project_boq_items b ON b.id=li.boq_item_id WHERE li.report_id=r.id;
  INSERT INTO public.daily_measurement_wip(measurement_id,total_wip_today,wip_needs_review,wip_review_reason,created_by,updated_by)
  VALUES(r.id,coalesce(v_wip,0),(v_rated = 0 AND v_qty > 0) OR v_rated < v_qty,
    CASE WHEN v_rated < v_qty THEN 'Some quantities have no BOQ rate; WIP not computed for them' ELSE NULL END,auth.uid(),auth.uid())
  ON CONFLICT(measurement_id) DO UPDATE SET total_wip_today=excluded.total_wip_today,wip_needs_review=excluded.wip_needs_review,wip_review_reason=excluded.wip_review_reason,updated_by=auth.uid(),updated_at=now();
  UPDATE public.daily_measurements SET
    report_status='submitted', submitted_by=auth.uid(), submitted_at=now(), updated_by=auth.uid(), updated_at=now()
  WHERE id=r.id;
  PERFORM public._site_report_log(r.id,r.project_id,'status',coalesce(r.report_status,'draft'),'submitted');
  RETURN jsonb_build_object('tasks_updated',v_tasks,'tasks_skipped',v_skipped,'quantity_lines',v_qty,'subcontract_amount',v_sub,'headcount_missing',v_missing,
    'photos',(SELECT count(*) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false));
END $function$;