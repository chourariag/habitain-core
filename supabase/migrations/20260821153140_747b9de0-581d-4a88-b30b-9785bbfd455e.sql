-- ============ Shared tier predicates ============
CREATE OR REPLACE FUNCTION public.is_approver_tier(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','sales_director','architecture_director')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hr_admin_tier(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','sales_director','architecture_director',
                   'hr_executive','hr_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_finance_full_tier(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','sales_director','architecture_director',
                   'finance_director','finance_manager','accounts_executive')
  )
$$;

-- ============ Projects (add architecture_director) ============
DROP POLICY IF EXISTS "Allowed roles can create projects" ON public.projects;
CREATE POLICY "Allowed roles can create projects" ON public.projects
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    AND p.role = ANY (ARRAY['super_admin','managing_director','finance_director','sales_director',
      'architecture_director','head_operations','planning_engineer']::app_role[]))
);

DROP POLICY IF EXISTS "Allowed roles can update projects" ON public.projects;
CREATE POLICY "Allowed roles can update projects" ON public.projects
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    AND p.role = ANY (ARRAY['super_admin','managing_director','finance_director','sales_director',
      'architecture_director','head_operations','planning_engineer']::app_role[]))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    AND p.role = ANY (ARRAY['super_admin','managing_director','finance_director','sales_director',
      'architecture_director','head_operations','planning_engineer']::app_role[]))
);

DROP POLICY IF EXISTS "Allowed roles can delete projects" ON public.projects;
CREATE POLICY "Allowed roles can delete projects" ON public.projects
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    AND p.role = ANY (ARRAY['super_admin','managing_director','sales_director','architecture_director']::app_role[]))
);

-- ============ Design uploads ============
DROP POLICY IF EXISTS "Architects can insert project_design_files" ON public.project_design_files;
CREATE POLICY "Architects can insert project_design_files" ON public.project_design_files
FOR INSERT TO authenticated WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','super_admin',
    'managing_director','sales_director','architecture_director']::app_role[])
);

DROP POLICY IF EXISTS "Architects can update project_design_files" ON public.project_design_files;
CREATE POLICY "Architects can update project_design_files" ON public.project_design_files
FOR UPDATE TO authenticated USING (
  get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','super_admin',
    'managing_director','sales_director','architecture_director']::app_role[])
);

DROP POLICY IF EXISTS "Architects can insert drawings" ON public.drawings;
CREATE POLICY "Architects can insert drawings" ON public.drawings
FOR INSERT TO authenticated WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','structural_architect',
    'super_admin','managing_director','sales_director','architecture_director']::app_role[])
);

DROP POLICY IF EXISTS "Architects can update drawings" ON public.drawings;
CREATE POLICY "Architects can update drawings" ON public.drawings
FOR UPDATE TO authenticated USING (
  get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','structural_architect',
    'super_admin','managing_director','sales_director','architecture_director']::app_role[])
);

-- ============ Finance writes ============
DROP POLICY IF EXISTS "Finance roles can insert PL" ON public.finance_pl_data;
CREATE POLICY "Finance roles can insert PL" ON public.finance_pl_data
FOR INSERT TO authenticated WITH CHECK (public.is_finance_full_tier(auth.uid()));
DROP POLICY IF EXISTS "Finance roles can update PL" ON public.finance_pl_data;
CREATE POLICY "Finance roles can update PL" ON public.finance_pl_data
FOR UPDATE TO authenticated USING (public.is_finance_full_tier(auth.uid()));

DROP POLICY IF EXISTS "Finance roles can insert payments" ON public.finance_payments;
CREATE POLICY "Finance roles can insert payments" ON public.finance_payments
FOR INSERT TO authenticated WITH CHECK (public.is_finance_full_tier(auth.uid()));
DROP POLICY IF EXISTS "Finance roles can update payments" ON public.finance_payments;
CREATE POLICY "Finance roles can update payments" ON public.finance_payments
FOR UPDATE TO authenticated USING (public.is_finance_full_tier(auth.uid()));

DROP POLICY IF EXISTS "Finance roles can insert cashflow" ON public.finance_cashflow;
CREATE POLICY "Finance roles can insert cashflow" ON public.finance_cashflow
FOR INSERT TO authenticated WITH CHECK (public.is_finance_full_tier(auth.uid()));

DROP POLICY IF EXISTS "Finance roles can insert budgets" ON public.finance_project_budgets;
CREATE POLICY "Finance roles can insert budgets" ON public.finance_project_budgets
FOR INSERT TO authenticated WITH CHECK (public.is_finance_full_tier(auth.uid()));
DROP POLICY IF EXISTS "Finance roles can update budgets" ON public.finance_project_budgets;
CREATE POLICY "Finance roles can update budgets" ON public.finance_project_budgets
FOR UPDATE TO authenticated USING (public.is_finance_full_tier(auth.uid()));
DROP POLICY IF EXISTS "Finance directors can delete project budgets" ON public.finance_project_budgets;
CREATE POLICY "Finance directors can delete project budgets" ON public.finance_project_budgets
FOR DELETE TO authenticated USING (
  get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director',
    'sales_director','architecture_director']::app_role[])
);

CREATE OR REPLACE FUNCTION public.can_manage_finance_pl(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager',
                   'accounts_executive','head_operations','sales_director','architecture_director')
  )
$$;

-- ============ Quotations ============
CREATE OR REPLACE FUNCTION public.can_approve_quotations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'super_admin','managing_director','costing_engineer','sales_director','architecture_director'
  ]::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_view_quotations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'super_admin','managing_director','finance_director','head_operations',
    'procurement','costing_engineer','planning_head','planning_engineer',
    'sales_director','architecture_director'
  ]::app_role[])
$$;

-- ============ HR / payroll ============
DROP POLICY IF EXISTS "HR can view hr_settings" ON public.hr_settings;
CREATE POLICY "HR can view hr_settings" ON public.hr_settings
FOR SELECT TO authenticated USING (
  public.is_hr_admin_tier(auth.uid())
  OR get_user_role(auth.uid()) = ANY (ARRAY['finance_director']::app_role[])
);
DROP POLICY IF EXISTS "HR can insert hr_settings" ON public.hr_settings;
CREATE POLICY "HR can insert hr_settings" ON public.hr_settings
FOR INSERT TO authenticated WITH CHECK (public.is_hr_admin_tier(auth.uid()));
DROP POLICY IF EXISTS "HR and directors update hr_settings" ON public.hr_settings;
CREATE POLICY "HR and directors update hr_settings" ON public.hr_settings
FOR UPDATE TO authenticated USING (
  public.is_hr_admin_tier(auth.uid())
  OR get_user_role(auth.uid()) = ANY (ARRAY['finance_director']::app_role[])
);
DROP POLICY IF EXISTS "HR can delete hr_settings" ON public.hr_settings;
CREATE POLICY "HR can delete hr_settings" ON public.hr_settings
FOR DELETE TO authenticated USING (
  get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director',
    'sales_director','architecture_director']::app_role[])
);

DROP POLICY IF EXISTS "Owner or HR can read private info" ON public.profile_private_info;
CREATE POLICY "Owner or HR can read private info" ON public.profile_private_info
FOR SELECT TO authenticated USING (
  profile_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  OR can_view_profile_pii(auth.uid())
  OR public.is_hr_admin_tier(auth.uid())
);
DROP POLICY IF EXISTS "Owner or HR can upsert private info" ON public.profile_private_info;
CREATE POLICY "Owner or HR can upsert private info" ON public.profile_private_info
FOR INSERT TO authenticated WITH CHECK (
  profile_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  OR can_view_profile_pii(auth.uid())
  OR public.is_hr_admin_tier(auth.uid())
);
DROP POLICY IF EXISTS "Owner or HR can update private info" ON public.profile_private_info;
CREATE POLICY "Owner or HR can update private info" ON public.profile_private_info
FOR UPDATE TO authenticated USING (
  profile_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  OR can_view_profile_pii(auth.uid())
  OR public.is_hr_admin_tier(auth.uid())
) WITH CHECK (
  profile_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  OR can_view_profile_pii(auth.uid())
  OR public.is_hr_admin_tier(auth.uid())
);
DROP POLICY IF EXISTS "HR can delete private info" ON public.profile_private_info;
CREATE POLICY "HR can delete private info" ON public.profile_private_info
FOR DELETE TO authenticated USING (
  can_view_profile_pii(auth.uid()) OR public.is_hr_admin_tier(auth.uid())
);

CREATE OR REPLACE FUNCTION public.can_manage_hr_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager',
                   'accounts_executive','hr_executive','sales_director','architecture_director')
  )
$$;

-- ============ Leave: org-wide for HR-admin tier ============
DROP POLICY IF EXISTS "Managers can view team leave" ON public.leave_requests;
CREATE POLICY "Managers can view team leave" ON public.leave_requests
FOR SELECT TO authenticated USING (
  is_reporting_manager_of(auth.uid(), user_id) OR public.is_hr_admin_tier(auth.uid())
);
DROP POLICY IF EXISTS "HR and managers can update leave" ON public.leave_requests;
CREATE POLICY "HR and managers can update leave" ON public.leave_requests
FOR UPDATE TO authenticated USING (
  is_reporting_manager_of(auth.uid(), user_id) OR public.is_hr_admin_tier(auth.uid())
) WITH CHECK (
  is_reporting_manager_of(auth.uid(), user_id) OR public.is_hr_admin_tier(auth.uid())
);

-- ============ user_roles: role changes for HR-admin tier ============
DROP POLICY IF EXISTS "Only MD can manage user_roles" ON public.user_roles;
CREATE POLICY "Leadership can manage user_roles" ON public.user_roles
FOR ALL TO authenticated USING (
  is_md(auth.uid()) OR public.is_hr_admin_tier(auth.uid())
) WITH CHECK (
  (is_md(auth.uid()) OR public.is_hr_admin_tier(auth.uid()))
  AND (role <> ALL (ARRAY['super_admin','managing_director']::app_role[])
       OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- ============ Retention / DLP ============
DROP POLICY IF EXISTS "Finance manages retention entries" ON public.client_wo_retention_entries;
CREATE POLICY "Finance manages retention entries" ON public.client_wo_retention_entries
FOR ALL TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'managing_director'::app_role)
  OR has_role(auth.uid(),'chairman'::app_role) OR has_role(auth.uid(),'finance_director'::app_role)
  OR has_role(auth.uid(),'finance_manager'::app_role) OR public.is_approver_tier(auth.uid())
) WITH CHECK (
  has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'managing_director'::app_role)
  OR has_role(auth.uid(),'chairman'::app_role) OR has_role(auth.uid(),'finance_director'::app_role)
  OR has_role(auth.uid(),'finance_manager'::app_role) OR public.is_approver_tier(auth.uid())
);

DROP POLICY IF EXISTS "Finance manages dlp" ON public.client_wo_dlp;
CREATE POLICY "Finance manages dlp" ON public.client_wo_dlp
FOR ALL TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'managing_director'::app_role)
  OR has_role(auth.uid(),'chairman'::app_role) OR has_role(auth.uid(),'finance_director'::app_role)
  OR has_role(auth.uid(),'finance_manager'::app_role) OR has_role(auth.uid(),'head_of_projects'::app_role)
  OR public.is_approver_tier(auth.uid())
) WITH CHECK (
  has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'managing_director'::app_role)
  OR has_role(auth.uid(),'chairman'::app_role) OR has_role(auth.uid(),'finance_director'::app_role)
  OR has_role(auth.uid(),'finance_manager'::app_role) OR has_role(auth.uid(),'head_of_projects'::app_role)
  OR public.is_approver_tier(auth.uid())
);

-- ============ Approval thresholds ============
DROP POLICY IF EXISTS "MD manages thresholds" ON public.approval_thresholds;
CREATE POLICY "Approver tier manages thresholds" ON public.approval_thresholds
FOR ALL TO authenticated USING (public.is_approver_tier(auth.uid()))
WITH CHECK (public.is_approver_tier(auth.uid()));
