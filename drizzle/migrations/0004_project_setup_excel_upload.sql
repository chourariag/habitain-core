ALTER TABLE public.project_boq_items ADD COLUMN IF NOT EXISTS schedule_task_id uuid REFERENCES public.project_tasks(id);
ALTER TABLE public.project_material_plan_items ADD COLUMN IF NOT EXISTS schedule_task_id uuid REFERENCES public.project_tasks(id);
CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_project_schedule_code_uidx ON public.project_tasks(project_id, task_id_in_schedule) WHERE task_id_in_schedule IS NOT NULL AND btrim(task_id_in_schedule) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS project_boq_items_header_sno_uidx ON public.project_boq_items(boq_id, sno);
CREATE UNIQUE INDEX IF NOT EXISTS project_material_plan_items_schedule_description_uidx ON public.project_material_plan_items(plan_id, schedule_task_id, lower(btrim(material_description))) WHERE schedule_task_id IS NOT NULL;
CREATE TABLE public.setup_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  table_name text NOT NULL,
  row_key text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.setup_change_log TO authenticated;
GRANT ALL ON public.setup_change_log TO service_role;
ALTER TABLE public.setup_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Setup upload roles can log changes" ON public.setup_change_log
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid() AND (
      public.has_role(auth.uid(), 'planning_head'::public.app_role)
      OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );
CREATE POLICY "Setup audit readers can view changes" ON public.setup_change_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'planning_head'::public.app_role)
    OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.commit_project_setup_upload(
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
  v_rec jsonb;
  v_row jsonb;
  v_code text;
  v_task_name text;
  v_role text;
  v_start_text text;
  v_end_text text;
  v_start date;
  v_end date;
  v_qty numeric;
  v_rate numeric;
  v_sno integer;
  v_description text;
  v_unit text;
  v_section text;
  v_category text;
  v_task_id uuid;
  v_task public.project_tasks%ROWTYPE;
  v_boq public.project_boq_items%ROWTYPE;
  v_material public.project_material_plan_items%ROWTYPE;
  v_boq_header uuid;
  v_plan_header uuid;
  v_field text;
  v_old text;
  v_new text;
  v_patch jsonb;
  v_user uuid := auth.uid();
  v_schedule_count integer := 0;
  v_boq_count integer := 0;
  v_material_count integer := 0;
BEGIN
  IF v_user IS NULL OR NOT (
    public.has_role(v_user, 'planning_head'::public.app_role)
    OR public.has_role(v_user, 'managing_director'::public.app_role)
    OR public.has_role(v_user, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only planning_head, managing_director, or super_admin may upload project setup data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF jsonb_typeof(coalesce(p_schedule_rows, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_boq_rows, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_material_rows, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Upload sheets must be arrays';
  END IF;
  IF jsonb_array_length(coalesce(p_schedule_rows, '[]'::jsonb))
     + jsonb_array_length(coalesce(p_boq_rows, '[]'::jsonb))
     + jsonb_array_length(coalesce(p_material_rows, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'The workbook contains no data rows';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_schedule_rows, '[]'::jsonb)) e
    GROUP BY lower(btrim(e->>'task_code')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate task_code in Schedule sheet'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_boq_rows, '[]'::jsonb)) e
    GROUP BY (e->>'sno') HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate sno in BOQ sheet'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_material_rows, '[]'::jsonb)) e
    GROUP BY lower(btrim(coalesce(e->>'task_code',''))), lower(btrim(coalesce(e->>'material_description','')))
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate task_code and material_description in Material Plan sheet'; END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(coalesce(p_schedule_rows, '[]'::jsonb)) LOOP
    v_code := nullif(btrim(v_rec->>'task_code'), '');
    v_task_name := nullif(btrim(v_rec->>'task_name'), '');
    IF v_code IS NULL OR v_task_name IS NULL THEN RAISE EXCEPTION 'Schedule rows require task_code and task_name'; END IF;
    v_start_text := nullif(btrim(v_rec->>'planned_start'), '');
    v_end_text := nullif(btrim(v_rec->>'planned_end'), '');
    IF v_start_text IS NOT NULL THEN
      IF v_start_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid planned_start for task_code %', v_code; END IF;
      v_start := v_start_text::date;
      IF to_char(v_start, 'YYYY-MM-DD') <> v_start_text THEN RAISE EXCEPTION 'Invalid planned_start for task_code %', v_code; END IF;
    ELSE v_start := NULL; END IF;
    IF v_end_text IS NOT NULL THEN
      IF v_end_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid planned_end for task_code %', v_code; END IF;
      v_end := v_end_text::date;
      IF to_char(v_end, 'YYYY-MM-DD') <> v_end_text THEN RAISE EXCEPTION 'Invalid planned_end for task_code %', v_code; END IF;
    ELSE v_end := NULL; END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'planned_end precedes planned_start for task_code %', v_code; END IF;
    v_role := nullif(btrim(v_rec->>'responsible_role'), '');
    SELECT * INTO v_task FROM public.project_tasks WHERE project_id = p_project_id AND btrim(task_id_in_schedule) = v_code LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      v_patch := jsonb_build_object('task_name',v_task_name,'planned_start_date',v_start,'planned_finish_date',v_end,'responsible_role',v_role);
      FOR v_field IN SELECT jsonb_object_keys(v_patch) LOOP
        v_old := to_jsonb(v_task)->>v_field; v_new := v_patch->>v_field;
        IF v_old IS DISTINCT FROM v_new THEN
          INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
          VALUES (p_project_id,'project_tasks',v_task.id::text,v_field,v_old,v_new,v_user);
        END IF;
      END LOOP;
      UPDATE public.project_tasks SET task_name=v_task_name,planned_start_date=v_start,planned_finish_date=v_end,responsible_role=v_role,updated_at=now() WHERE id=v_task.id;
      v_task_id := v_task.id;
    ELSE
      INSERT INTO public.project_tasks(project_id,task_id_in_schedule,task_name,planned_start_date,planned_finish_date,responsible_role)
      VALUES (p_project_id,v_code,v_task_name,v_start,v_end,v_role) RETURNING id INTO v_task_id;
    END IF;
    v_schedule_count := v_schedule_count + 1;
  END LOOP;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(coalesce(p_boq_rows, '[]'::jsonb)) LOOP
    v_code := nullif(btrim(v_rec->>'task_code'), '');
    IF v_code IS NULL THEN RAISE EXCEPTION 'BOQ rows require task_code'; END IF;
    SELECT id INTO v_task_id FROM public.project_tasks WHERE project_id=p_project_id AND btrim(task_id_in_schedule)=v_code LIMIT 1;
    IF v_task_id IS NULL THEN RAISE EXCEPTION 'BOQ task_code % was not found in this project', v_code; END IF;
    v_sno := (v_rec->>'sno')::integer;
    v_description := nullif(btrim(v_rec->>'item_description'),'');
    v_unit := nullif(btrim(v_rec->>'unit'),'');
    IF v_sno IS NULL OR v_sno < 1 OR v_description IS NULL OR v_unit IS NULL THEN RAISE EXCEPTION 'BOQ rows require positive sno, item_description, and unit'; END IF;
    v_qty := (v_rec->>'boq_qty')::numeric; v_rate := (v_rec->>'boq_rate')::numeric;
    v_category := coalesce(nullif(btrim(v_rec->>'category'),''),'');
    IF v_boq_header IS NULL THEN
      SELECT id INTO v_boq_header FROM public.project_boq WHERE project_id=p_project_id ORDER BY version_number DESC,uploaded_at DESC LIMIT 1;
      IF v_boq_header IS NULL THEN
        INSERT INTO public.project_boq(project_id,version_number,uploaded_by)
        SELECT p_project_id,coalesce(max(version_number),0)+1,v_user FROM public.project_boq WHERE project_id=p_project_id
        RETURNING id INTO v_boq_header;
      END IF;
    END IF;
    SELECT * INTO v_boq FROM public.project_boq_items WHERE boq_id=v_boq_header AND sno=v_sno FOR UPDATE;
    IF FOUND THEN
      v_patch := jsonb_build_object('category',v_category,'item_description',v_description,'unit',v_unit,'boq_qty',v_qty,'boq_rate',v_rate,'total_amount',v_qty*v_rate,'schedule_task_id',v_task_id);
      FOR v_field IN SELECT jsonb_object_keys(v_patch) LOOP
        v_old := to_jsonb(v_boq)->>v_field; v_new := v_patch->>v_field;
        IF v_old IS DISTINCT FROM v_new THEN
          INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
          VALUES (p_project_id,'project_boq_items',v_boq.id::text,v_field,v_old,v_new,v_user);
        END IF;
      END LOOP;
      UPDATE public.project_boq_items SET category=v_category,item_description=v_description,unit=v_unit,boq_qty=v_qty,boq_rate=v_rate,total_amount=v_qty*v_rate,schedule_task_id=v_task_id WHERE id=v_boq.id;
    ELSE
      INSERT INTO public.project_boq_items(boq_id,sno,category,item_description,unit,boq_qty,boq_rate,total_amount,schedule_task_id)
      VALUES (v_boq_header,v_sno,v_category,v_description,v_unit,v_qty,v_rate,v_qty*v_rate,v_task_id);
    END IF;
    v_boq_count := v_boq_count + 1;
  END LOOP;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(coalesce(p_material_rows, '[]'::jsonb)) LOOP
    v_code := nullif(btrim(v_rec->>'task_code'), '');
    v_task_id := NULL;
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_task_id FROM public.project_tasks WHERE project_id=p_project_id AND btrim(task_id_in_schedule)=v_code LIMIT 1;
      IF v_task_id IS NULL THEN RAISE EXCEPTION 'Material Plan task_code % was not found in this project', v_code; END IF;
    END IF;
    v_description := nullif(btrim(v_rec->>'material_description'),'');
    v_unit := nullif(btrim(v_rec->>'unit'),'');
    IF v_description IS NULL OR v_unit IS NULL THEN RAISE EXCEPTION 'Material Plan rows require material_description and unit'; END IF;
    v_qty := (v_rec->>'planned_qty')::numeric;
    v_section := coalesce(nullif(btrim(v_rec->>'section'),''),'Shell and Core');
    v_start_text := nullif(btrim(v_rec->>'planned_po_release_date'),'');
    v_end_text := nullif(btrim(v_rec->>'planned_delivery_date'),'');
    IF v_start_text IS NOT NULL THEN
      IF v_start_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid planned_po_release_date for material %', v_description; END IF;
      v_start := v_start_text::date;
      IF to_char(v_start,'YYYY-MM-DD')<>v_start_text THEN RAISE EXCEPTION 'Invalid planned_po_release_date for material %',v_description; END IF;
    ELSE v_start:=NULL; END IF;
    IF v_end_text IS NOT NULL THEN
      IF v_end_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid planned_delivery_date for material %', v_description; END IF;
      v_end := v_end_text::date;
      IF to_char(v_end,'YYYY-MM-DD')<>v_end_text THEN RAISE EXCEPTION 'Invalid planned_delivery_date for material %',v_description; END IF;
    ELSE v_end:=NULL; END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'planned_delivery_date precedes planned_po_release_date for material %',v_description; END IF;
    IF v_plan_header IS NULL THEN
      SELECT id INTO v_plan_header FROM public.project_material_plans WHERE project_id=p_project_id ORDER BY version DESC,uploaded_at DESC LIMIT 1;
      IF v_plan_header IS NULL THEN
        INSERT INTO public.project_material_plans(project_id,version,uploaded_by)
        SELECT p_project_id,coalesce(max(version),0)+1,v_user FROM public.project_material_plans WHERE project_id=p_project_id
        RETURNING id INTO v_plan_header;
      END IF;
    END IF;
    SELECT * INTO v_material FROM public.project_material_plan_items
      WHERE plan_id=v_plan_header AND schedule_task_id IS NOT DISTINCT FROM v_task_id
        AND lower(btrim(material_description))=lower(v_description) FOR UPDATE;
    IF FOUND THEN
      v_patch := jsonb_build_object('material_description',v_description,'unit',v_unit,'tender_qty',v_qty,'planned_po_release_date',v_start,'planned_delivery_date',v_end,'section',v_section,'schedule_task_id',v_task_id);
      FOR v_field IN SELECT jsonb_object_keys(v_patch) LOOP
        v_old := to_jsonb(v_material)->>v_field; v_new := v_patch->>v_field;
        IF v_old IS DISTINCT FROM v_new THEN
          INSERT INTO public.setup_change_log(project_id,table_name,row_key,field,old_value,new_value,changed_by)
          VALUES (p_project_id,'project_material_plan_items',v_material.id::text,v_field,v_old,v_new,v_user);
        END IF;
      END LOOP;
      UPDATE public.project_material_plan_items SET material_description=v_description,unit=v_unit,tender_qty=v_qty,planned_po_release_date=v_start,planned_delivery_date=v_end,section=v_section,schedule_task_id=v_task_id,updated_at=now() WHERE id=v_material.id;
    ELSE
      INSERT INTO public.project_material_plan_items(plan_id,item_id,section,material_description,unit,tender_qty,planned_po_release_date,planned_delivery_date,schedule_task_id)
      VALUES (v_plan_header,coalesce(nullif(v_rec->>'excel_row',''), '2'),v_section,v_description,v_unit,v_qty,v_start,v_end,v_task_id);
    END IF;
    v_material_count := v_material_count + 1;
  END LOOP;
  RETURN jsonb_build_object('schedule_count',v_schedule_count,'boq_count',v_boq_count,'material_count',v_material_count);
END;
$function$;
REVOKE ALL ON FUNCTION public.commit_project_setup_upload(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_project_setup_upload(uuid,jsonb,jsonb,jsonb) TO authenticated;