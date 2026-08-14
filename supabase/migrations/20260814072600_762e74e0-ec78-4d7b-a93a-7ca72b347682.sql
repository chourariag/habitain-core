-- 1. client_portal_documents: scope reads to uploader, leadership, project members
DROP POLICY IF EXISTS "Authenticated users can view portal documents" ON public.client_portal_documents;

CREATE POLICY "Scoped view of portal documents"
ON public.client_portal_documents
FOR SELECT TO authenticated
USING (
  public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
  OR uploaded_by = auth.uid()
  OR public.user_can_access_project(auth.uid(), project_id)
);

-- 2. client_wo_dlp: finance / project leadership or project members
DROP POLICY IF EXISTS "Authenticated can view dlp" ON public.client_wo_dlp;

CREATE POLICY "Finance and project team view dlp"
ON public.client_wo_dlp
FOR SELECT TO authenticated
USING (
  public.user_has_any_role(auth.uid(), ARRAY[
    'super_admin','managing_director','chairman','director',
    'finance_director','finance_manager','accounts_executive',
    'planning_head','head_of_projects','head_operations'
  ]::app_role[])
  OR public.user_can_access_project(auth.uid(), project_id)
);

-- 3. client_wo_payment_stages: same tier, scoped through the parent work order
DROP POLICY IF EXISTS "Authenticated can view wo payment stages" ON public.client_wo_payment_stages;

CREATE POLICY "Finance and project team view wo payment stages"
ON public.client_wo_payment_stages
FOR SELECT TO authenticated
USING (
  public.user_has_any_role(auth.uid(), ARRAY[
    'super_admin','managing_director','chairman','director',
    'finance_director','finance_manager','accounts_executive',
    'planning_head','head_of_projects','head_operations'
  ]::app_role[])
);

-- 4. sales_handover_checklists: sales / operations / leadership only
DROP POLICY IF EXISTS "Authenticated can view sales handover checklists" ON public.sales_handover_checklists;

CREATE POLICY "Sales and ops view sales handover checklists"
ON public.sales_handover_checklists
FOR SELECT TO authenticated
USING (
  public.user_has_any_role(auth.uid(), ARRAY[
    'super_admin','managing_director','chairman','director',
    'sales_director','sales_executive','sales_associate','marketing',
    'head_operations','head_of_projects','planning_head','planning_engineer',
    'architecture_director','principal_architect','project_architect'
  ]::app_role[])
);