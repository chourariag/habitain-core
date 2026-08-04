
CREATE OR REPLACE FUNCTION public.can_read_measurements(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','chairman','director',
        'finance_director','finance_manager','accounts_executive',
        'head_operations','head_of_projects','production_head',
        'planning_head','planning_engineer','costing_engineer','quantity_surveyor',
        'site_installation_mgr','senior_factory_supervisor','factory_supervisor'
      )
  )
$function$;

DROP POLICY IF EXISTS dm_read_all ON public.daily_measurements;
CREATE POLICY dm_read_scoped ON public.daily_measurements
FOR SELECT TO authenticated
USING (public.can_read_measurements(auth.uid()) OR submitted_by = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS mli_read_all ON public.measurement_line_items;
CREATE POLICY mli_read_scoped ON public.measurement_line_items
FOR SELECT TO authenticated
USING (
  public.can_read_measurements(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.daily_measurements dm
    WHERE dm.id = measurement_line_items.measurement_id
      AND (dm.submitted_by = auth.uid() OR dm.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can view variations" ON public.project_variations;
CREATE POLICY "Finance and leadership can view variations" ON public.project_variations
FOR SELECT TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'super_admin','managing_director','chairman','director',
    'finance_director','finance_manager','sales_director','architecture_director',
    'head_operations','head_of_projects','principal_architect',
    'planning_head','planning_engineer','costing_engineer','quantity_surveyor'
  ]::app_role[])
  OR initiated_by = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS procurement_prod_read ON public.purchase_orders;
CREATE POLICY po_read_scoped ON public.purchase_orders
FOR SELECT TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'super_admin','managing_director','chairman','director',
    'finance_director','finance_manager','accounts_executive',
    'procurement','procurement_assistant','purchase_assistant','stores_executive',
    'head_operations','head_of_projects','production_head',
    'planning_head','planning_engineer','costing_engineer','quantity_surveyor'
  ]::app_role[])
  OR raised_by = auth.uid()
  OR uploaded_by = auth.uid()
);
