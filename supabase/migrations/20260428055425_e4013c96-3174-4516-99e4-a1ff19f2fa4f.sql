-- Work Orders system

-- Sequence helper for WO numbering per project per month
CREATE TABLE IF NOT EXISTS public.work_order_sequences (
  project_id uuid NOT NULL,
  yearmonth text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, yearmonth)
);
ALTER TABLE public.work_order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo_seq_admin_all" ON public.work_order_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Main work_orders table
CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id),
  work_type text NOT NULL,
  scope_of_work text NOT NULL,
  location_area text NOT NULL,
  measurement_basis text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  rate numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  boq_category text NOT NULL,
  planned_start_date date NOT NULL,
  planned_completion_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending_costing_approval',
  raised_by uuid REFERENCES auth.users(id),
  raised_by_name text,
  raised_at timestamptz NOT NULL DEFAULT now(),
  costing_approved_by uuid REFERENCES auth.users(id),
  costing_approved_at timestamptz,
  costing_notes text,
  director_approved_by uuid REFERENCES auth.users(id),
  director_approved_at timestamptz,
  issued_by uuid REFERENCES auth.users(id),
  issued_at timestamptz,
  pdf_url text,
  notes_to_costing text,
  rejection_reason text,
  clarification_thread jsonb DEFAULT '[]'::jsonb,
  supporting_docs jsonb DEFAULT '[]'::jsonb,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_project ON public.work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON public.work_orders(status);

-- Variations
CREATE TABLE IF NOT EXISTS public.work_order_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  additional_qty numeric DEFAULT 0,
  rate numeric DEFAULT 0,
  additional_value numeric DEFAULT 0,
  status text DEFAULT 'pending_costing_approval',
  raised_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wov_wo ON public.work_order_variations(wo_id);

-- Closure
CREATE TABLE IF NOT EXISTS public.work_order_closure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id uuid NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  actual_qty numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  measurement_photos text[] DEFAULT ARRAY[]::text[],
  signed_off_by uuid REFERENCES auth.users(id),
  signed_off_at timestamptz,
  payment_record_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_closure ENABLE ROW LEVEL SECURITY;

-- Permission helpers
CREATE OR REPLACE FUNCTION public.can_view_work_orders(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                   'finance_manager','accounts_executive','production_head','site_installation_mgr',
                   'planning_engineer','costing_engineer','procurement','head_operations','factory_floor_supervisor','site_engineer')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_raise_work_order(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','production_head','site_installation_mgr')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_costing_approve_wo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','planning_engineer','costing_engineer')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_issue_work_order(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive')
  )
$$;

-- RLS policies
CREATE POLICY "wo_view" ON public.work_orders FOR SELECT TO authenticated USING (public.can_view_work_orders(auth.uid()));
CREATE POLICY "wo_insert" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (public.can_raise_work_order(auth.uid()) AND raised_by = auth.uid());
CREATE POLICY "wo_update" ON public.work_orders FOR UPDATE TO authenticated USING (
  public.can_raise_work_order(auth.uid())
  OR public.can_costing_approve_wo(auth.uid())
  OR public.can_issue_work_order(auth.uid())
  OR public.is_director(auth.uid())
);

CREATE POLICY "wov_view" ON public.work_order_variations FOR SELECT TO authenticated USING (public.can_view_work_orders(auth.uid()));
CREATE POLICY "wov_insert" ON public.work_order_variations FOR INSERT TO authenticated WITH CHECK (public.can_raise_work_order(auth.uid()) AND raised_by = auth.uid());
CREATE POLICY "wov_update" ON public.work_order_variations FOR UPDATE TO authenticated USING (
  public.can_costing_approve_wo(auth.uid()) OR public.is_director(auth.uid())
);

CREATE POLICY "woc_view" ON public.work_order_closure FOR SELECT TO authenticated USING (public.can_view_work_orders(auth.uid()));
CREATE POLICY "woc_insert" ON public.work_order_closure FOR INSERT TO authenticated WITH CHECK (public.can_raise_work_order(auth.uid()));
CREATE POLICY "woc_update" ON public.work_order_closure FOR UPDATE TO authenticated USING (
  public.can_raise_work_order(auth.uid()) OR public.can_issue_work_order(auth.uid())
);

-- updated_at trigger
CREATE TRIGGER trg_work_orders_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WO number generator (called from app via RPC)
CREATE OR REPLACE FUNCTION public.assign_wo_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pcode text;
  ym text;
  seq integer;
BEGIN
  IF NEW.wo_number IS NOT NULL AND NEW.wo_number <> '' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(p.project_code,''), substr(replace(p.id::text,'-',''),1,8))
    INTO pcode FROM public.projects p WHERE p.id = NEW.project_id;
  ym := to_char(now(), 'YY-MM');

  INSERT INTO public.work_order_sequences (project_id, yearmonth, last_seq)
  VALUES (NEW.project_id, ym, 1)
  ON CONFLICT (project_id, yearmonth) DO UPDATE SET last_seq = work_order_sequences.last_seq + 1
  RETURNING last_seq INTO seq;

  NEW.wo_number := 'WO/' || COALESCE(pcode,'PROJ') || '/' || ym || '/' || lpad(seq::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_wo_number
BEFORE INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.assign_wo_number();