-- B1: subcontract rates, "done by" on daily report quantities, subcontractor headcount
CREATE TABLE public.subcontract_rates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  contractor_id uuid NOT NULL REFERENCES public.labour_contractors(id),
  rate_type text NOT NULL CHECK (rate_type IN ('per_unit','lump_sum')),
  boq_item_id uuid REFERENCES public.project_boq_items(id),
  work_description text,
  unit text NOT NULL,
  rate_inr numeric,
  lump_sum_inr numeric,
  package_qty numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subcontract_rates_per_unit_chk CHECK (rate_type <> 'per_unit' OR coalesce(rate_inr,0) > 0),
  CONSTRAINT subcontract_rates_lump_sum_chk CHECK (rate_type <> 'lump_sum' OR (coalesce(lump_sum_inr,0) > 0 AND coalesce(package_qty,0) > 0)),
  CONSTRAINT subcontract_rates_target_chk CHECK (boq_item_id IS NOT NULL OR nullif(btrim(work_description),'') IS NOT NULL),
  CONSTRAINT subcontract_rates_unit_chk CHECK (btrim(unit) <> '')
);
CREATE UNIQUE INDEX subcontract_rates_boq_uq ON public.subcontract_rates(project_id,contractor_id,boq_item_id) WHERE boq_item_id IS NOT NULL;
CREATE UNIQUE INDEX subcontract_rates_desc_uq ON public.subcontract_rates(project_id,contractor_id,lower(btrim(work_description))) WHERE boq_item_id IS NULL;
CREATE INDEX subcontract_rates_project_idx ON public.subcontract_rates(project_id);
GRANT SELECT ON public.subcontract_rates TO authenticated;
GRANT ALL ON public.subcontract_rates TO service_role;
ALTER TABLE public.subcontract_rates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_subcontract_rates(_uid uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_write_site_report(_uid,_project_id)
    OR public.is_tier1_or_super(_uid)
    OR public.user_has_any_role(_uid, ARRAY['finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer']::public.app_role[]));
$$;
CREATE POLICY subcontract_rates_read ON public.subcontract_rates FOR SELECT TO authenticated
  USING (public.can_read_subcontract_rates(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.subcontract_effective_rate(_type text, _rate numeric, _lump numeric, _pkg numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN _type='per_unit' THEN _rate WHEN coalesce(_pkg,0) > 0 THEN _lump/_pkg ELSE NULL END;
$$;

ALTER TABLE public.site_report_quantities
  ADD COLUMN contractor_id uuid REFERENCES public.labour_contractors(id),
  ADD COLUMN rate_id uuid REFERENCES public.subcontract_rates(id),
  ADD COLUMN extra_work_description text,
  ADD COLUMN unit text,
  ADD COLUMN rate_used numeric,
  ADD COLUMN amount_inr numeric;
COMMENT ON COLUMN public.site_report_quantities.contractor_id IS 'NULL = own labour';
ALTER TABLE public.site_report_quantities ALTER COLUMN boq_item_id DROP NOT NULL;
ALTER TABLE public.site_report_quantities ADD CONSTRAINT srq_boq_or_other_chk
  CHECK (boq_item_id IS NOT NULL OR nullif(btrim(extra_work_description),'') IS NOT NULL);
ALTER TABLE public.site_report_quantities DROP CONSTRAINT site_report_quantities_report_id_boq_item_id_key;
CREATE UNIQUE INDEX srq_boq_contractor_uq ON public.site_report_quantities(report_id,boq_item_id,contractor_id) NULLS NOT DISTINCT WHERE boq_item_id IS NOT NULL;
CREATE UNIQUE INDEX srq_other_work_uq ON public.site_report_quantities(report_id,contractor_id,lower(btrim(extra_work_description))) NULLS NOT DISTINCT WHERE boq_item_id IS NULL;
CREATE INDEX srq_rate_idx ON public.site_report_quantities(rate_id);

CREATE TABLE public.site_report_subcontractor_headcount(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  contractor_id uuid NOT NULL REFERENCES public.labour_contractors(id),
  headcount integer NOT NULL CHECK (headcount BETWEEN 0 AND 500),
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, contractor_id)
);
GRANT SELECT ON public.site_report_subcontractor_headcount TO authenticated;
GRANT ALL ON public.site_report_subcontractor_headcount TO service_role;
ALTER TABLE public.site_report_subcontractor_headcount ENABLE ROW LEVEL SECURITY;
CREATE POLICY srsh_read ON public.site_report_subcontractor_headcount FOR SELECT TO authenticated
  USING (public.user_can_access_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.validate_subcontract_rates(p_project_id uuid, p_rows jsonb, p_file_boq_snos jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_row jsonb; v_n text; v_name text; v_cid uuid; v_code text; v_bid uuid; v_desc text; v_unit text; v_type text;
  v_rate numeric; v_lump numeric; v_pkg numeric; v_boq uuid; v_key text; v_ok boolean;
  v_errors jsonb := '[]'::jsonb; v_warnings jsonb := '[]'::jsonb; v_prepared jsonb := '[]'::jsonb; v_seen text[] := ARRAY[]::text[];
  v_num text; v_bad_num boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'planning_head'::public.app_role) OR public.is_tier1_or_super(auth.uid())) THEN
    RAISE EXCEPTION 'Only planning_head, directors, or super_admin may upload project setup data';
  END IF;
  SELECT id INTO v_boq FROM public.project_boq WHERE project_id=p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;
  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) LOOP
    v_ok := true;
    v_n := coalesce(v_row->>'excel_row','?');
    v_name := btrim(coalesce(v_row->>'contractor_name',''));
    v_code := btrim(coalesce(v_row->>'boq_code',''));
    v_desc := nullif(btrim(coalesce(v_row->>'work_description','')),'');
    v_unit := nullif(btrim(coalesce(v_row->>'unit','')),'');
    v_type := replace(lower(btrim(coalesce(v_row->>'rate_type',''))),' ','_');
    v_cid := NULL; v_bid := NULL;
    IF lower(v_name) LIKE 'example row%' OR lower(coalesce(v_desc,'')) LIKE 'example row%' THEN
      v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': remove the example row before upload.'); CONTINUE;
    END IF;
    IF v_name='' THEN v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Contractor Name is required.'); v_ok := false;
    ELSE
      SELECT id INTO v_cid FROM public.labour_contractors WHERE lower(btrim(company_name))=lower(v_name) ORDER BY (status='active') DESC, created_at LIMIT 1;
      IF v_cid IS NULL THEN v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': unknown contractor “'||v_name||'”.'); v_ok := false; END IF;
    END IF;
    IF v_code <> '' THEN
      IF v_code !~ '^\d+(\.0+)?$' THEN
        v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': unknown BOQ code “'||v_code||'”.'); v_ok := false;
      ELSE
        v_code := split_part(v_code,'.',1);
        SELECT id INTO v_bid FROM public.project_boq_items WHERE boq_id=v_boq AND sno=v_code::integer;
        IF v_bid IS NULL AND NOT (coalesce(p_file_boq_snos,'[]'::jsonb) @> to_jsonb(v_code::integer)) THEN
          v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': unknown BOQ code “'||v_code||'”.'); v_ok := false;
        END IF;
      END IF;
    ELSIF v_desc IS NULL THEN
      v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Work Description is required when BOQ Code is empty.'); v_ok := false;
    END IF;
    IF v_unit IS NULL THEN v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Unit is required.'); v_ok := false; END IF;
    IF v_type NOT IN ('per_unit','lump_sum') THEN
      v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Rate Type must be Per Unit or Lump Sum.'); v_ok := false;
    END IF;
    v_bad_num := false;
    FOREACH v_num IN ARRAY ARRAY[coalesce(v_row->>'rate',''),coalesce(v_row->>'lump_sum',''),coalesce(v_row->>'package_qty','')] LOOP
      v_num := replace(btrim(v_num),',','');
      IF v_num <> '' AND v_num !~ '^-?\d+(\.\d+)?$' THEN v_bad_num := true; END IF;
    END LOOP;
    IF v_bad_num THEN
      v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Rate, Lump Sum and Package Qty must be numbers.'); v_ok := false;
    ELSE
      v_rate := nullif(replace(btrim(coalesce(v_row->>'rate','')),',',''),'')::numeric;
      v_lump := nullif(replace(btrim(coalesce(v_row->>'lump_sum','')),',',''),'')::numeric;
      v_pkg := nullif(replace(btrim(coalesce(v_row->>'package_qty','')),',',''),'')::numeric;
      IF v_type='per_unit' AND coalesce(v_rate,0) <= 0 THEN
        v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Per Unit needs a Rate (₹ per unit) greater than 0.'); v_ok := false;
      ELSIF v_type='lump_sum' AND (coalesce(v_lump,0) <= 0 OR coalesce(v_pkg,0) <= 0) THEN
        v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': Lump Sum needs Lump Sum (₹) and Package Qty greater than 0.'); v_ok := false;
      END IF;
    END IF;
    IF v_cid IS NOT NULL THEN
      v_key := v_cid::text || '|' || CASE WHEN v_code<>'' THEN 'boq:'||v_code ELSE 'desc:'||lower(coalesce(v_desc,'')) END;
      IF v_key = ANY(v_seen) THEN
        v_errors := v_errors || to_jsonb('Subcontract Rates row '||v_n||': duplicate contractor and item.'); v_ok := false;
      END IF;
      v_seen := array_append(v_seen, v_key);
      IF EXISTS (SELECT 1 FROM public.labour_attendance a JOIN public.labour_workers w ON w.id=a.worker_id
                 WHERE w.contractor_id=v_cid AND a.project_id=p_project_id) THEN
        v_warnings := v_warnings || to_jsonb('Subcontract Rates row '||v_n||' ('||v_name||'): This contractor''s workers are in labour attendance. Their hourly cost is already counted; piece-rate cost would count it twice.');
      END IF;
    END IF;
    IF v_ok THEN
      v_prepared := v_prepared || jsonb_build_object('excel_row',v_n,'contractor_id',v_cid,'boq_sno',CASE WHEN v_code<>'' THEN v_code::integer END,
        'boq_item_id',v_bid,'work_description',v_desc,'unit',v_unit,'rate_type',v_type,
        'rate_inr',CASE WHEN v_type='per_unit' THEN v_rate END,
        'lump_sum_inr',CASE WHEN v_type='lump_sum' THEN v_lump END,
        'package_qty',CASE WHEN v_type='lump_sum' THEN v_pkg END);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('errors',v_errors,'warnings',v_warnings,'prepared',v_prepared,'row_count',jsonb_array_length(coalesce(p_rows,'[]'::jsonb)));
END $$;

CREATE OR REPLACE FUNCTION public.commit_project_setup_excel_upload_v2(p_project_id uuid, p_schedule_rows jsonb, p_boq_rows jsonb, p_material_rows jsonb, p_rate_rows jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_result jsonb; v_val jsonb; v_p jsonb; v_boq uuid; v_bid uuid; v_old public.subcontract_rates%ROWTYPE; v_id uuid;
  v_keep uuid[] := ARRAY[]::uuid[]; v_count int := 0; v_off int := 0; v_field text; v_patch jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'planning_head'::public.app_role) OR public.is_tier1_or_super(auth.uid())) THEN
    RAISE EXCEPTION 'Only planning_head, directors, or super_admin may upload project setup data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key='project_setup' AND enabled=true) THEN RAISE EXCEPTION 'Project Setup is disabled'; END IF;
  IF jsonb_array_length(coalesce(p_schedule_rows,'[]'::jsonb)) + jsonb_array_length(coalesce(p_boq_rows,'[]'::jsonb)) + jsonb_array_length(coalesce(p_material_rows,'[]'::jsonb)) > 0 THEN
    v_result := public.commit_project_setup_excel_upload(p_project_id,p_schedule_rows,p_boq_rows,p_material_rows);
  ELSE
    IF p_rate_rows IS NULL THEN RAISE EXCEPTION 'The workbook contains no data rows'; END IF;
    v_result := jsonb_build_object('schedule_count',0,'boq_count',0,'material_count',0);
  END IF;
  IF p_rate_rows IS NOT NULL THEN
    v_val := public.validate_subcontract_rates(p_project_id,p_rate_rows,'[]'::jsonb);
    IF jsonb_array_length(v_val->'errors') > 0 THEN
      RAISE EXCEPTION '%', (SELECT string_agg(x,' ') FROM jsonb_array_elements_text(v_val->'errors') x);
    END IF;
    SELECT id INTO v_boq FROM public.project_boq WHERE project_id=p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;
    FOR v_p IN SELECT value FROM jsonb_array_elements(v_val->'prepared') LOOP
      v_bid := CASE WHEN v_p->>'boq_sno' IS NULL THEN NULL ELSE (SELECT id FROM public.project_boq_items WHERE boq_id=v_boq AND sno=(v_p->>'boq_sno')::integer) END;
      IF v_p->>'boq_sno' IS NOT NULL AND v_bid IS NULL THEN RAISE EXCEPTION 'Subcontract Rates row %: unknown BOQ code %', v_p->>'excel_row', v_p->>'boq_sno'; END IF;
      v_old := NULL;
      IF v_bid IS NOT NULL THEN
        SELECT * INTO v_old FROM public.subcontract_rates WHERE project_id=p_project_id AND contractor_id=(v_p->>'contractor_id')::uuid AND boq_item_id=v_bid FOR UPDATE;
      ELSE
        SELECT * INTO v_old FROM public.subcontract_rates WHERE project_id=p_project_id AND contractor_id=(v_p->>'contractor_id')::uuid AND boq_item_id IS NULL
          AND lower(btrim(work_description))=lower(btrim(v_p->>'work_description')) FOR UPDATE;
      END IF;
      v_patch := jsonb_build_object('rate_type',v_p->>'rate_type','work_description',v_p->>'work_description','unit',v_p->>'unit',
        'rate_inr',v_p->>'rate_inr','lump_sum_inr',v_p->>'lump_sum_inr','package_qty',v_p->>'package_qty','is_active','true');
      IF v_old.id IS NULL THEN
        INSERT INTO public.subcontract_rates(project_id,contractor_id,rate_type,boq_item_id,work_description,unit,rate_inr,lump_sum_inr,package_qty,is_active,created_by,updated_by)
        VALUES (p_project_id,(v_p->>'contractor_id')::uuid,v_p->>'rate_type',v_bid,v_p->>'work_description',v_p->>'unit',
          (v_p->>'rate_inr')::numeric,(v_p->>'lump_sum_inr')::numeric,(v_p->>'package_qty')::numeric,true,auth.uid(),auth.uid())
        RETURNING id INTO v_id;
        INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
        VALUES (p_project_id,'subcontract_rates',v_id::text,'created',NULL,v_patch::text,auth.uid());
      ELSE
        v_id := v_old.id;
        FOR v_field IN SELECT jsonb_object_keys(v_patch) LOOP
          IF (to_jsonb(v_old)->>v_field) IS DISTINCT FROM (v_patch->>v_field) THEN
            INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
            VALUES (p_project_id,'subcontract_rates',v_id::text,v_field,to_jsonb(v_old)->>v_field,v_patch->>v_field,auth.uid());
          END IF;
        END LOOP;
        UPDATE public.subcontract_rates SET rate_type=v_p->>'rate_type', work_description=v_p->>'work_description', unit=v_p->>'unit',
          rate_inr=(v_p->>'rate_inr')::numeric, lump_sum_inr=(v_p->>'lump_sum_inr')::numeric, package_qty=(v_p->>'package_qty')::numeric,
          is_active=true, updated_by=auth.uid(), updated_at=now() WHERE id=v_id;
      END IF;
      v_keep := array_append(v_keep, v_id); v_count := v_count + 1;
    END LOOP;
    FOR v_id IN SELECT id FROM public.subcontract_rates WHERE project_id=p_project_id AND is_active AND NOT (id = ANY(v_keep)) LOOP
      UPDATE public.subcontract_rates SET is_active=false, updated_by=auth.uid(), updated_at=now() WHERE id=v_id;
      INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
      VALUES (p_project_id,'subcontract_rates',v_id::text,'is_active','true','false',auth.uid());
      v_off := v_off + 1;
    END LOOP;
  END IF;
  RETURN v_result || jsonb_build_object('rate_count',v_count,'rates_deactivated',v_off,'rates_included',p_rate_rows IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.get_subcontract_rates(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_read_subcontract_rates(auth.uid(), p_project_id) THEN RETURN NULL; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'contractor_id',s.contractor_id,'contractor_name',c.company_name,
      'boq_item_id',s.boq_item_id,'boq_sno',b.sno,'boq_description',b.item_description,'work_description',s.work_description,'unit',s.unit,
      'rate_type',s.rate_type,'rate_inr',s.rate_inr,'lump_sum_inr',s.lump_sum_inr,'package_qty',s.package_qty,
      'effective_rate',public.subcontract_effective_rate(s.rate_type,s.rate_inr,s.lump_sum_inr,s.package_qty),'is_active',s.is_active,'updated_at',s.updated_at)
    ORDER BY s.is_active DESC, c.company_name, b.sno NULLS LAST, s.work_description)
    FROM public.subcontract_rates s JOIN public.labour_contractors c ON c.id=s.contractor_id
    LEFT JOIN public.project_boq_items b ON b.id=s.boq_item_id WHERE s.project_id=p_project_id),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.save_site_report_draft(p_project_id uuid, p_date date, p_payload jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.daily_measurements%ROWTYPE; e jsonb; v_log boolean; v_old text; v_new text; v_tid uuid; v_bid uuid;
  v_cid uuid; v_desc text; v_q numeric; v_unit text; v_bunit text; v_rate public.subcontract_rates%ROWTYPE;
  v_row public.site_report_quantities%ROWTYPE; v_used numeric; v_keep uuid[] := ARRAY[]::uuid[]; v_id uuid; v_key text;
  v_hc integer; v_ru numeric;
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

  IF p_payload ? 'quantities' THEN
    FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'quantities','[]'::jsonb)) LOOP
      v_bid := nullif(e->>'boq_item_id','')::uuid;
      v_cid := nullif(e->>'contractor_id','')::uuid;
      v_desc := nullif(btrim(coalesce(e->>'extra_work_description','')),'');
      v_q := greatest(coalesce(nullif(e->>'today_qty','')::numeric,0),0);
      v_unit := nullif(btrim(coalesce(e->>'unit','')),'');
      v_rate := NULL;
      IF v_bid IS NOT NULL THEN
        SELECT b.unit INTO v_bunit FROM public.project_boq_items b JOIN public.project_boq h ON h.id=b.boq_id WHERE b.id=v_bid AND h.project_id=p_project_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'BOQ line not in this project'; END IF;
        v_desc := NULL; v_unit := v_bunit;
        IF v_cid IS NOT NULL THEN
          SELECT * INTO v_rate FROM public.subcontract_rates WHERE project_id=p_project_id AND contractor_id=v_cid AND boq_item_id=v_bid AND is_active;
        END IF;
      ELSE
        IF v_desc IS NULL THEN RAISE EXCEPTION 'Other work needs a description'; END IF;
        IF v_cid IS NOT NULL THEN
          SELECT * INTO v_rate FROM public.subcontract_rates WHERE project_id=p_project_id AND contractor_id=v_cid AND boq_item_id IS NULL
            AND lower(btrim(work_description))=lower(v_desc) AND is_active;
          v_unit := coalesce(v_rate.unit, v_unit);
        ELSIF v_unit IS NULL AND v_q > 0 THEN RAISE EXCEPTION 'Enter a unit for other work';
        END IF;
      END IF;
      IF v_cid IS NOT NULL AND v_q > 0 THEN
        IF v_rate.id IS NULL THEN RAISE EXCEPTION 'No rate for this contractor on this item. Ask Planning to add it in Setup.'; END IF;
        IF v_rate.rate_type='lump_sum' THEN
          SELECT coalesce(sum(q.today_qty),0) INTO v_used FROM public.site_report_quantities q JOIN public.daily_measurements d ON d.id=q.report_id
            WHERE q.rate_id=v_rate.id AND q.report_id<>r.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted';
          IF v_used + v_q > v_rate.package_qty THEN
            RAISE EXCEPTION 'This takes the lump-sum package past its total: % of % % already recorded.', v_used, v_rate.package_qty, v_rate.unit;
          END IF;
        END IF;
      END IF;
      v_row := NULL;
      IF v_bid IS NOT NULL THEN
        SELECT * INTO v_row FROM public.site_report_quantities WHERE report_id=r.id AND boq_item_id=v_bid AND contractor_id IS NOT DISTINCT FROM v_cid FOR UPDATE;
      ELSE
        SELECT * INTO v_row FROM public.site_report_quantities WHERE report_id=r.id AND boq_item_id IS NULL AND contractor_id IS NOT DISTINCT FROM v_cid
          AND lower(btrim(extra_work_description))=lower(v_desc) FOR UPDATE;
      END IF;
      v_key := CASE WHEN v_bid IS NOT NULL THEN 'qty:'||v_bid ELSE 'other:'||v_desc END || CASE WHEN v_cid IS NULL THEN '' ELSE ':'||v_cid END;
      IF v_log AND v_row.today_qty IS DISTINCT FROM v_q THEN PERFORM public._site_report_log(r.id,p_project_id,v_key,v_row.today_qty::text,v_q::text); END IF;
      v_ru := CASE WHEN v_row.rate_used IS NOT NULL AND v_rate.id IS NOT NULL AND v_row.rate_id IS NOT DISTINCT FROM v_rate.id THEN v_row.rate_used END;
      IF v_row.id IS NULL THEN
        INSERT INTO public.site_report_quantities(report_id,project_id,boq_item_id,contractor_id,rate_id,extra_work_description,unit,today_qty,rate_used,amount_inr,remarks,created_by,updated_by)
        VALUES (r.id,p_project_id,v_bid,v_cid,v_rate.id,v_desc,v_unit,v_q,NULL,NULL,nullif(e->>'remarks',''),auth.uid(),auth.uid())
        RETURNING id INTO v_id;
      ELSE
        UPDATE public.site_report_quantities SET today_qty=v_q, rate_id=v_rate.id, unit=v_unit, rate_used=v_ru,
          amount_inr=CASE WHEN v_ru IS NULL THEN NULL ELSE round(v_q*v_ru,2) END,
          remarks=nullif(e->>'remarks',''), updated_by=auth.uid(), updated_at=now() WHERE id=v_row.id;
        v_id := v_row.id;
      END IF;
      v_keep := array_append(v_keep, v_id);
    END LOOP;
    FOR v_row IN SELECT * FROM public.site_report_quantities WHERE report_id=r.id AND NOT (id = ANY(v_keep)) AND today_qty<>0 LOOP
      v_key := CASE WHEN v_row.boq_item_id IS NOT NULL THEN 'qty:'||v_row.boq_item_id ELSE 'other:'||v_row.extra_work_description END
               || CASE WHEN v_row.contractor_id IS NULL THEN '' ELSE ':'||v_row.contractor_id END;
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,v_key,v_row.today_qty::text,'0'); END IF;
      UPDATE public.site_report_quantities SET today_qty=0, amount_inr=CASE WHEN rate_used IS NULL THEN NULL ELSE 0 END, updated_by=auth.uid(), updated_at=now() WHERE id=v_row.id;
    END LOOP;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'headcount','[]'::jsonb)) LOOP
    v_cid := (e->>'contractor_id')::uuid;
    IF nullif(btrim(coalesce(e->>'headcount','')),'') IS NULL THEN CONTINUE; END IF;
    v_hc := round((e->>'headcount')::numeric)::integer;
    IF v_hc < 0 OR v_hc > 500 THEN RAISE EXCEPTION 'Headcount must be between 0 and 500'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subcontract_rates WHERE project_id=p_project_id AND contractor_id=v_cid AND is_active) THEN
      RAISE EXCEPTION 'This contractor has no active rate on this project'; END IF;
    SELECT headcount::text INTO v_old FROM public.site_report_subcontractor_headcount WHERE report_id=r.id AND contractor_id=v_cid;
    IF v_log AND v_old IS DISTINCT FROM v_hc::text THEN PERFORM public._site_report_log(r.id,p_project_id,'headcount:'||v_cid,v_old,v_hc::text); END IF;
    INSERT INTO public.site_report_subcontractor_headcount(report_id,project_id,contractor_id,headcount,created_by,updated_by)
    VALUES (r.id,p_project_id,v_cid,v_hc,auth.uid(),auth.uid())
    ON CONFLICT (report_id,contractor_id) DO UPDATE SET headcount=excluded.headcount, updated_by=auth.uid(), updated_at=now();
  END LOOP;
  RETURN r.id;
END $function$;

CREATE OR REPLACE FUNCTION public.get_site_report(p_project_id uuid, p_date date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.daily_measurements%ROWTYPE; v_boq uuid; v_rates boolean;
BEGIN
  IF NOT public.user_can_access_project(auth.uid(), p_project_id) THEN RAISE EXCEPTION 'No access to this project'; END IF;
  v_rates := public.can_read_subcontract_rates(auth.uid(), p_project_id);
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
        'cumulative',(SELECT coalesce(sum(li.today_qty),0) FROM public.site_report_quantities li JOIN public.daily_measurements d ON d.id=li.report_id
           WHERE li.boq_item_id=b.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted' AND d.measurement_date<=p_date)) ORDER BY b.sno)
      FROM public.project_boq_items b WHERE b.boq_id=v_boq AND b.schedule_task_id IS NOT NULL),'[]'::jsonb),
    'progress', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'pct',completion_percentage_after,'remarks',remarks)) FROM public.site_report_task_progress WHERE report_id=r.id),'[]'::jsonb),
    'labour', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'hours',hours)) FROM public.site_report_labour WHERE report_id=r.id),'[]'::jsonb),
    'quantities', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'boq_item_id',boq_item_id,'contractor_id',contractor_id,'rate_id',rate_id,
        'extra_work_description',extra_work_description,'unit',unit,'today_qty',today_qty,'remarks',remarks,
        'rate_used',CASE WHEN v_rates THEN rate_used END,'amount_inr',CASE WHEN v_rates THEN amount_inr END) ORDER BY created_at)
      FROM public.site_report_quantities WHERE report_id=r.id),'[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'elevation_id',elevation_id,'storage_path',storage_path,'flags',flags,'gps_source',gps_source,'exif_taken_at',exif_taken_at,'uploaded_at',uploaded_at) ORDER BY uploaded_at)
      FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false),'[]'::jsonb),
    'elevations', coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'drawing_ref',e.drawing_ref) ORDER BY e.sort_order, e.created_at)
      FROM public.project_elevations e WHERE e.project_id=p_project_id AND e.is_active),'[]'::jsonb),
    'can_manage_elevations', public.can_manage_project_elevations(auth.uid(), p_project_id),
    'attendance', (SELECT jsonb_build_object('workers',count(DISTINCT worker_id),'hours',coalesce(sum(hours),0)) FROM public.labour_attendance WHERE project_id=p_project_id AND work_date=p_date AND hours>0)
  ) || jsonb_build_object(
    'rates', CASE WHEN v_rates THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'contractor_id',s.contractor_id,'boq_item_id',s.boq_item_id,
        'work_description',s.work_description,'unit',s.unit,'rate_type',s.rate_type,'package_qty',s.package_qty,'lump_sum_inr',s.lump_sum_inr,
        'effective_rate',public.subcontract_effective_rate(s.rate_type,s.rate_inr,s.lump_sum_inr,s.package_qty),
        'used_qty',(SELECT coalesce(sum(q.today_qty),0) FROM public.site_report_quantities q JOIN public.daily_measurements d ON d.id=q.report_id
           WHERE q.rate_id=s.id AND d.id IS DISTINCT FROM r.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted')))
      FROM public.subcontract_rates s WHERE s.project_id=p_project_id AND s.is_active),'[]'::jsonb) ELSE '[]'::jsonb END,
    'contractors', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.company_name) ORDER BY c.company_name)
      FROM public.labour_contractors c WHERE EXISTS (SELECT 1 FROM public.subcontract_rates s WHERE s.contractor_id=c.id AND s.project_id=p_project_id AND s.is_active)),'[]'::jsonb),
    'headcount', coalesce((SELECT jsonb_agg(jsonb_build_object('contractor_id',contractor_id,'headcount',headcount)) FROM public.site_report_subcontractor_headcount WHERE report_id=r.id),'[]'::jsonb),
    'can_see_rates', v_rates
  );
END $function$;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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