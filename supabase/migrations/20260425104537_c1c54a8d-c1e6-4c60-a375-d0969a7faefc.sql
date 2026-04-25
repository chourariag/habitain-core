-- Labour contractors
CREATE TABLE public.labour_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  department TEXT NOT NULL DEFAULT 'factory' CHECK (department IN ('factory','site','both')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.labour_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.labour_contractors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  skill_type TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('factory','site','both')),
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','inactive')),
  date_joined DATE NOT NULL DEFAULT '2025-04-01',
  salary_review_due DATE NOT NULL DEFAULT '2026-04-01',
  on_leave_return_date DATE,
  notes TEXT,
  deactivated_reason TEXT,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.labour_worker_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  monthly_salary NUMERIC NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_id TEXT NOT NULL UNIQUE,
  company_name TEXT,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  work_type TEXT NOT NULL,
  factory_or_site TEXT NOT NULL DEFAULT 'both' CHECK (factory_or_site IN ('factory','site','both')),
  pricing_type TEXT NOT NULL,
  typical_rate NUMERIC,
  rate_unit TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sub ID auto-generator
CREATE SEQUENCE IF NOT EXISTS public.subcontractor_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_sub_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sub_id IS NULL OR NEW.sub_id = '' THEN
    NEW.sub_id := 'SUB' || LPAD(nextval('public.subcontractor_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_sub_id BEFORE INSERT ON public.subcontractors
FOR EACH ROW EXECUTE FUNCTION public.assign_sub_id();

CREATE TRIGGER trg_labour_workers_updated BEFORE UPDATE ON public.labour_workers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subcontractors_updated BEFORE UPDATE ON public.subcontractors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Worker rate history: snapshot on insert and on salary change
CREATE OR REPLACE FUNCTION public.snapshot_worker_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.labour_worker_rate_history (worker_id, monthly_salary, effective_from, changed_by)
    VALUES (NEW.id, NEW.monthly_salary, NEW.date_joined, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.monthly_salary IS DISTINCT FROM OLD.monthly_salary THEN
    UPDATE public.labour_worker_rate_history
       SET effective_to = CURRENT_DATE
     WHERE worker_id = NEW.id AND effective_to IS NULL;
    INSERT INTO public.labour_worker_rate_history (worker_id, monthly_salary, effective_from, changed_by)
    VALUES (NEW.id, NEW.monthly_salary, CURRENT_DATE, auth.uid());
    -- Reset salary review due to +12 months from change
    NEW.salary_review_due := CURRENT_DATE + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_worker_rate_insert AFTER INSERT ON public.labour_workers
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();
CREATE TRIGGER trg_worker_rate_update BEFORE UPDATE ON public.labour_workers
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();

-- RLS
ALTER TABLE public.labour_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_worker_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- Helper: who can manage labour register
CREATE OR REPLACE FUNCTION public.can_access_labour_register(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                   'finance_manager','production_head','site_installation_mgr','hr_executive')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_labour_register(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director',
                   'production_head','site_installation_mgr','finance_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_subcontractors(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                   'finance_manager','accounts_executive','production_head','site_installation_mgr',
                   'procurement','stores_executive','planning_engineer')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_subcontractors(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director',
                   'production_head','site_installation_mgr','procurement')
  )
$$;

-- Policies: labour_contractors
CREATE POLICY "View labour contractors" ON public.labour_contractors FOR SELECT USING (public.can_access_labour_register(auth.uid()));
CREATE POLICY "Manage labour contractors" ON public.labour_contractors FOR ALL USING (public.can_manage_labour_register(auth.uid())) WITH CHECK (public.can_manage_labour_register(auth.uid()));

-- Policies: labour_workers
CREATE POLICY "View labour workers" ON public.labour_workers FOR SELECT USING (public.can_access_labour_register(auth.uid()));
CREATE POLICY "Manage labour workers" ON public.labour_workers FOR ALL USING (public.can_manage_labour_register(auth.uid())) WITH CHECK (public.can_manage_labour_register(auth.uid()));

-- Policies: rate history (view only via labour register access; trigger writes as definer)
CREATE POLICY "View worker rate history" ON public.labour_worker_rate_history FOR SELECT USING (public.can_access_labour_register(auth.uid()));

-- Policies: subcontractors
CREATE POLICY "View subcontractors" ON public.subcontractors FOR SELECT USING (public.can_access_subcontractors(auth.uid()));
CREATE POLICY "Manage subcontractors" ON public.subcontractors FOR ALL USING (public.can_manage_subcontractors(auth.uid())) WITH CHECK (public.can_manage_subcontractors(auth.uid()));

CREATE INDEX idx_labour_workers_contractor ON public.labour_workers(contractor_id);
CREATE INDEX idx_labour_workers_status ON public.labour_workers(status);
CREATE INDEX idx_rate_history_worker ON public.labour_worker_rate_history(worker_id, effective_from);
CREATE INDEX idx_subcontractors_status ON public.subcontractors(status);
CREATE INDEX idx_subcontractors_work_type ON public.subcontractors(work_type);