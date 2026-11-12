-- A. Construction vs process marker (task_type already exists as an enum, so a new column is used)
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS work_category text NOT NULL DEFAULT 'process';
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_work_category_chk CHECK (work_category IN ('process','construction'));
-- Backfill: rows inserted by the setup upload RPC never get stage_number/display_order; template clones always do.
UPDATE public.project_tasks SET work_category='construction'
 WHERE stage_number IS NULL AND display_order IS NULL AND parent_task_id IS NULL;

-- B. Extend daily_measurements / measurement_line_items
ALTER TABLE public.daily_measurements
  ADD COLUMN IF NOT EXISTS report_status text,
  ADD COLUMN IF NOT EXISTS site_clean boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_clean_photo_path text;
ALTER TABLE public.daily_measurements ADD CONSTRAINT daily_measurements_report_status_chk CHECK (report_status IS NULL OR report_status IN ('draft','submitted'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_dm_site_report_project_date ON public.daily_measurements(project_id, measurement_date)
  WHERE trade='daily_site_report' AND is_archived=false;
ALTER TABLE public.measurement_line_items ADD COLUMN IF NOT EXISTS remarks text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mli_site_report_boq ON public.measurement_line_items(measurement_id, boq_item_id);

CREATE OR REPLACE FUNCTION public.can_write_site_report(_uid uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid IS NOT NULL AND public.user_can_access_project(_uid,_project_id) AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id=_uid AND r.role::text IN
      ('site_engineer','site_installation_mgr','head_of_projects','planning_head','managing_director','super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.safe_uuid(_t text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN _t::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE TABLE public.site_report_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id),
  completion_percentage_after numeric CHECK (completion_percentage_after IS NULL OR (completion_percentage_after BETWEEN 0 AND 100)),
  remarks text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, task_id));
CREATE TABLE public.site_report_labour (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id),
  hours numeric NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 2000),
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, task_id));
CREATE TABLE public.site_report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  kind text NOT NULL CHECK (kind IN ('elevation_front','elevation_rear','elevation_left','elevation_right','site_clean','other')),
  storage_path text NOT NULL,
  exif_taken_at timestamptz,
  gps_lat double precision, gps_lng double precision,
  gps_source text NOT NULL DEFAULT 'none' CHECK (gps_source IN ('exif','device','none')),
  from_gallery boolean NOT NULL DEFAULT false,
  flags text[] NOT NULL DEFAULT '{}',
  is_archived boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL);
CREATE TABLE public.site_report_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  edited_by uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL, old_value text, new_value text);
CREATE INDEX ON public.site_report_task_progress(report_id);
CREATE INDEX ON public.site_report_labour(report_id);
CREATE INDEX ON public.site_report_photos(report_id);
CREATE INDEX ON public.site_report_edit_log(report_id);

GRANT SELECT ON public.site_report_task_progress, public.site_report_labour, public.site_report_photos, public.site_report_edit_log TO authenticated;
GRANT ALL ON public.site_report_task_progress, public.site_report_labour, public.site_report_photos, public.site_report_edit_log TO service_role;
ALTER TABLE public.site_report_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY srtp_read ON public.site_report_task_progress FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY srl_read ON public.site_report_labour FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY srp_read ON public.site_report_photos FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY srel_read ON public.site_report_edit_log FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
-- Writes go only through the SECURITY DEFINER RPCs below, which check can_write_site_report.

-- Storage: path = <project_id>/<report_id>/<file>
CREATE POLICY site_report_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='site-report-photos' AND public.user_can_access_project(auth.uid(), public.safe_uuid((storage.foldername(name))[1])));
CREATE POLICY site_report_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='site-report-photos' AND public.can_write_site_report(auth.uid(), public.safe_uuid((storage.foldername(name))[1])));

-- Helpers
CREATE OR REPLACE FUNCTION public.site_report_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;

CREATE OR REPLACE FUNCTION public._site_report_log(_report uuid, _project uuid, _field text, _old text, _new text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _old IS DISTINCT FROM _new THEN
    INSERT INTO public.site_report_edit_log(report_id,project_id,edited_by,field,old_value,new_value)
    VALUES (_report,_project,auth.uid(),_field,_old,_new);
  END IF;
END $$;

-- Read everything the screen needs (no rates/amounts)
CREATE OR REPLACE FUNCTION public.get_site_report(p_project_id uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE; v_boq uuid;
BEGIN
  IF NOT public.user_can_access_project(auth.uid(), p_project_id) THEN RAISE EXCEPTION 'No access to this project'; END IF;
  SELECT * INTO r FROM public.daily_measurements WHERE project_id=p_project_id AND measurement_date=p_date AND trade='daily_site_report' AND is_archived=false;
  SELECT id INTO v_boq FROM public.project_boq WHERE project_id=p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'can_write', public.can_write_site_report(auth.uid(), p_project_id),
    'today', public.site_report_today(),
    'report', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'status',r.report_status,'notes',r.notes,'site_clean',r.site_clean,
        'site_clean_photo_path',r.site_clean_photo_path,'submitted_by',r.submitted_by,'submitted_at',r.submitted_at,'created_by',r.created_by) END,
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'code',t.task_id_in_schedule,'name',t.task_name,'pct',t.completion_percentage,
        'planned_start',t.planned_start_date,'actual_start',t.actual_start_date) ORDER BY t.planned_start_date, t.task_id_in_schedule)
      FROM public.project_tasks t WHERE t.project_id=p_project_id AND t.work_category='construction'
        AND t.planned_start_date IS NOT NULL AND t.planned_start_date<=p_date
        AND (t.completion_percentage<100 OR EXISTS (SELECT 1 FROM public.site_report_task_progress p WHERE p.report_id=r.id AND p.task_id=t.id))),'[]'::jsonb),
    'boq', coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'task_id',b.schedule_task_id,'description',b.item_description,'unit',b.unit,'boq_qty',b.boq_qty,
        'cumulative',(SELECT coalesce(sum(li.today_qty),0) FROM public.measurement_line_items li JOIN public.daily_measurements d ON d.id=li.measurement_id
           WHERE li.boq_item_id=b.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.id IS DISTINCT FROM r.id)) ORDER BY b.sno)
      FROM public.project_boq_items b WHERE b.boq_id=v_boq AND b.schedule_task_id IS NOT NULL),'[]'::jsonb),
    'progress', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'pct',completion_percentage_after,'remarks',remarks)) FROM public.site_report_task_progress WHERE report_id=r.id),'[]'::jsonb),
    'labour', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'hours',hours)) FROM public.site_report_labour WHERE report_id=r.id),'[]'::jsonb),
    'quantities', coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'today_qty',today_qty,'remarks',remarks)) FROM public.measurement_line_items WHERE measurement_id=r.id),'[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'storage_path',storage_path,'flags',flags,'gps_source',gps_source,'exif_taken_at',exif_taken_at,'uploaded_at',uploaded_at) ORDER BY uploaded_at)
      FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false),'[]'::jsonb),
    'attendance', (SELECT jsonb_build_object('workers',count(DISTINCT worker_id),'hours',coalesce(sum(hours),0)) FROM public.labour_attendance WHERE project_id=p_project_id AND work_date=p_date AND hours>0)
  );
END $$;

CREATE OR REPLACE FUNCTION public._site_report_check_window(p_project_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_write_site_report(auth.uid(), p_project_id) THEN RAISE EXCEPTION 'You cannot write site reports for this project'; END IF;
  IF p_date > public.site_report_today() THEN RAISE EXCEPTION 'Future dates are not allowed'; END IF;
  IF p_date < public.site_report_today() - 2 THEN RAISE EXCEPTION 'Only the last 3 days can be reported'; END IF;
END $$;

-- Save draft (autosave). Payload: {notes, site_clean, progress:[{task_id,pct,remarks}], labour:[{task_id,hours}], quantities:[{boq_item_id,today_qty,remarks}]}
CREATE OR REPLACE FUNCTION public.save_site_report_draft(p_project_id uuid, p_date date, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE; e jsonb; v_log boolean; v_old text; v_new text; v_tid uuid; v_bid uuid;
BEGIN
  PERFORM public._site_report_check_window(p_project_id, p_date);
  SELECT * INTO r FROM public.daily_measurements WHERE project_id=p_project_id AND measurement_date=p_date AND trade='daily_site_report' AND is_archived=false FOR UPDATE;
  IF r.id IS NULL THEN
    INSERT INTO public.daily_measurements(project_id,measurement_date,location,trade,stage,is_locked,submitted_by,created_by,updated_by,report_status,notes,site_clean)
    VALUES (p_project_id,p_date,'site','daily_site_report','Daily Site Report',false,auth.uid(),auth.uid(),auth.uid(),'draft',
            nullif(btrim(coalesce(p_payload->>'notes','')),''),coalesce((p_payload->>'site_clean')::boolean,false))
    RETURNING * INTO r;
    v_log := false;
  ELSE
    IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the person who submitted this report can edit it';
    END IF;
    -- every change after the day ends, or after submit, is logged
    v_log := r.report_status='submitted' OR p_date < public.site_report_today();
    IF p_payload ? 'notes' THEN
      v_new := nullif(btrim(coalesce(p_payload->>'notes','')),'');
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'notes',r.notes,v_new); END IF;
      UPDATE public.daily_measurements SET notes=v_new WHERE id=r.id;
    END IF;
    IF p_payload ? 'site_clean' THEN
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'site_clean',r.site_clean::text,(p_payload->>'site_clean')); END IF;
      UPDATE public.daily_measurements SET site_clean=coalesce((p_payload->>'site_clean')::boolean,false) WHERE id=r.id;
    END IF;
    UPDATE public.daily_measurements SET updated_by=auth.uid(), updated_at=now() WHERE id=r.id;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'progress','[]'::jsonb)) LOOP
    v_tid := (e->>'task_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id=v_tid AND project_id=p_project_id AND work_category='construction') THEN RAISE EXCEPTION 'Task not in this project'; END IF;
    SELECT completion_percentage_after::text INTO v_old FROM public.site_report_task_progress WHERE report_id=r.id AND task_id=v_tid;
    IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'progress:'||v_tid,v_old,e->>'pct'); END IF;
    INSERT INTO public.site_report_task_progress(report_id,project_id,task_id,completion_percentage_after,remarks,created_by,updated_by)
    VALUES (r.id,p_project_id,v_tid,nullif(e->>'pct','')::numeric,nullif(e->>'remarks',''),auth.uid(),auth.uid())
    ON CONFLICT (report_id,task_id) DO UPDATE SET completion_percentage_after=excluded.completion_percentage_after, remarks=excluded.remarks, updated_by=auth.uid(), updated_at=now();
  END LOOP;

  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'labour','[]'::jsonb)) LOOP
    v_tid := (e->>'task_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id=v_tid AND project_id=p_project_id) THEN RAISE EXCEPTION 'Task not in this project'; END IF;
    SELECT hours::text INTO v_old FROM public.site_report_labour WHERE report_id=r.id AND task_id=v_tid;
    IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'labour_hours:'||v_tid,v_old,e->>'hours'); END IF;
    INSERT INTO public.site_report_labour(report_id,project_id,task_id,hours,created_by,updated_by)
    VALUES (r.id,p_project_id,v_tid,coalesce(nullif(e->>'hours','')::numeric,0),auth.uid(),auth.uid())
    ON CONFLICT (report_id,task_id) DO UPDATE SET hours=excluded.hours, updated_by=auth.uid(), updated_at=now();
  END LOOP;

  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'quantities','[]'::jsonb)) LOOP
    v_bid := (e->>'boq_item_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.project_boq_items b JOIN public.project_boq h ON h.id=b.boq_id WHERE b.id=v_bid AND h.project_id=p_project_id) THEN RAISE EXCEPTION 'BOQ line not in this project'; END IF;
    SELECT today_qty::text INTO v_old FROM public.measurement_line_items WHERE measurement_id=r.id AND boq_item_id=v_bid;
    IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'qty:'||v_bid,v_old,e->>'today_qty'); END IF;
    INSERT INTO public.measurement_line_items(measurement_id,boq_item_id,today_qty,remarks)
    VALUES (r.id,v_bid,greatest(coalesce(nullif(e->>'today_qty','')::numeric,0),0),nullif(e->>'remarks',''))
    ON CONFLICT (measurement_id,boq_item_id) DO UPDATE SET today_qty=excluded.today_qty, remarks=excluded.remarks;
  END LOOP;
  RETURN r.id;
END $$;

CREATE OR REPLACE FUNCTION public.add_site_report_photo(p_report_id uuid, p_kind text, p_storage_path text, p_exif_taken_at timestamptz,
  p_gps_lat double precision, p_gps_lng double precision, p_gps_source text, p_from_gallery boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE; v_flags text[] := '{}'; v_lat double precision; v_lng double precision; v_dist double precision; v_old text;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id AND trade='daily_site_report';
  IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  PERFORM public._site_report_check_window(r.project_id, r.measurement_date);
  IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the submitter can edit this report'; END IF;
  IF split_part(p_storage_path,'/',1) <> r.project_id::text THEN RAISE EXCEPTION 'Invalid photo path'; END IF;
  IF p_exif_taken_at IS NULL THEN v_flags := v_flags || 'no_exif'::text;
  ELSIF (p_exif_taken_at AT TIME ZONE 'Asia/Kolkata')::date <> r.measurement_date THEN v_flags := v_flags || 'date_mismatch'::text; END IF;
  IF p_from_gallery THEN v_flags := v_flags || 'gallery'::text; END IF;
  SELECT site_lat, site_lng INTO v_lat, v_lng FROM public.projects WHERE id=r.project_id;
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL AND p_gps_lat IS NOT NULL AND p_gps_lng IS NOT NULL THEN
    v_dist := 2*6371000*asin(sqrt(power(sin(radians(p_gps_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(p_gps_lat))*power(sin(radians(p_gps_lng-v_lng)/2),2)));
    IF v_dist > 500 THEN v_flags := v_flags || 'far_from_site'::text; END IF;
  END IF;
  -- replace previous photo of the same slot (archive, never delete)
  IF p_kind <> 'other' THEN
    SELECT storage_path INTO v_old FROM public.site_report_photos WHERE report_id=r.id AND kind=p_kind AND is_archived=false LIMIT 1;
    UPDATE public.site_report_photos SET is_archived=true WHERE report_id=r.id AND kind=p_kind AND is_archived=false;
  END IF;
  IF r.report_status='submitted' OR r.measurement_date < public.site_report_today() THEN
    PERFORM public._site_report_log(r.id,r.project_id,'photo:'||p_kind,v_old,p_storage_path);
  END IF;
  INSERT INTO public.site_report_photos(report_id,project_id,kind,storage_path,exif_taken_at,gps_lat,gps_lng,gps_source,from_gallery,flags,uploaded_by)
  VALUES (r.id,r.project_id,p_kind,p_storage_path,p_exif_taken_at,p_gps_lat,p_gps_lng,coalesce(p_gps_source,'none'),coalesce(p_from_gallery,false),v_flags,auth.uid());
  IF p_kind='site_clean' THEN UPDATE public.daily_measurements SET site_clean_photo_path=p_storage_path, updated_at=now() WHERE id=r.id; END IF;
  RETURN jsonb_build_object('flags', to_jsonb(v_flags));
END $$;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE; p record; v_tasks int := 0; v_wip numeric; v_rated int; v_qty int;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id AND trade='daily_site_report' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  PERFORM public._site_report_check_window(r.project_id, r.measurement_date);
  IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the submitter can edit this report'; END IF;
  IF (SELECT count(DISTINCT kind) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false
      AND kind IN ('elevation_front','elevation_rear','elevation_left','elevation_right')) < 4 THEN RAISE EXCEPTION 'All four elevation photos are required'; END IF;
  IF NOT r.site_clean OR r.site_clean_photo_path IS NULL THEN RAISE EXCEPTION 'Site clean tick and photo are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_report_task_progress WHERE report_id=r.id AND completion_percentage_after IS NOT NULL)
     AND length(btrim(coalesce(r.notes,''))) < 5 THEN RAISE EXCEPTION 'Enter progress on at least one task, or explain in notes why no work happened'; END IF;

  FOR p IN SELECT sp.task_id, sp.completion_percentage_after pct, t.completion_percentage old_pct, t.actual_start_date, t.actual_finish_date
           FROM public.site_report_task_progress sp JOIN public.project_tasks t ON t.id=sp.task_id
           WHERE sp.report_id=r.id AND sp.completion_percentage_after IS NOT NULL LOOP
    UPDATE public.project_tasks SET
      completion_percentage = round(p.pct)::int,
      actual_start_date = coalesce(actual_start_date, r.measurement_date),
      actual_finish_date = CASE WHEN round(p.pct)>=100 THEN coalesce(actual_finish_date, r.measurement_date) ELSE actual_finish_date END,
      updated_at = now()
    WHERE id=p.task_id;
    PERFORM public._site_report_log(r.id,r.project_id,'task_pct:'||p.task_id,p.old_pct::text,round(p.pct)::text);
    v_tasks := v_tasks+1;
  END LOOP;

  SELECT count(*) FILTER (WHERE li.today_qty>0), count(*) FILTER (WHERE li.today_qty>0 AND b.boq_rate>0),
         sum(li.today_qty*b.boq_rate) FILTER (WHERE b.boq_rate>0)
    INTO v_qty, v_rated, v_wip
  FROM public.measurement_line_items li JOIN public.project_boq_items b ON b.id=li.boq_item_id WHERE li.measurement_id=r.id;
  UPDATE public.daily_measurements SET
    total_wip_today = coalesce(v_wip,0),
    wip_needs_review = (v_rated = 0 AND v_qty > 0) OR v_rated < v_qty,
    wip_review_reason = CASE WHEN v_rated < v_qty THEN 'Some quantities have no BOQ rate; WIP not computed for them' ELSE NULL END,
    report_status='submitted', submitted_by=auth.uid(), submitted_at=now(), updated_by=auth.uid(), updated_at=now()
  WHERE id=r.id;
  PERFORM public._site_report_log(r.id,r.project_id,'status',coalesce(r.report_status,'draft'),'submitted');
  RETURN jsonb_build_object('tasks_updated',v_tasks,'quantity_lines',v_qty,
    'photos',(SELECT count(*) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false));
END $$;

REVOKE ALL ON FUNCTION public.get_site_report(uuid,date), public.save_site_report_draft(uuid,date,jsonb),
  public.add_site_report_photo(uuid,text,text,timestamptz,double precision,double precision,text,boolean), public.submit_site_report(uuid),
  public._site_report_log(uuid,uuid,text,text,text), public._site_report_check_window(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_site_report(uuid,date), public.save_site_report_draft(uuid,date,jsonb),
  public.add_site_report_photo(uuid,text,text,timestamptz,double precision,double precision,text,boolean), public.submit_site_report(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._site_report_log(uuid,uuid,text,text,text), public._site_report_check_window(uuid,date) FROM authenticated;

-- Setup upload: tag every task it inserts as construction
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.commit_project_setup_upload(uuid,jsonb,jsonb,jsonb)'::regprocedure);
  d := replace(d, 'planned_finish_date,responsible_role)
      VALUES (p_project_id,v_code,v_task_name,v_start,v_end,v_role) RETURNING', 'planned_finish_date,responsible_role,work_category)
      VALUES (p_project_id,v_code,v_task_name,v_start,v_end,v_role,''construction'') RETURNING');
  IF position('work_category' in d)=0 THEN RAISE EXCEPTION 'Setup upload patch did not apply'; END IF;
  EXECUTE d;
END $do$;