-- === 20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql ===

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

-- === 20260317134149_6cb2c92d-6f01-43d1-aa31-a5aa2d7e8f40.sql ===

-- Update default current_stage to match the new 9-stage names
ALTER TABLE public.modules ALTER COLUMN current_stage SET DEFAULT 'Sub-Frame';
ALTER TABLE public.panels ALTER COLUMN current_stage SET DEFAULT 'Sub-Frame';

-- === 20260317135642_7ab02d86-a9dc-4fec-b518-f2fd4e957e10.sql ===
-- Create storage bucket for QC photos
INSERT INTO storage.buckets (id, name, public) VALUES ('qc-photos', 'qc-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated can upload qc photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qc-photos');

CREATE POLICY "Anyone can view qc photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qc-photos');

-- === 20260317151827_5c19ddbb-9f16-4e7b-887a-045b8f3d551e.sql ===

-- Site Readiness Checklist submissions
CREATE TABLE public.site_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  submitted_by TEXT NOT NULL,
  foundation_ready BOOLEAN NOT NULL DEFAULT false,
  crane_booked BOOLEAN NOT NULL DEFAULT false,
  site_access_clear BOOLEAN NOT NULL DEFAULT false,
  team_briefed BOOLEAN NOT NULL DEFAULT false,
  safety_equipment BOOLEAN NOT NULL DEFAULT false,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read site_readiness"
  ON public.site_readiness FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert site_readiness"
  ON public.site_readiness FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update site_readiness"
  ON public.site_readiness FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Dispatch Log
CREATE TABLE public.dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  transporter_name TEXT NOT NULL,
  dispatched_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dispatch_log"
  ON public.dispatch_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert dispatch_log"
  ON public.dispatch_log FOR INSERT TO authenticated WITH CHECK (true);

-- Installation Checklist
CREATE TABLE public.installation_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  submitted_by TEXT NOT NULL,
  lifting_sequence TEXT NOT NULL DEFAULT 'pending',
  module_connections TEXT NOT NULL DEFAULT 'pending',
  mep_stitching TEXT NOT NULL DEFAULT 'pending',
  weatherproofing TEXT NOT NULL DEFAULT 'pending',
  snagging TEXT NOT NULL DEFAULT 'pending',
  lifting_photo TEXT,
  connections_photo TEXT,
  mep_photo TEXT,
  weatherproofing_photo TEXT,
  snagging_photo TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.installation_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_checklist"
  ON public.installation_checklist FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert installation_checklist"
  ON public.installation_checklist FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation_checklist"
  ON public.installation_checklist FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Site Diary
CREATE TABLE public.site_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  gps_location TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read site_diary"
  ON public.site_diary FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert site_diary"
  ON public.site_diary FOR INSERT TO authenticated WITH CHECK (true);

-- Handover Pack
CREATE TABLE public.handover_pack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT NOT NULL,
  snag_list TEXT,
  snag_photos TEXT[] DEFAULT '{}',
  om_document_url TEXT,
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_signoff_name TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.handover_pack ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read handover_pack"
  ON public.handover_pack FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert handover_pack"
  ON public.handover_pack FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for site photos
INSERT INTO storage.buckets (id, name, public) VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload site photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos');

CREATE POLICY "Anyone can read site photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos');

-- === 20260317152729_d0597ab0-614a-4a0d-b04a-657f64a340fd.sql ===
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name TEXT NOT NULL,
  category TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory items"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Stores and directors can insert inventory items"
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE POLICY "Stores and directors can update inventory items"
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_archived ON public.inventory_items(is_archived);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  items_summary TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  raised_by UUID,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authorized users can insert purchase orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE POLICY "Authorized users can update purchase orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_archived ON public.purchase_orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(po_date DESC);

CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- === 20260317154520_43090a51-5783-4665-91cd-29685fdb901b.sql ===
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- === 20260317155521_e15de0e3-0585-4f87-aae5-0b2ea65f177f.sql ===

-- Add weather, manpower, blockers to site_diary
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS weather_condition text;
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS manpower_count integer;
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS blockers text;

-- Add handover_notes to handover_pack
ALTER TABLE public.handover_pack ADD COLUMN IF NOT EXISTS handover_notes text;

-- === 20260317162640_1302dffb-1801-4079-9bbc-1f1650d6e681.sql ===

-- R&M Service Tickets
CREATE TABLE public.rm_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  client_name text NOT NULL,
  issue_description text NOT NULL,
  priority text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'open',
  photo_urls text[] NOT NULL DEFAULT '{}'::text[],
  raised_by uuid NOT NULL,
  raised_at timestamp with time zone NOT NULL DEFAULT now(),
  cost_estimate numeric,
  cost_estimated_by uuid,
  cost_estimated_at timestamp with time zone,
  visit_scheduled_date date,
  visit_scheduled_by uuid,
  visit_scheduled_at timestamp with time zone,
  completed_by uuid,
  completed_at timestamp with time zone,
  client_signoff_name text,
  completion_notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rm_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rm_tickets" ON public.rm_tickets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized can insert rm_tickets" ON public.rm_tickets FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role, 'managing_director'::app_role, 'site_installation_mgr'::app_role,
  'site_engineer'::app_role, 'delivery_rm_lead'::app_role, 'head_operations'::app_role,
  'production_head'::app_role, 'sales_director'::app_role
]));

CREATE POLICY "Authorized can update rm_tickets" ON public.rm_tickets FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role, 'managing_director'::app_role, 'costing_engineer'::app_role,
  'planning_engineer'::app_role, 'delivery_rm_lead'::app_role, 'head_operations'::app_role
]));

CREATE TRIGGER update_rm_tickets_updated_at BEFORE UPDATE ON public.rm_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AMC Contracts
CREATE TABLE public.amc_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  client_name text NOT NULL,
  tier text NOT NULL DEFAULT 'basic',
  start_date date NOT NULL,
  end_date date NOT NULL,
  annual_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view amc_contracts" ON public.amc_contracts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can insert amc_contracts" ON public.amc_contracts FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role, 'managing_director'::app_role, 'sales_director'::app_role
]));

CREATE POLICY "Directors can update amc_contracts" ON public.amc_contracts FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY[
  'super_admin'::app_role, 'managing_director'::app_role, 'sales_director'::app_role
]));

CREATE TRIGGER update_amc_contracts_updated_at BEFORE UPDATE ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

