
-- ===== contracts_register =====
CREATE SEQUENCE IF NOT EXISTS public.contracts_register_seq;

CREATE TABLE public.contracts_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number TEXT UNIQUE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  scope_of_work TEXT,
  contract_type TEXT CHECK (contract_type IN ('Labour','Supply','Labour+Supply','Design','Consultancy')),
  contract_value_excl_gst NUMERIC(14,2) DEFAULT 0,
  gst_percent NUMERIC(5,2) DEFAULT 18,
  contract_value_incl_gst NUMERIC(14,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(contract_value_excl_gst,0) * (1 + COALESCE(gst_percent,0)/100), 2)
  ) STORED,
  start_date DATE,
  end_date DATE,
  retention_percent NUMERIC(5,2) DEFAULT 0,
  retention_amount NUMERIC(14,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(contract_value_excl_gst,0) * COALESCE(retention_percent,0) / 100, 2)
  ) STORED,
  payment_terms TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','On Hold','Disputed')),
  remarks TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assign_contract_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq INT; yr TEXT;
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    yr := to_char(now(), 'YYYY');
    seq := nextval('public.contracts_register_seq');
    NEW.contract_number := 'CON-' || yr || '-' || LPAD(seq::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_assign_contract_number
  BEFORE INSERT ON public.contracts_register
  FOR EACH ROW EXECUTE FUNCTION public.assign_contract_number();

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts_register TO authenticated;
GRANT ALL ON public.contracts_register TO service_role;

ALTER TABLE public.contracts_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contracts: editors read"
  ON public.contracts_register FOR SELECT TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','procurement','planning_head','finance_manager']::app_role[]));

CREATE POLICY "Contracts: editors insert"
  ON public.contracts_register FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','procurement','planning_head']::app_role[]));

CREATE POLICY "Contracts: editors update"
  ON public.contracts_register FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','procurement','planning_head']::app_role[]));

CREATE POLICY "Contracts: editors delete"
  ON public.contracts_register FOR DELETE TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','procurement','planning_head']::app_role[]));

-- ===== order_book =====
CREATE TABLE public.order_book (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('3d_factory','2d_factory','on_site','outsourced')),
  status TEXT CHECK (status IN ('GFC','Design','Tender','On Hold','Completed')),
  tech_type TEXT,
  contract_value_cr NUMERIC(10,2) DEFAULT 0,
  modules_count INTEGER DEFAULT 0,
  sqft NUMERIC(12,2) DEFAULT 0,
  location TEXT,
  monthly_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  financial_year TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_book_fy ON public.order_book(financial_year);
CREATE INDEX idx_order_book_cat ON public.order_book(category);

CREATE TRIGGER trg_order_book_updated_at
  BEFORE UPDATE ON public.order_book
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_book TO authenticated;
GRANT ALL ON public.order_book TO service_role;

ALTER TABLE public.order_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order book: leadership read"
  ON public.order_book FOR SELECT TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','planning_head','principal_architect','production_head','site_installation_mgr',
          'finance_manager']::app_role[]));

CREATE POLICY "Order book: leadership insert"
  ON public.order_book FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','planning_head']::app_role[]));

CREATE POLICY "Order book: leadership update"
  ON public.order_book FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','planning_head']::app_role[]));

CREATE POLICY "Order book: leadership delete"
  ON public.order_book FOR DELETE TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','planning_head']::app_role[]));
