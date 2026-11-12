CREATE OR REPLACE FUNCTION public.commit_project_setup_upload_validated(
  p_project_id uuid,
  p_schedule_rows jsonb,
  p_boq_rows jsonb,
  p_material_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row jsonb;
  v_code text;
  v_sno integer;
  v_seen_codes text[] := ARRAY[]::text[];
  v_seen_sno integer[] := ARRAY[]::integer[];
  v_material_keys text[] := ARRAY[]::text[];
  v_start text;
  v_end text;
  v_num text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'planning_head'::public.app_role)
    OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only planning_head, managing_director, or super_admin may upload project setup data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key='project_setup' AND enabled=true) THEN
    RAISE EXCEPTION 'Project Setup is disabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id=p_project_id) THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF jsonb_typeof(coalesce(p_schedule_rows,'[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_boq_rows,'[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_material_rows,'[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'Upload sheets must be arrays';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb)) LOOP
    v_code := btrim(coalesce(v_row->>'task_code',''));
    IF v_code='' OR btrim(coalesce(v_row->>'task_name',''))='' THEN RAISE EXCEPTION 'Schedule rows require task_code and task_name'; END IF;
    IF lower(v_code)=ANY(v_seen_codes) THEN RAISE EXCEPTION 'Duplicate task_code in Schedule sheet: %',v_code; END IF;
    v_seen_codes := array_append(v_seen_codes,lower(v_code));
    v_start := nullif(btrim(v_row->>'planned_start'),''); v_end := nullif(btrim(v_row->>'planned_end'),'');
    IF v_start IS NOT NULL AND (v_start !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(to_date(v_start,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_start) THEN RAISE EXCEPTION 'Invalid planned_start for task_code %',v_code; END IF;
    IF v_end IS NOT NULL AND (v_end !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(to_date(v_end,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_end) THEN RAISE EXCEPTION 'Invalid planned_end for task_code %',v_code; END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end<v_start THEN RAISE EXCEPTION 'planned_end precedes planned_start for task_code %',v_code; END IF;
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_boq_rows,'[]'::jsonb)) LOOP
    v_code := btrim(coalesce(v_row->>'task_code',''));
    IF v_code='' THEN RAISE EXCEPTION 'BOQ row % requires task_code',coalesce(v_row->>'excel_row','?'); END IF;
    IF NOT (EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb)) s WHERE btrim(s.value->>'task_code')=v_code)
      OR EXISTS (SELECT 1 FROM public.project_tasks t WHERE t.project_id=p_project_id AND btrim(t.task_id_in_schedule)=v_code)) THEN
      RAISE EXCEPTION 'BOQ row % has unknown task_code %',coalesce(v_row->>'excel_row','?'),v_code;
    END IF;
    IF coalesce(v_row->>'sno','') !~ '^\d+$' OR (v_row->>'sno')::integer<1 THEN RAISE EXCEPTION 'BOQ row % requires positive whole-number sno',coalesce(v_row->>'excel_row','?'); END IF;
    v_sno := (v_row->>'sno')::integer;
    IF v_sno=ANY(v_seen_sno) THEN RAISE EXCEPTION 'Duplicate BOQ sno %',v_sno; END IF;
    v_seen_sno := array_append(v_seen_sno,v_sno);
    IF btrim(coalesce(v_row->>'item_description',''))='' OR btrim(coalesce(v_row->>'unit',''))='' THEN RAISE EXCEPTION 'BOQ row % requires item_description and unit',coalesce(v_row->>'excel_row','?'); END IF;
    FOREACH v_num IN ARRAY ARRAY[coalesce(v_row->>'boq_qty',''),coalesce(v_row->>'boq_rate','')] LOOP
      IF v_num !~ '^-?\d+(\.\d+)?$' THEN RAISE EXCEPTION 'BOQ row % requires numeric boq_qty and boq_rate',coalesce(v_row->>'excel_row','?'); END IF;
    END LOOP;
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_material_rows,'[]'::jsonb)) LOOP
    v_code := btrim(coalesce(v_row->>'task_code',''));
    IF v_code<>'' AND NOT (EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb)) s WHERE btrim(s.value->>'task_code')=v_code)
      OR EXISTS (SELECT 1 FROM public.project_tasks t WHERE t.project_id=p_project_id AND btrim(t.task_id_in_schedule)=v_code)) THEN
      RAISE EXCEPTION 'Material Plan row % has unknown task_code %',coalesce(v_row->>'excel_row','?'),v_code;
    END IF;
    IF btrim(coalesce(v_row->>'material_description',''))='' OR btrim(coalesce(v_row->>'unit',''))='' THEN RAISE EXCEPTION 'Material Plan row % requires material_description and unit',coalesce(v_row->>'excel_row','?'); END IF;
    IF coalesce(v_row->>'planned_qty','') !~ '^-?\d+(\.\d+)?$' THEN RAISE EXCEPTION 'Material Plan row % requires numeric planned_qty',coalesce(v_row->>'excel_row','?'); END IF;
    IF v_code<>'' THEN
      v_num := lower(v_code||'|'||btrim(v_row->>'material_description'));
      IF v_num=ANY(v_material_keys) THEN RAISE EXCEPTION 'Duplicate Material Plan task_code and material_description at row %',coalesce(v_row->>'excel_row','?'); END IF;
      v_material_keys:=array_append(v_material_keys,v_num);
    END IF;
    v_start:=nullif(btrim(v_row->>'planned_po_release_date'),''); v_end:=nullif(btrim(v_row->>'planned_delivery_date'),'');
    IF v_start IS NOT NULL AND (v_start !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(to_date(v_start,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_start) THEN RAISE EXCEPTION 'Invalid planned_po_release_date for Material Plan row %',coalesce(v_row->>'excel_row','?'); END IF;
    IF v_end IS NOT NULL AND (v_end !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(to_date(v_end,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_end) THEN RAISE EXCEPTION 'Invalid planned_delivery_date for Material Plan row %',coalesce(v_row->>'excel_row','?'); END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end<v_start THEN RAISE EXCEPTION 'planned_delivery_date precedes planned_po_release_date for Material Plan row %',coalesce(v_row->>'excel_row','?'); END IF;
  END LOOP;

  RETURN public.commit_project_setup_upload(p_project_id,p_schedule_rows,p_boq_rows,p_material_rows);
END;
$function$;
REVOKE ALL ON FUNCTION public.commit_project_setup_upload_validated(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_project_setup_upload_validated(uuid,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.commit_project_setup_upload(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;