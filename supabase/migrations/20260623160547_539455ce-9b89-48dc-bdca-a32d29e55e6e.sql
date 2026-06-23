
-- Receivables tracker
CREATE TABLE IF NOT EXISTS public.receivables_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  section text NOT NULL CHECK (section IN ('habitainer','ads','ads_design')),
  total_amount_incl_gst numeric NOT NULL DEFAULT 0,
  received_amount_incl_gst numeric NOT NULL DEFAULT 0,
  basic_amount_this_bill numeric NOT NULL DEFAULT 0,
  current_receivables_incl_gst numeric NOT NULL DEFAULT 0,
  cumulative_received_incl_gst numeric NOT NULL DEFAULT 0,
  retention_percent numeric NOT NULL DEFAULT 0,
  retention_amount numeric NOT NULL DEFAULT 0,
  pending_amount_excl_retention numeric NOT NULL DEFAULT 0,
  remarks text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables_tracker TO authenticated;
GRANT ALL ON public.receivables_tracker TO service_role;

ALTER TABLE public.receivables_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/directors view receivables"
  ON public.receivables_tracker FOR SELECT TO authenticated
  USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive','head_operations']::app_role[]));

CREATE POLICY "Finance manager and MD insert receivables"
  ON public.receivables_tracker FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "Finance manager and MD update receivables"
  ON public.receivables_tracker FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "MD delete receivables"
  ON public.receivables_tracker FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_receivables_section ON public.receivables_tracker(section);

CREATE TRIGGER update_receivables_tracker_updated_at
  BEFORE UPDATE ON public.receivables_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Billing & sales tracker
CREATE TABLE IF NOT EXISTS public.billing_sales_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  business_unit text NOT NULL CHECK (business_unit IN ('habitainer','ads')),
  milestone_name text,
  milestone_value_excl_gst numeric NOT NULL DEFAULT 0,
  invoice_date date,
  invoice_number text,
  amount_excl_gst numeric NOT NULL DEFAULT 0,
  amount_incl_gst numeric NOT NULL DEFAULT 0,
  payment_received_date date,
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending','Partial','Received','Overdue')),
  remarks text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_sales_tracker TO authenticated;
GRANT ALL ON public.billing_sales_tracker TO service_role;

ALTER TABLE public.billing_sales_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/directors view billing tracker"
  ON public.billing_sales_tracker FOR SELECT TO authenticated
  USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive','head_operations']::app_role[]));

CREATE POLICY "Finance manager and MD insert billing tracker"
  ON public.billing_sales_tracker FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "Finance manager and MD update billing tracker"
  ON public.billing_sales_tracker FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "MD delete billing tracker"
  ON public.billing_sales_tracker FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_billing_business_unit ON public.billing_sales_tracker(business_unit);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_date ON public.billing_sales_tracker(invoice_date);

CREATE TRIGGER update_billing_sales_tracker_updated_at
  BEFORE UPDATE ON public.billing_sales_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
