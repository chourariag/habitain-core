CREATE OR REPLACE FUNCTION public.user_has_projects_module_access(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = _uid
      AND p.is_active = true
      AND p.role IN (
        'super_admin'::public.app_role,
        'managing_director'::public.app_role,
        'chairman'::public.app_role,
        'sales_director'::public.app_role,
        'architecture_director'::public.app_role,
        'finance_director'::public.app_role,
        'head_of_projects'::public.app_role,
        'planning_head'::public.app_role,
        'head_operations'::public.app_role,
        'production_head'::public.app_role,
        'site_installation_mgr'::public.app_role,
        'factory_supervisor'::public.app_role,
        'planning_engineer'::public.app_role,
        'costing_engineer'::public.app_role,
        'quantity_surveyor'::public.app_role,
        'senior_architect'::public.app_role,
        'project_architect'::public.app_role,
        'structural_architect'::public.app_role,
        'principal_architect'::public.app_role,
        'finance_manager'::public.app_role,
        'sales_executive'::public.app_role,
        'sales_associate'::public.app_role,
        'procurement'::public.app_role,
        'purchase_assistant'::public.app_role,
        'assistant_manager'::public.app_role
      )
  );
$$;