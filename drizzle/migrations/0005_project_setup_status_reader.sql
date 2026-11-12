CREATE OR REPLACE FUNCTION public.get_project_setup_status(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_boq_id uuid;
  v_plan_id uuid;
  v_can_view_rates boolean;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Active employee access is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'project_setup' AND enabled = true) THEN
    RAISE EXCEPTION 'Project Setup is disabled';
  END IF;
  SELECT id INTO v_boq_id FROM public.project_boq WHERE project_id = p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;
  SELECT id INTO v_plan_id FROM public.project_material_plans WHERE project_id = p_project_id ORDER BY version DESC, uploaded_at DESC LIMIT 1;
  v_can_view_rates :=
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
    OR public.has_role(auth.uid(), 'chairman'::public.app_role)
    OR public.has_role(auth.uid(), 'finance_director'::public.app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'accounts_executive'::public.app_role)
    OR public.has_role(auth.uid(), 'planning_head'::public.app_role)
    OR public.has_role(auth.uid(), 'planning_engineer'::public.app_role)
    OR public.has_role(auth.uid(), 'costing_engineer'::public.app_role)
    OR public.has_role(auth.uid(), 'quantity_surveyor'::public.app_role)
    OR public.has_role(auth.uid(), 'architecture_director'::public.app_role)
    OR public.has_role(auth.uid(), 'principal_architect'::public.app_role)
    OR public.has_role(auth.uid(), 'project_architect'::public.app_role)
    OR public.has_role(auth.uid(), 'head_operations'::public.app_role)
    OR public.has_role(auth.uid(), 'head_of_projects'::public.app_role);
  SELECT jsonb_build_object(
    'tasks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'task_id_in_schedule', t.task_id_in_schedule, 'task_name', t.task_name,
        'planned_start_date', t.planned_start_date, 'planned_finish_date', t.planned_finish_date,
        'responsible_role', t.responsible_role, 'status', t.status,
        'completion_percentage', t.completion_percentage, 'display_order', t.display_order
      ) ORDER BY t.display_order NULLS LAST, t.created_at)
      FROM public.project_tasks t WHERE t.project_id = p_project_id
    ), '[]'::jsonb),
    'boq', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'sno', i.sno, 'category', i.category, 'item_description', i.item_description,
        'unit', i.unit, 'boq_qty', i.boq_qty,
        'boq_rate', CASE WHEN v_can_view_rates THEN i.boq_rate ELSE NULL END,
        'schedule_task_id', i.schedule_task_id, 'task_name', t.task_name,
        'task_code', t.task_id_in_schedule, 'version', h.version_number
      ) ORDER BY i.sno)
      FROM public.project_boq_items i
      JOIN public.project_boq h ON h.id = i.boq_id
      LEFT JOIN public.project_tasks t ON t.id = i.schedule_task_id
      WHERE i.boq_id = v_boq_id
    ), '[]'::jsonb),
    'materials', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'item_id', i.item_id, 'section', i.section,
        'material_description', i.material_description, 'unit', i.unit,
        'tender_qty', i.tender_qty, 'planned_po_release_date', i.planned_po_release_date,
        'planned_delivery_date', i.planned_delivery_date, 'schedule_task_id', i.schedule_task_id,
        'task_name', t.task_name, 'task_code', t.task_id_in_schedule, 'version', h.version
      ) ORDER BY i.item_id)
      FROM public.project_material_plan_items i
      JOIN public.project_material_plans h ON h.id = i.plan_id
      LEFT JOIN public.project_tasks t ON t.id = i.schedule_task_id
      WHERE i.plan_id = v_plan_id
    ), '[]'::jsonb),
    'unmapped', coalesce((
      SELECT jsonb_agg(to_jsonb(u) ORDER BY u.section, u.version, u.row_key)
      FROM (
        SELECT 'BOQ'::text AS section,h.version_number AS version,i.sno::text AS row_key,i.item_description AS description,coalesce(i.unit,'') AS unit
        FROM public.project_boq_items i JOIN public.project_boq h ON h.id=i.boq_id
        WHERE h.project_id=p_project_id AND i.schedule_task_id IS NULL
        UNION ALL
        SELECT 'Material Plan'::text AS section,h.version AS version,i.item_id AS row_key,i.material_description AS description,coalesce(i.unit,'') AS unit
        FROM public.project_material_plan_items i JOIN public.project_material_plans h ON h.id=i.plan_id
        WHERE h.project_id=p_project_id AND i.schedule_task_id IS NULL
      ) u
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_project_setup_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_setup_status(uuid) TO authenticated;