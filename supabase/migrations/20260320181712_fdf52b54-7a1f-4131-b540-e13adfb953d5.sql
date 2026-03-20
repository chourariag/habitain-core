
CREATE TABLE public.sales_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  contact_number text,
  email text,
  project_type text NOT NULL DEFAULT 'Other',
  temperature text NOT NULL DEFAULT 'warm',
  lead_source text DEFAULT 'Other',
  estimated_sqft numeric,
  contract_value numeric NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'Inquiry',
  assigned_to uuid,
  next_followup_date date,
  notes text,
  amc_interest text DEFAULT 'not_discussed',
  lost_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_deals" ON public.sales_deals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_deals" ON public.sales_deals
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE POLICY "Sales roles can update sales_deals" ON public.sales_deals
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE TABLE public.sales_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_stage_history" ON public.sales_stage_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_stage_history" ON public.sales_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE TABLE public.sales_amc_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  contacted_by uuid,
  notes text,
  followup_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_amc_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_amc_contacts" ON public.sales_amc_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_amc_contacts" ON public.sales_amc_contacts
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));
