
-- Work Order Requests + Work Order Register
CREATE TABLE public.wo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  scope_of_work text NOT NULL,
  subcontractor_name text NOT NULL,
  estimated_value numeric(14,2) NOT NULL DEFAULT 0,
  required_start_date date,
  status text NOT NULL DEFAULT 'pending_costing'
    CHECK (status IN ('draft','pending_costing','pending_approval','approved','rejected','wo_prepared')),
  costing_engineer_notes text,
  costing_approved_by uuid REFERENCES auth.users(id),
  costing_approved_at timestamptz,
  operations_approver_id uuid REFERENCES auth.users(id),
  operations_approved_at timestamptz,
  rejection_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.wo_requests TO authenticated;
GRANT ALL ON public.wo_requests TO service_role;
ALTER TABLE public.wo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated in listed roles can view all WO requests
CREATE POLICY "wo_requests_select" ON public.wo_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'production_head'::app_role)
  OR public.has_role(auth.uid(),'site_installation_mgr'::app_role)
  OR public.has_role(auth.uid(),'costing_engineer'::app_role)
  OR public.has_role(auth.uid(),'planning_head'::app_role)
  OR public.has_role(auth.uid(),'head_of_projects'::app_role)
  OR public.has_role(auth.uid(),'managing_director'::app_role)
  OR public.has_role(auth.uid(),'finance_director'::app_role)
  OR public.has_role(auth.uid(),'principal_architect'::app_role)
  OR public.has_role(auth.uid(),'accounts_executive'::app_role)
  OR public.is_full_admin(auth.uid())
);

CREATE POLICY "wo_requests_insert" ON public.wo_requests FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(),'production_head'::app_role)
    OR public.has_role(auth.uid(),'site_installation_mgr'::app_role)
    OR public.is_full_admin(auth.uid())
  )
);

CREATE POLICY "wo_requests_update" ON public.wo_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'costing_engineer'::app_role)
  OR public.has_role(auth.uid(),'planning_head'::app_role)
  OR public.has_role(auth.uid(),'head_of_projects'::app_role)
  OR public.has_role(auth.uid(),'managing_director'::app_role)
  OR public.has_role(auth.uid(),'finance_director'::app_role)
  OR public.has_role(auth.uid(),'principal_architect'::app_role)
  OR public.has_role(auth.uid(),'accounts_executive'::app_role)
  OR (created_by = auth.uid() AND status = 'pending_costing')
  OR public.is_full_admin(auth.uid())
);

CREATE TRIGGER trg_wo_requests_updated_at
BEFORE UPDATE ON public.wo_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wo_requests_project ON public.wo_requests(project_id);
CREATE INDEX idx_wo_requests_status ON public.wo_requests(status);

-- WO Register from Tally
CREATE TABLE public.work_order_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text NOT NULL,
  wo_date date NOT NULL,
  subcontractor text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  scope_summary text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'active',
  wo_request_id uuid REFERENCES public.wo_requests(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wo_number)
);

GRANT SELECT, INSERT, UPDATE ON public.work_order_register TO authenticated;
GRANT ALL ON public.work_order_register TO service_role;
ALTER TABLE public.work_order_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_register_select" ON public.work_order_register FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'production_head'::app_role)
  OR public.has_role(auth.uid(),'site_installation_mgr'::app_role)
  OR public.has_role(auth.uid(),'costing_engineer'::app_role)
  OR public.has_role(auth.uid(),'planning_head'::app_role)
  OR public.has_role(auth.uid(),'head_of_projects'::app_role)
  OR public.has_role(auth.uid(),'managing_director'::app_role)
  OR public.has_role(auth.uid(),'finance_director'::app_role)
  OR public.has_role(auth.uid(),'principal_architect'::app_role)
  OR public.has_role(auth.uid(),'accounts_executive'::app_role)
  OR public.is_full_admin(auth.uid())
);

CREATE POLICY "wo_register_insert" ON public.work_order_register FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.has_role(auth.uid(),'accounts_executive'::app_role)
    OR public.is_full_admin(auth.uid())
  )
);

CREATE POLICY "wo_register_update" ON public.work_order_register FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'accounts_executive'::app_role)
  OR public.is_full_admin(auth.uid())
);

CREATE TRIGGER trg_wo_register_updated_at
BEFORE UPDATE ON public.work_order_register
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wo_register_project ON public.work_order_register(project_id);
CREATE INDEX idx_wo_register_request ON public.work_order_register(wo_request_id);
