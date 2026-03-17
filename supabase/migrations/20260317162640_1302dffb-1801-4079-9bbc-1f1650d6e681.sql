
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
