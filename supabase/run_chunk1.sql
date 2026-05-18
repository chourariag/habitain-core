-- === 20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql ===
-- HABITAINER PRODUCTION OS — PHASE 1 SCHEMA

-- Role enum
CREATE TYPE public.app_role AS ENUM (
  'finance_director', 'sales_director', 'architecture_director',
  'head_operations', 'production_head', 'finance_manager',
  'planning_engineer', 'costing_engineer', 'quantity_surveyor',
  'site_installation_mgr', 'delivery_rm_lead', 'site_engineer',
  'qc_inspector', 'factory_floor_supervisor',
  'fabrication_foreman', 'electrical_installer', 'elec_plumbing_installer',
  'procurement', 'stores_executive', 'accounts_executive',
  'hr_executive', 'project_architect', 'structural_architect'
);

CREATE TYPE public.login_type AS ENUM ('email', 'otp');

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  role public.app_role NOT NULL DEFAULT 'electrical_installer',
  language TEXT DEFAULT 'en',
  reporting_manager_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  login_type public.login_type DEFAULT 'email',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer functions for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND role = _role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE auth_user_id = _user_id AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_director(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND role IN ('finance_director', 'sales_director', 'architecture_director')
      AND is_active = true
  )
$$;

-- Profiles RLS
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_active = true OR auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Directors can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()));

-- USER ROLES TABLE (separate per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_director(auth.uid()));

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  location TEXT,
  type TEXT,
  status TEXT DEFAULT 'planning',
  start_date DATE,
  est_completion DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Management can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head'
  ));

CREATE POLICY "Management can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head'
  ));

-- MODULES
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  panel_id TEXT,
  current_stage TEXT DEFAULT 'Fabrication - Main Frame',
  production_status TEXT DEFAULT 'not_started',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can insert modules" ON public.modules FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head', 'planning_engineer'
  ));
CREATE POLICY "Management can update modules" ON public.modules FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head', 'planning_engineer'
  ));

-- PRODUCTION STAGES
CREATE TABLE public.production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  stage_name TEXT NOT NULL,
  stage_order INT NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.production_stages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_production_stages_updated_at BEFORE UPDATE ON public.production_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view stages" ON public.production_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Production can insert stages" ON public.production_stages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN (
    'head_operations', 'production_head', 'factory_floor_supervisor', 'qc_inspector', 'finance_director'
  ));
CREATE POLICY "Production can update stages" ON public.production_stages FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN (
    'head_operations', 'production_head', 'factory_floor_supervisor', 'qc_inspector', 'finance_director'
  ));

-- RATE CARDS
CREATE TABLE public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  rate_per_unit NUMERIC NOT NULL,
  effective_from DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_rate_cards_updated_at BEFORE UPDATE ON public.rate_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view rate cards" ON public.rate_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors can insert rate cards" ON public.rate_cards FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()));
CREATE POLICY "Directors can update rate cards" ON public.rate_cards FOR UPDATE TO authenticated
  USING (public.is_director(auth.uid()));

-- LABOUR CLAIMS
CREATE TABLE public.labour_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) NOT NULL,
  worker_id UUID REFERENCES auth.users(id) NOT NULL,
  trade TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  work_description TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.labour_claims ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_labour_claims_updated_at BEFORE UPDATE ON public.labour_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View own or managed claims" ON public.labour_claims FOR SELECT TO authenticated
  USING (worker_id = auth.uid() OR public.get_user_role(auth.uid()) IN (
    'factory_floor_supervisor', 'production_head', 'head_operations',
    'finance_director', 'finance_manager'
  ));

CREATE POLICY "Workers can submit claims" ON public.labour_claims FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Supervisors can update claims" ON public.labour_claims FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('factory_floor_supervisor', 'production_head'));

-- LABOUR APPROVALS
CREATE TABLE public.labour_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.labour_claims(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  reason_if_rejected TEXT,
  photo_url TEXT,
  actioned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.labour_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View approvals" ON public.labour_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can create approvals" ON public.labour_approvals FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('factory_floor_supervisor', 'production_head'));

-- DISPUTE LOG
CREATE TABLE public.dispute_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.labour_claims(id) NOT NULL,
  worker_id UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dispute_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View disputes" ON public.dispute_log FOR SELECT TO authenticated USING (
  worker_id = auth.uid() OR public.get_user_role(auth.uid()) IN (
    'factory_floor_supervisor', 'production_head', 'head_operations', 'finance_director'
  )
);
CREATE POLICY "Insert disputes" ON public.dispute_log FOR INSERT TO authenticated WITH CHECK (true);

-- QC CHECKLIST ITEMS
CREATE TABLE public.qc_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name TEXT NOT NULL,
  item_number INT NOT NULL,
  description TEXT NOT NULL,
  is_critical BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qc_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_qc_checklist_updated_at BEFORE UPDATE ON public.qc_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view checklist" ON public.qc_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors can insert checklist" ON public.qc_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()));
CREATE POLICY "Directors can update checklist" ON public.qc_checklist_items FOR UPDATE TO authenticated
  USING (public.is_director(auth.uid()));

-- QC INSPECTIONS
CREATE TABLE public.qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) NOT NULL,
  inspector_id UUID REFERENCES auth.users(id) NOT NULL,
  stage_name TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  ai_response JSONB,
  dispatch_decision TEXT,
  submitted_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_qc_inspections_updated_at BEFORE UPDATE ON public.qc_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View inspections" ON public.qc_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "QC can insert inspections" ON public.qc_inspections FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head', 'head_operations'));
CREATE POLICY "QC can update inspections" ON public.qc_inspections FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head', 'head_operations'));

-- QC INSPECTION ITEMS
CREATE TABLE public.qc_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.qc_inspections(id) ON DELETE CASCADE NOT NULL,
  checklist_item_id UUID REFERENCES public.qc_checklist_items(id) NOT NULL,
  result TEXT,
  notes TEXT,
  photo_url TEXT,
  ai_severity TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qc_inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View inspection items" ON public.qc_inspection_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "QC can insert items" ON public.qc_inspection_items FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head'));
CREATE POLICY "QC can update items" ON public.qc_inspection_items FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head'));

-- NCR REGISTER
CREATE TABLE public.ncr_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.qc_inspections(id),
  checklist_item_id UUID REFERENCES public.qc_checklist_items(id),
  ncr_number TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  raised_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ncr_register ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_ncr_register_updated_at BEFORE UPDATE ON public.ncr_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View NCRs" ON public.ncr_register FOR SELECT TO authenticated USING (true);
CREATE POLICY "QC can insert NCRs" ON public.ncr_register FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head', 'head_operations'));
CREATE POLICY "QC can update NCRs" ON public.ncr_register FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('qc_inspector', 'production_head', 'head_operations'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  linked_entity_type TEXT,
  linked_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

-- ADMIN AUDIT LOG
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors can view audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_director(auth.uid()));
CREATE POLICY "System can insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
-- === 20260316172242_1fe4f4ca-d8fb-4c01-885f-26161ad884df.sql ===
-- Fix permissive INSERT policies

-- Dispute log: only the worker or supervisor can insert
DROP POLICY "Insert disputes" ON public.dispute_log;
CREATE POLICY "Insert disputes" ON public.dispute_log FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid() OR public.get_user_role(auth.uid()) IN (
    'factory_floor_supervisor', 'production_head', 'head_operations'
  ));

-- Notifications: restrict insert to management roles and system
DROP POLICY "System can create notifications" ON public.notifications;
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head', 'finance_manager',
    'factory_floor_supervisor', 'qc_inspector', 'hr_executive',
    'planning_engineer', 'costing_engineer', 'procurement'
  ));

-- Audit log: only directors and management can insert
DROP POLICY "System can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()) OR public.get_user_role(auth.uid()) IN (
    'head_operations', 'production_head', 'finance_manager', 'hr_executive'
  ));
-- === 20260317033248_f7d066e5-ba0b-4d7e-8526-88147c373c8c.sql ===
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'managing_director';
-- === 20260317033314_1135849e-aad1-4049-80b4-4fd413ba7005.sql ===
CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND role IN ('managing_director', 'finance_director', 'sales_director', 'architecture_director')
      AND is_active = true
  )
$$;
-- === 20260317041107_88e937b0-c2c2-42fe-9c5b-a4bdf1de7ac3.sql ===

-- Fix projects INSERT policy to include managing_director and planning_engineer
DROP POLICY IF EXISTS "Management can create projects" ON projects;
CREATE POLICY "Management can create projects" ON projects FOR INSERT TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'managing_director'::app_role,
    'finance_director'::app_role,
    'sales_director'::app_role,
    'architecture_director'::app_role,
    'head_operations'::app_role,
    'production_head'::app_role,
    'planning_engineer'::app_role
  ])
);

-- Fix projects UPDATE policy to include managing_director and planning_engineer
DROP POLICY IF EXISTS "Management can update projects" ON projects;
CREATE POLICY "Management can update projects" ON projects FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'managing_director'::app_role,
    'finance_director'::app_role,
    'sales_director'::app_role,
    'architecture_director'::app_role,
    'head_operations'::app_role,
    'production_head'::app_role,
    'planning_engineer'::app_role
  ])
);

-- Add kiosk_pin column to profiles for PIN-based kiosk login
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kiosk_pin text;

-- === 20260317042953_9bb4a8ae-43ae-43cc-a03d-9c5b065524d6.sql ===
-- Recreate projects RLS policies with direct profile role checks
DROP POLICY IF EXISTS "Authenticated can view projects" ON public.projects;
DROP POLICY IF EXISTS "Management can create projects" ON public.projects;
DROP POLICY IF EXISTS "Management can update projects" ON public.projects;
DROP POLICY IF EXISTS "Allow directors and engineers to create and view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow directors and engineers to view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all authenticated users to view projects" ON public.projects;

CREATE POLICY "Authenticated users can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allowed roles can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
);

CREATE POLICY "Allowed roles can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
);
-- === 20260317122946_b97dd4bb-698a-49d2-9217-84303683af25.sql ===

-- 1. Add module_type and module_code to modules
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS module_type text NOT NULL DEFAULT 'standard';
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS module_code text;

-- 2. Create panels table
CREATE TABLE IF NOT EXISTS public.panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  panel_code text NOT NULL,
  panel_type text NOT NULL DEFAULT 'wall',
  length_mm numeric,
  height_mm numeric,
  production_status text DEFAULT 'not_started',
  current_stage text DEFAULT 'Fabrication - Main Frame',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_archived boolean DEFAULT false,
  UNIQUE(panel_code)
);

-- 3. Enable RLS on panels
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

-- 4. Fix modules RLS: drop old INSERT/UPDATE policies, recreate for planning_engineer only
DROP POLICY IF EXISTS "Management can insert modules" ON public.modules;
DROP POLICY IF EXISTS "Management can update modules" ON public.modules;

CREATE POLICY "Planning engineer can insert modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'planning_engineer');

CREATE POLICY "Planning engineer can update modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'planning_engineer');

-- 5. Panels RLS policies
CREATE POLICY "Authenticated can view panels" ON public.panels
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planning engineer can insert panels" ON public.panels
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'planning_engineer');

CREATE POLICY "Planning engineer can update panels" ON public.panels
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'planning_engineer');

-- 6. updated_at trigger for panels
CREATE TRIGGER update_panels_updated_at
  BEFORE UPDATE ON public.panels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- === 20260317131923_ee4818a1-a4eb-4625-bc7f-857986fde844.sql ===

-- Migration 1: Just add the enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

