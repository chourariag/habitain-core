CREATE OR REPLACE FUNCTION public.can_edit_design_schedule(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','sales_director',
        'architecture_director','principal_architect','project_architect',
        'planning_head','planning_engineer','head_operations','operations_architect',
        'costing_engineer'
      )
  )
$function$;