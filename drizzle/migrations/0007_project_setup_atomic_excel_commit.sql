CREATE OR REPLACE FUNCTION public.commit_project_setup_excel_upload(
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
  v_result jsonb;
  v_boq_id uuid;
  v_data_count integer;
BEGIN
  v_data_count := jsonb_array_length(coalesce(p_schedule_rows,'[]'::jsonb))
    + jsonb_array_length(coalesce(p_boq_rows,'[]'::jsonb))
    + jsonb_array_length(coalesce(p_material_rows,'[]'::jsonb));
  IF v_data_count=0 THEN RAISE EXCEPTION 'The workbook contains no data rows'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb)) e
    WHERE lower(btrim(coalesce(e->>'task_code','')))='__template_example__'
      OR lower(btrim(coalesce(e->>'task_name',''))) LIKE 'example row%'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_boq_rows,'[]'::jsonb)) e
    WHERE lower(btrim(coalesce(e->>'task_code','')))='__template_example__'
      OR lower(btrim(coalesce(e->>'item_description',''))) LIKE 'example row%'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_material_rows,'[]'::jsonb)) e
    WHERE lower(btrim(coalesce(e->>'task_code','')))='__template_example__'
      OR lower(btrim(coalesce(e->>'material_description',''))) LIKE 'example row%'
  ) THEN RAISE EXCEPTION 'Remove example rows from the workbook before committing'; END IF;

  v_result := public.commit_project_setup_upload_validated(p_project_id,p_schedule_rows,p_boq_rows,p_material_rows);
  SELECT id INTO v_boq_id FROM public.project_boq WHERE project_id=p_project_id ORDER BY version_number DESC,uploaded_at DESC LIMIT 1;
  IF v_boq_id IS NOT NULL THEN
    UPDATE public.project_boq h
      SET total_boq_value=(SELECT coalesce(sum(i.total_amount),0) FROM public.project_boq_items i WHERE i.boq_id=h.id),
          updated_at=now()
      WHERE h.id=v_boq_id;
  END IF;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.commit_project_setup_excel_upload(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_project_setup_excel_upload(uuid,jsonb,jsonb,jsonb) TO authenticated;