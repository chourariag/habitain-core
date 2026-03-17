
-- Migration 2: Update functions and ALL RLS policies for super_admin

-- Update is_director
CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND role IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director')
      AND is_active = true
  )
$$;

-- Create is_full_admin helper
CREATE OR REPLACE FUNCTION public.is_full_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND role IN ('super_admin', 'managing_director')
      AND is_active = true
  )
$$;

-- MODULES
DROP POLICY IF EXISTS "Planning engineer can insert modules" ON public.modules;
DROP POLICY IF EXISTS "Planning engineer can update modules" ON public.modules;
DROP POLICY IF EXISTS "Authorized can insert modules" ON public.modules;
DROP POLICY IF EXISTS "Authorized can update modules" ON public.modules;

CREATE POLICY "Authorized can insert modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

CREATE POLICY "Authorized can update modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

-- PANELS
DROP POLICY IF EXISTS "Planning engineer can insert panels" ON public.panels;
DROP POLICY IF EXISTS "Planning engineer can update panels" ON public.panels;
DROP POLICY IF EXISTS "Authorized can insert panels" ON public.panels;
DROP POLICY IF EXISTS "Authorized can update panels" ON public.panels;

CREATE POLICY "Authorized can insert panels" ON public.panels
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

CREATE POLICY "Authorized can update panels" ON public.panels
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

-- PROJECTS
DROP POLICY IF EXISTS "Allowed roles can create projects" ON public.projects;
DROP POLICY IF EXISTS "Allowed roles can update projects" ON public.projects;

CREATE POLICY "Allowed roles can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role IN ('super_admin','managing_director','finance_director','sales_director','head_operations','planning_engineer'))
  );

CREATE POLICY "Allowed roles can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role IN ('super_admin','managing_director','finance_director','sales_director','head_operations','planning_engineer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role IN ('super_admin','managing_director','finance_director','sales_director','head_operations','planning_engineer'))
  );

-- PROFILES update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own or admin update any" ON public.profiles;

CREATE POLICY "Users can update own or admin update any" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR is_full_admin(auth.uid()));

-- PRODUCTION_STAGES
DROP POLICY IF EXISTS "Production can insert stages" ON public.production_stages;
DROP POLICY IF EXISTS "Production can update stages" ON public.production_stages;

CREATE POLICY "Production can insert stages" ON public.production_stages
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','head_operations','production_head','factory_floor_supervisor','qc_inspector','finance_director'));

CREATE POLICY "Production can update stages" ON public.production_stages
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','head_operations','production_head','factory_floor_supervisor','qc_inspector','finance_director'));

-- QC_INSPECTIONS
DROP POLICY IF EXISTS "QC can insert inspections" ON public.qc_inspections;
DROP POLICY IF EXISTS "QC can update inspections" ON public.qc_inspections;

CREATE POLICY "QC can insert inspections" ON public.qc_inspections
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head','head_operations'));

CREATE POLICY "QC can update inspections" ON public.qc_inspections
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head','head_operations'));

-- QC_INSPECTION_ITEMS
DROP POLICY IF EXISTS "QC can insert items" ON public.qc_inspection_items;
DROP POLICY IF EXISTS "QC can update items" ON public.qc_inspection_items;

CREATE POLICY "QC can insert items" ON public.qc_inspection_items
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head'));

CREATE POLICY "QC can update items" ON public.qc_inspection_items
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head'));

-- NCR_REGISTER
DROP POLICY IF EXISTS "QC can insert NCRs" ON public.ncr_register;
DROP POLICY IF EXISTS "QC can update NCRs" ON public.ncr_register;

CREATE POLICY "QC can insert NCRs" ON public.ncr_register
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head','head_operations'));

CREATE POLICY "QC can update NCRs" ON public.ncr_register
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','qc_inspector','production_head','head_operations'));

-- LABOUR_CLAIMS
DROP POLICY IF EXISTS "Workers can submit claims" ON public.labour_claims;
DROP POLICY IF EXISTS "Workers or admins can submit claims" ON public.labour_claims;
DROP POLICY IF EXISTS "Supervisors can update claims" ON public.labour_claims;
DROP POLICY IF EXISTS "Supervisors or admins can update claims" ON public.labour_claims;
DROP POLICY IF EXISTS "View own or managed claims" ON public.labour_claims;

CREATE POLICY "Workers or admins can submit claims" ON public.labour_claims
  FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid() OR is_full_admin(auth.uid()));

CREATE POLICY "Supervisors or admins can update claims" ON public.labour_claims
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','factory_floor_supervisor','production_head'));

CREATE POLICY "View own or managed claims" ON public.labour_claims
  FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','factory_floor_supervisor','production_head','head_operations','finance_director','finance_manager')
  );

-- LABOUR_APPROVALS
DROP POLICY IF EXISTS "Supervisors can create approvals" ON public.labour_approvals;
DROP POLICY IF EXISTS "Supervisors or admins can create approvals" ON public.labour_approvals;

CREATE POLICY "Supervisors or admins can create approvals" ON public.labour_approvals
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','factory_floor_supervisor','production_head'));

-- DISPUTE_LOG
DROP POLICY IF EXISTS "Insert disputes" ON public.dispute_log;
DROP POLICY IF EXISTS "View disputes" ON public.dispute_log;

CREATE POLICY "Insert disputes" ON public.dispute_log
  FOR INSERT TO authenticated
  WITH CHECK (
    worker_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','factory_floor_supervisor','production_head','head_operations')
  );

CREATE POLICY "View disputes" ON public.dispute_log
  FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','factory_floor_supervisor','production_head','head_operations','finance_director')
  );

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users see own or admin sees all" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own or admin any" ON public.notifications;

CREATE POLICY "Insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','production_head','finance_manager','factory_floor_supervisor','qc_inspector','hr_executive','planning_engineer','costing_engineer','procurement')
  );

CREATE POLICY "Users see own or admin sees all" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR is_full_admin(auth.uid()));

CREATE POLICY "Users can update own or admin any" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR is_full_admin(auth.uid()));

-- ADMIN_AUDIT_LOG
DROP POLICY IF EXISTS "Insert audit log" ON public.admin_audit_log;

CREATE POLICY "Insert audit log" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    is_director(auth.uid())
    OR get_user_role(auth.uid()) IN ('head_operations','production_head','finance_manager','hr_executive')
  );

-- MATERIAL_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  module_id uuid REFERENCES public.modules(id),
  material_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  urgency text NOT NULL DEFAULT 'standard',
  notes text,
  status text NOT NULL DEFAULT 'pending_budget',
  is_over_budget boolean DEFAULT false,
  budget_approved_by uuid,
  budget_approved_at timestamptz,
  director_approved_by uuid,
  director_approved_at timestamptz,
  po_raised_by uuid,
  po_raised_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_archived boolean DEFAULT false
);

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requestors can insert material requests" ON public.material_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'super_admin','managing_director',
      'site_installation_mgr','site_engineer','factory_floor_supervisor',
      'fabrication_foreman','production_head','head_operations'
    )
  );

CREATE POLICY "View material requests" ON public.material_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director','sales_director','architecture_director',
      'head_operations','production_head','costing_engineer','procurement','stores_executive','finance_manager'
    )
  );

CREATE POLICY "Update material requests" ON public.material_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director',
      'costing_engineer','procurement','stores_executive','head_operations','production_head'
    )
  );

CREATE TRIGGER update_material_requests_updated_at
  BEFORE UPDATE ON public.material_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
