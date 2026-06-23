
-- Add new editable fields to project_revenue_margin
ALTER TABLE public.project_revenue_margin
  ADD COLUMN IF NOT EXISTS previous_claim_gst numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_claim_gst numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_manager text,
  ADD COLUMN IF NOT EXISTS secondary_manager text;

-- Variation register table
CREATE TABLE IF NOT EXISTS public.variation_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  variation_number text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted','Approved','Rejected','Under Review')),
  valuation_excl_gst numeric NOT NULL DEFAULT 0,
  previous_claim_excl_gst numeric NOT NULL DEFAULT 0,
  this_claim_excl_gst numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, variation_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_register TO authenticated;
GRANT ALL ON public.variation_register TO service_role;

ALTER TABLE public.variation_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/directors can view variations"
  ON public.variation_register FOR SELECT TO authenticated
  USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive','head_operations','planning_head','planning_engineer','costing_engineer']::app_role[]));

CREATE POLICY "Finance manager and MD can insert variations"
  ON public.variation_register FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "Finance manager and MD can update variations"
  ON public.variation_register FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]));

CREATE POLICY "MD can delete variations"
  ON public.variation_register FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_variation_register_project ON public.variation_register(project_id);

CREATE TRIGGER update_variation_register_updated_at
  BEFORE UPDATE ON public.variation_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
