-- Helper: resolve the project for a file attachment entity
CREATE OR REPLACE FUNCTION public.attachment_entity_project(_entity_type text, _entity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v uuid;
BEGIN
  IF _entity_id IS NULL THEN RETURN NULL; END IF;
  CASE _entity_type
    WHEN 'project_design_stage' THEN
      SELECT project_id INTO v FROM public.project_design_stages WHERE id = _entity_id;
    WHEN 'project_reference', 'project' THEN
      v := _entity_id;
    ELSE
      v := NULL;
  END CASE;
  RETURN v;
END;
$$;

-- edit_history
DROP POLICY IF EXISTS "Authenticated users can view edit history" ON public.edit_history;
CREATE POLICY "Scoped view of edit history"
ON public.edit_history FOR SELECT TO authenticated
USING (
  edited_by = auth.uid()
  OR public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
  OR (project_id IS NOT NULL AND public.user_can_access_project(auth.uid(), project_id))
);

-- file_attachments
DROP POLICY IF EXISTS "Authenticated users can view file attachments" ON public.file_attachments;
CREATE POLICY "Scoped view of file attachments"
ON public.file_attachments FOR SELECT TO authenticated
USING (
  uploaded_by = (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  OR public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
  OR public.user_can_access_project(
       auth.uid(),
       public.attachment_entity_project(entity_type, entity_id)
     )
);

-- material_transfers
DROP POLICY IF EXISTS "Authenticated users can view transfers" ON public.material_transfers;
CREATE POLICY "Operational roles and project members can view transfers"
ON public.material_transfers FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY[
      'head_operations'::app_role,'production_head'::app_role,'site_installation_mgr'::app_role,
      'procurement'::app_role,'procurement_assistant'::app_role,'purchase_assistant'::app_role,
      'stores_executive'::app_role,'logistics_manager'::app_role,'site_engineer'::app_role,
      'factory_supervisor'::app_role,'factory_floor_supervisor'::app_role,
      'finance_manager'::app_role,'accounts_executive'::app_role])
  OR (to_project_id IS NOT NULL AND public.user_can_access_project(auth.uid(), to_project_id))
);