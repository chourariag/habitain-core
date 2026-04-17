
CREATE TABLE public.sop_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  process_name TEXT,
  role_performs TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved')),
  purpose TEXT,
  scope TEXT,
  materials_tools TEXT,
  steps TEXT,
  quality_criteria TEXT,
  common_mistakes TEXT,
  safety TEXT,
  escalation TEXT,
  linked_module TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  last_updated_by UUID,
  last_updated_by_name TEXT,
  approved_by UUID,
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sop_department ON public.sop_procedures(department);
CREATE INDEX idx_sop_status ON public.sop_procedures(status);
CREATE INDEX idx_sop_updated ON public.sop_procedures(updated_at DESC);

CREATE TABLE public.sop_view_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES public.sop_procedures(id) ON DELETE CASCADE,
  viewed_by UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sop_view_log_sop ON public.sop_view_log(sop_id);

CREATE TRIGGER update_sop_procedures_updated_at
BEFORE UPDATE ON public.sop_procedures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_edit_sop_dept(_user_id uuid, _department text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND (
        role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations')
        OR (role IN ('production_head','factory_floor_supervisor','fabrication_foreman') AND _department = 'Factory Production')
        OR (role IN ('site_installation_mgr','site_engineer','delivery_rm_lead') AND _department = 'Site Installation')
        OR (role = 'qc_inspector' AND _department = 'Quality Control')
        OR (role IN ('procurement','stores_executive') AND _department = 'Procurement & Stores')
        OR (role IN ('principal_architect','project_architect','structural_architect','planning_engineer','costing_engineer','quantity_surveyor') AND _department = 'Design & Engineering')
        OR (role IN ('finance_manager','accounts_executive') AND _department = 'Finance & Accounting')
        OR (role = 'hr_executive' AND _department = 'HR & Administration')
        OR (_department = 'Health & Safety' AND role IN ('production_head','site_installation_mgr','qc_inspector','head_operations'))
      )
  )
$$;

ALTER TABLE public.sop_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_view_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View approved or own draft SOPs"
ON public.sop_procedures FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR public.is_director(auth.uid())
  OR created_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "HODs create SOPs in their department"
ON public.sop_procedures FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_sop_dept(auth.uid(), department));

CREATE POLICY "HODs update SOPs in their department"
ON public.sop_procedures FOR UPDATE
TO authenticated
USING (public.can_edit_sop_dept(auth.uid(), department));

CREATE POLICY "Directors delete SOPs"
ON public.sop_procedures FOR DELETE
TO authenticated
USING (public.is_director(auth.uid()));

CREATE POLICY "Anyone signed in can log a view"
ON public.sop_view_log FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Directors read view log"
ON public.sop_view_log FOR SELECT
TO authenticated
USING (public.is_director(auth.uid()));
