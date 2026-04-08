
-- Add new columns to sales_deals
ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS division text NOT NULL DEFAULT 'habitainer',
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS converted_from_ads_deal_id uuid REFERENCES public.sales_deals(id),
  ADD COLUMN IF NOT EXISTS re_engaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS re_engaged_from_deal_id uuid REFERENCES public.sales_deals(id),
  ADD COLUMN IF NOT EXISTS persona_tag text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS within_350km boolean,
  ADD COLUMN IF NOT EXISTS referral_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_quotation_version integer,
  ADD COLUMN IF NOT EXISTS stagnation_alerted_at timestamptz;

-- Sales targets table
CREATE TABLE public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id uuid NOT NULL,
  salesperson_name text NOT NULL,
  division text NOT NULL DEFAULT 'habitainer',
  fiscal_year text NOT NULL DEFAULT 'FY27',
  monthly_target numeric NOT NULL DEFAULT 0,
  quarterly_target numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salesperson_id, division, fiscal_year)
);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales targets"
  ON public.sales_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can manage sales targets"
  ON public.sales_targets FOR ALL TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));

CREATE TRIGGER update_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quotation versions table
CREATE TABLE public.quotation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  date_sent date NOT NULL DEFAULT CURRENT_DATE,
  total_value numeric NOT NULL DEFAULT 0,
  prev_value numeric,
  price_change_amount numeric GENERATED ALWAYS AS (total_value - COALESCE(prev_value, total_value)) STORED,
  price_change_pct numeric GENERATED ALWAYS AS (
    CASE WHEN COALESCE(prev_value, 0) > 0 
    THEN ROUND(((total_value - prev_value) / prev_value) * 100, 1) 
    ELSE 0 END
  ) STORED,
  scope_changes text DEFAULT 'No change',
  payment_terms text DEFAULT '40-40-20',
  timeline text,
  sent_to text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotation versions"
  ON public.quotation_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create quotation versions"
  ON public.quotation_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update quotation versions"
  ON public.quotation_versions FOR UPDATE TO authenticated USING (true);

-- Experience centre visits table
CREATE TABLE public.experience_centre_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  client_name text NOT NULL,
  hosted_by uuid,
  hosted_by_name text,
  notes text,
  outcome text DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_centre_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view EC visits"
  ON public.experience_centre_visits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create EC visits"
  ON public.experience_centre_visits FOR INSERT TO authenticated WITH CHECK (true);

-- Sales handover checklists table
CREATE TABLE public.sales_handover_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE UNIQUE,
  sow_uploaded boolean DEFAULT false,
  sow_url text,
  floor_plans_uploaded boolean DEFAULT false,
  floor_plans_url text,
  visualization_uploaded boolean DEFAULT false,
  visualization_url text,
  design_preferences text,
  special_requirements text,
  payment_terms text DEFAULT '40-40-20',
  delivery_address text,
  within_350km boolean,
  ads_to_habitainer boolean DEFAULT false,
  linked_ads_deal_id uuid REFERENCES public.sales_deals(id),
  completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_handover_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view handover checklists"
  ON public.sales_handover_checklists FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage handover checklists"
  ON public.sales_handover_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_sales_handover_updated_at
  BEFORE UPDATE ON public.sales_handover_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
