ALTER TABLE public.daily_measurements DROP CONSTRAINT daily_measurements_trade_check;
ALTER TABLE public.daily_measurements ADD CONSTRAINT daily_measurements_trade_check
  CHECK (trade = ANY (ARRAY['general','electrical','plumbing','structural','finishing','daily_site_report']::text[]));

CREATE TABLE public.project_elevations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  drawing_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_elevations_active_name_uq ON public.project_elevations(project_id, lower(btrim(name))) WHERE is_active;
GRANT SELECT ON public.project_elevations TO authenticated;
GRANT ALL ON public.project_elevations TO service_role;
ALTER TABLE public.project_elevations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_elevations_read" ON public.project_elevations FOR SELECT TO authenticated
  USING (public.user_can_access_project(auth.uid(), project_id));

CREATE TABLE public.project_elevation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevation_id uuid NOT NULL REFERENCES public.project_elevations(id),
  project_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,
  old_value text,
  new_value text
);
GRANT SELECT ON public.project_elevation_log TO authenticated;
GRANT ALL ON public.project_elevation_log TO service_role;
ALTER TABLE public.project_elevation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_elevation_log_read" ON public.project_elevation_log FOR SELECT TO authenticated
  USING (public.user_can_access_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.can_manage_project_elevations(_uid uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND public.user_can_access_project(_uid,_project_id) AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id=_uid AND r.role::text IN
      ('planning_head','managing_director','super_admin','head_of_projects'))
$$;

CREATE OR REPLACE FUNCTION public._elevation_log(_e uuid, _p uuid, _f text, _o text, _n text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _o IS DISTINCT FROM _n THEN
    INSERT INTO public.project_elevation_log(elevation_id,project_id,edited_by,field,old_value,new_value) VALUES (_e,_p,auth.uid(),_f,_o,_n);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_project_elevation(p_project_id uuid, p_id uuid, p_name text, p_drawing_ref text, p_sort_order integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.project_elevations%ROWTYPE; v_name text := btrim(coalesce(p_name,'')); v_ref text := nullif(btrim(coalesce(p_drawing_ref,'')),'');
BEGIN
  IF NOT public.can_manage_project_elevations(auth.uid(), p_project_id) THEN RAISE EXCEPTION 'Not allowed to manage elevations for this project'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'Elevation name is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_elevations WHERE project_id=p_project_id AND is_active AND lower(btrim(name))=lower(v_name) AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'An elevation with this name already exists'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.project_elevations(project_id,name,drawing_ref,sort_order,created_by)
    VALUES (p_project_id,v_name,v_ref,coalesce(p_sort_order,(SELECT coalesce(max(sort_order),0)+1 FROM public.project_elevations WHERE project_id=p_project_id AND is_active)),auth.uid())
    RETURNING * INTO e;
    PERFORM public._elevation_log(e.id,p_project_id,'created',NULL,v_name);
    RETURN e.id;
  END IF;
  SELECT * INTO e FROM public.project_elevations WHERE id=p_id AND project_id=p_project_id FOR UPDATE;
  IF e.id IS NULL OR NOT e.is_active THEN RAISE EXCEPTION 'Elevation not found'; END IF;
  PERFORM public._elevation_log(e.id,p_project_id,'name',e.name,v_name);
  PERFORM public._elevation_log(e.id,p_project_id,'drawing_ref',e.drawing_ref,v_ref);
  PERFORM public._elevation_log(e.id,p_project_id,'sort_order',e.sort_order::text,coalesce(p_sort_order,e.sort_order)::text);
  UPDATE public.project_elevations SET name=v_name, drawing_ref=v_ref, sort_order=coalesce(p_sort_order,sort_order) WHERE id=e.id;
  RETURN e.id;
END $$;

CREATE OR REPLACE FUNCTION public.archive_project_elevation(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.project_elevations%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.project_elevations WHERE id=p_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Elevation not found'; END IF;
  IF NOT public.can_manage_project_elevations(auth.uid(), e.project_id) THEN RAISE EXCEPTION 'Not allowed to manage elevations for this project'; END IF;
  IF NOT e.is_active THEN RETURN; END IF;
  UPDATE public.project_elevations SET is_active=false WHERE id=e.id;
  PERFORM public._elevation_log(e.id,e.project_id,'is_active','true','false');
END $$;

REVOKE ALL ON FUNCTION public.upsert_project_elevation(uuid,uuid,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_project_elevation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._elevation_log(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_project_elevation(uuid,uuid,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_project_elevation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project_elevations(uuid,uuid) TO authenticated;

ALTER TABLE public.site_report_photos ADD COLUMN elevation_id uuid REFERENCES public.project_elevations(id);
ALTER TABLE public.site_report_photos DROP CONSTRAINT site_report_photos_kind_check;
ALTER TABLE public.site_report_photos ADD CONSTRAINT site_report_photos_kind_check
  CHECK (kind = ANY (ARRAY['elevation_front','elevation_rear','elevation_left','elevation_right','site_clean','other','elevation']::text[]));

CREATE OR REPLACE FUNCTION public.add_site_report_elevation_photo(p_report_id uuid, p_elevation_id uuid, p_storage_path text, p_exif_taken_at timestamptz, p_gps_lat double precision, p_gps_lng double precision, p_gps_source text, p_from_gallery boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.daily_measurements%ROWTYPE; v_flags text[] := '{}'; v_lat double precision; v_lng double precision; v_dist double precision; v_old text;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id AND trade='daily_site_report';
  IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  PERFORM public._site_report_check_window(r.project_id, r.measurement_date);
  IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the submitter can edit this report'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_elevations WHERE id=p_elevation_id AND project_id=r.project_id AND is_active) THEN RAISE EXCEPTION 'Elevation not found'; END IF;
  IF split_part(p_storage_path,'/',1) <> r.project_id::text OR position(p_elevation_id::text IN p_storage_path)=0 THEN RAISE EXCEPTION 'Invalid photo path'; END IF;
  IF p_exif_taken_at IS NULL THEN v_flags := v_flags || 'no_exif'::text;
  ELSIF (p_exif_taken_at AT TIME ZONE 'Asia/Kolkata')::date <> r.measurement_date THEN v_flags := v_flags || 'date_mismatch'::text; END IF;
  IF p_from_gallery THEN v_flags := v_flags || 'gallery'::text; END IF;
  SELECT site_lat, site_lng INTO v_lat, v_lng FROM public.projects WHERE id=r.project_id;
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL AND p_gps_lat IS NOT NULL AND p_gps_lng IS NOT NULL THEN
    v_dist := 2*6371000*asin(sqrt(power(sin(radians(p_gps_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(p_gps_lat))*power(sin(radians(p_gps_lng-v_lng)/2),2)));
    IF v_dist > 500 THEN v_flags := v_flags || 'far_from_site'::text; END IF;
  END IF;
  SELECT storage_path INTO v_old FROM public.site_report_photos WHERE report_id=r.id AND kind='elevation' AND elevation_id=p_elevation_id AND is_archived=false LIMIT 1;
  UPDATE public.site_report_photos SET is_archived=true WHERE report_id=r.id AND kind='elevation' AND elevation_id=p_elevation_id AND is_archived=false;
  IF r.report_status='submitted' OR r.measurement_date < public.site_report_today() THEN
    PERFORM public._site_report_log(r.id,r.project_id,'photo:elevation:'||p_elevation_id,v_old,p_storage_path);
  END IF;
  INSERT INTO public.site_report_photos(report_id,project_id,kind,elevation_id,storage_path,exif_taken_at,gps_lat,gps_lng,gps_source,from_gallery,flags,uploaded_by)
  VALUES (r.id,r.project_id,'elevation',p_elevation_id,p_storage_path,p_exif_taken_at,p_gps_lat,p_gps_lng,coalesce(p_gps_source,'none'),coalesce(p_from_gallery,false),v_flags,auth.uid());
  RETURN jsonb_build_object('flags', to_jsonb(v_flags));
END $$;
REVOKE ALL ON FUNCTION public.add_site_report_elevation_photo(uuid,uuid,text,timestamptz,double precision,double precision,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_site_report_elevation_photo(uuid,uuid,text,timestamptz,double precision,double precision,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_site_report(p_project_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'planned_start',t.planned_start_date,'actual_start',t.actual_start_date) ORDER BY t.planned_start_date NULLS LAST, t.task_id_in_schedule)
      FROM public.project_tasks t WHERE t.project_id=p_project_id AND t.work_category='construction'
        AND (t.completion_percentage<100 OR EXISTS (SELECT 1 FROM public.site_report_task_progress p WHERE p.report_id=r.id AND p.task_id=t.id))),'[]'::jsonb),
    'boq', coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'task_id',b.schedule_task_id,'description',b.item_description,'unit',b.unit,'boq_qty',b.boq_qty,
        'cumulative',(SELECT coalesce(sum(li.today_qty),0) FROM public.measurement_line_items li JOIN public.daily_measurements d ON d.id=li.measurement_id
           WHERE li.boq_item_id=b.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.id IS DISTINCT FROM r.id)) ORDER BY b.sno)
      FROM public.project_boq_items b WHERE b.boq_id=v_boq AND b.schedule_task_id IS NOT NULL),'[]'::jsonb),
    'progress', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'pct',completion_percentage_after,'remarks',remarks)) FROM public.site_report_task_progress WHERE report_id=r.id),'[]'::jsonb),
    'labour', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'hours',hours)) FROM public.site_report_labour WHERE report_id=r.id),'[]'::jsonb),
    'quantities', coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'today_qty',today_qty,'remarks',remarks)) FROM public.measurement_line_items WHERE measurement_id=r.id),'[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'elevation_id',elevation_id,'storage_path',storage_path,'flags',flags,'gps_source',gps_source,'exif_taken_at',exif_taken_at,'uploaded_at',uploaded_at) ORDER BY uploaded_at)
      FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false),'[]'::jsonb),
    'elevations', coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'drawing_ref',e.drawing_ref) ORDER BY e.sort_order, e.created_at)
      FROM public.project_elevations e WHERE e.project_id=p_project_id AND e.is_active),'[]'::jsonb),
    'can_manage_elevations', public.can_manage_project_elevations(auth.uid(), p_project_id),
    'attendance', (SELECT jsonb_build_object('workers',count(DISTINCT worker_id),'hours',coalesce(sum(hours),0)) FROM public.labour_attendance WHERE project_id=p_project_id AND work_date=p_date AND hours>0)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.daily_measurements%ROWTYPE; p record; v_tasks int := 0; v_skipped jsonb := '[]'::jsonb; v_wip numeric; v_rated int; v_qty int;
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
  RETURN jsonb_build_object('tasks_updated',v_tasks,'tasks_skipped',v_skipped,'quantity_lines',v_qty,
    'photos',(SELECT count(*) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false));
END $function$;