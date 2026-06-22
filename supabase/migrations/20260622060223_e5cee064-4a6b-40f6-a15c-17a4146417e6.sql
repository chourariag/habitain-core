
-- 1) clients_master: narrow SELECT
DROP POLICY IF EXISTS "Sales/Finance can view clients_master" ON public.clients_master;
CREATE POLICY "Sales/Finance can view clients_master"
ON public.clients_master FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role,
  'managing_director'::app_role,
  'finance_director'::app_role,
  'finance_manager'::app_role,
  'sales_director'::app_role,
  'architecture_director'::app_role,
  'head_operations'::app_role
]));

-- 2) design_consultants: drop head_operations + planning_engineer from view
DROP POLICY IF EXISTS "Architects can view design_consultants" ON public.design_consultants;
CREATE POLICY "Architects can view design_consultants"
ON public.design_consultants FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role,
  'managing_director'::app_role,
  'architecture_director'::app_role,
  'principal_architect'::app_role,
  'project_architect'::app_role,
  'structural_architect'::app_role,
  'operations_architect'::app_role
]));

-- 3) subcontractors: tighten can_access_subcontractors
CREATE OR REPLACE FUNCTION public.can_access_subcontractors(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','sales_director','architecture_director',
        'head_operations','finance_manager',
        'production_head','site_installation_mgr','procurement','stores_executive'
      )
  )
$$;

-- 4) payroll_config: narrow bulk read; keep own-row read.
DROP POLICY IF EXISTS "Employees view own payroll_config" ON public.payroll_config;
CREATE POLICY "Employees view own payroll_config"
ON public.payroll_config FOR SELECT
USING (
  (user_id = auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY[
    'super_admin','managing_director','finance_director','finance_manager'
  ]::app_role[])
);
