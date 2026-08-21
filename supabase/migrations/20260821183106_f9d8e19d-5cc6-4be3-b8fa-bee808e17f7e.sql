CREATE TYPE public.depreciation_method AS ENUM ('SLM','WDV');

ALTER TABLE public.fixed_assets
  ADD COLUMN useful_life_years numeric(5,2),
  ADD COLUMN depreciation_method public.depreciation_method,
  ADD COLUMN residual_value numeric(14,2),
  ADD COLUMN depreciation_start_date date,
  ADD COLUMN opening_gross_block numeric(14,2),
  ADD COLUMN opening_accumulated_depreciation numeric(14,2),
  ADD COLUMN opening_balance_as_at_date date,
  ADD COLUMN opening_balance_source text,
  ADD COLUMN is_pre_hstack_asset boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fixed_assets.depreciation_start_date IS 'Date the asset was put to use (may differ from purchase_date)';
COMMENT ON COLUMN public.fixed_assets.is_pre_hstack_asset IS 'Explicit marker that asset history predates HStack; never inferred from purchase_date';

ALTER TABLE public.fixed_assets
  ADD CONSTRAINT fixed_assets_useful_life_positive CHECK (useful_life_years IS NULL OR useful_life_years > 0),
  ADD CONSTRAINT fixed_assets_residual_nonneg CHECK (residual_value IS NULL OR residual_value >= 0),
  ADD CONSTRAINT fixed_assets_opening_gross_nonneg CHECK (opening_gross_block IS NULL OR opening_gross_block >= 0),
  ADD CONSTRAINT fixed_assets_opening_acc_dep_nonneg CHECK (opening_accumulated_depreciation IS NULL OR opening_accumulated_depreciation >= 0),
  ADD CONSTRAINT fixed_assets_opening_acc_le_gross CHECK (
    opening_accumulated_depreciation IS NULL OR opening_gross_block IS NULL
    OR opening_accumulated_depreciation <= opening_gross_block
  ),
  ADD CONSTRAINT fixed_assets_opening_requires_date CHECK (
    (opening_gross_block IS NULL AND opening_accumulated_depreciation IS NULL)
    OR opening_balance_as_at_date IS NOT NULL
  ),
  ADD CONSTRAINT fixed_assets_pre_hstack_requires_source CHECK (
    is_pre_hstack_asset = false
    OR opening_gross_block IS NULL
    OR (opening_balance_source IS NOT NULL AND length(btrim(opening_balance_source)) > 0)
  );

CREATE TABLE public.depreciation_block_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_name text NOT NULL UNIQUE,
  useful_life_years numeric(5,2) NOT NULL,
  default_method public.depreciation_method NOT NULL DEFAULT 'SLM',
  source text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users,
  updated_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.depreciation_block_reference TO authenticated;
GRANT INSERT, UPDATE ON public.depreciation_block_reference TO authenticated;
GRANT ALL ON public.depreciation_block_reference TO service_role;

ALTER TABLE public.depreciation_block_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view depreciation blocks"
  ON public.depreciation_block_reference FOR SELECT TO authenticated USING (true);

CREATE POLICY "Finance tier can insert depreciation blocks"
  ON public.depreciation_block_reference FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_full_tier(auth.uid()));

CREATE POLICY "Finance tier can update depreciation blocks"
  ON public.depreciation_block_reference FOR UPDATE TO authenticated
  USING (public.is_finance_full_tier(auth.uid()))
  WITH CHECK (public.is_finance_full_tier(auth.uid()));

CREATE TRIGGER update_depreciation_block_reference_updated_at
  BEFORE UPDATE ON public.depreciation_block_reference
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.depreciation_block_reference (block_name, useful_life_years, default_method, source) VALUES
  ('Computers', 3, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Containers', 20, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Electricals & Fittings', 10, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Factory Canteen', 10, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Furniture & Fixtures', 10, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Office Container', 12, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Office Equipments', 5, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Plant & Machinary', 12, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Tangible Assets)'),
  ('Software-Tally Prime', 10, 'SLM', 'Audited Schedule FA FY25-26 (Note 10, Intangible Assets)');