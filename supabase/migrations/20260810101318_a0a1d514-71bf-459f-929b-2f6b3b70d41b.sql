-- 1. Compensation table
CREATE TABLE IF NOT EXISTS public.labour_worker_compensation (
  worker_id uuid PRIMARY KEY REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL DEFAULT 0,
  hourly_rate numeric,
  salary_review_due date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_worker_compensation TO authenticated;
GRANT ALL ON public.labour_worker_compensation TO service_role;
ALTER TABLE public.labour_worker_compensation ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_labour_compensation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','hr_executive')
  )
$$;

CREATE POLICY "Finance/HR view compensation"
ON public.labour_worker_compensation FOR SELECT TO authenticated
USING (public.can_access_labour_compensation(auth.uid()));

CREATE POLICY "Labour managers manage compensation"
ON public.labour_worker_compensation FOR ALL TO authenticated
USING (public.can_manage_labour_register(auth.uid()))
WITH CHECK (public.can_manage_labour_register(auth.uid()));

CREATE TRIGGER trg_labour_comp_updated
BEFORE UPDATE ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Rate history
CREATE TABLE IF NOT EXISTS public.labour_worker_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.labour_worker_rate_history TO authenticated;
GRANT ALL ON public.labour_worker_rate_history TO service_role;
ALTER TABLE public.labour_worker_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/HR view rate history"
ON public.labour_worker_rate_history FOR SELECT TO authenticated
USING (public.can_access_labour_compensation(auth.uid()));

CREATE POLICY "Labour managers write rate history"
ON public.labour_worker_rate_history FOR ALL TO authenticated
USING (public.can_manage_labour_register(auth.uid()))
WITH CHECK (public.can_manage_labour_register(auth.uid()));

-- 3. Snapshot trigger
CREATE OR REPLACE FUNCTION public.snapshot_worker_rate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.labour_worker_rate_history (worker_id, monthly_salary, effective_from, changed_by)
    VALUES (NEW.worker_id, NEW.monthly_salary,
      COALESCE((SELECT date_joined FROM public.labour_workers WHERE id = NEW.worker_id), CURRENT_DATE),
      auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.monthly_salary IS DISTINCT FROM OLD.monthly_salary THEN
    UPDATE public.labour_worker_rate_history
       SET effective_to = CURRENT_DATE
     WHERE worker_id = NEW.worker_id AND effective_to IS NULL;
    INSERT INTO public.labour_worker_rate_history (worker_id, monthly_salary, effective_from, changed_by)
    VALUES (NEW.worker_id, NEW.monthly_salary, CURRENT_DATE, auth.uid());
    NEW.salary_review_due := CURRENT_DATE + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_rate_insert ON public.labour_worker_compensation;
CREATE TRIGGER trg_worker_rate_insert
AFTER INSERT ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();

DROP TRIGGER IF EXISTS trg_worker_rate_update ON public.labour_worker_compensation;
CREATE TRIGGER trg_worker_rate_update
BEFORE UPDATE ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();

-- 4. Atomic create: worker + compensation in one transaction
CREATE OR REPLACE FUNCTION public.create_labour_worker_with_compensation(
  _name text,
  _skill_type text,
  _department text,
  _date_joined date,
  _monthly_salary numeric,
  _contractor_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _hourly_rate numeric DEFAULT NULL,
  _salary_review_due date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.can_manage_labour_register(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to manage the labour register' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.labour_workers (contractor_id, name, skill_type, department, date_joined, notes)
  VALUES (_contractor_id, _name, _skill_type, _department, _date_joined, _notes)
  RETURNING id INTO _id;

  INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, hourly_rate, salary_review_due, created_by)
  VALUES (_id, COALESCE(_monthly_salary, 0), _hourly_rate,
          COALESCE(_salary_review_due, _date_joined + INTERVAL '12 months'), auth.uid());

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_labour_worker_with_compensation(text,text,text,date,numeric,uuid,text,numeric,date) FROM public;
GRANT EXECUTE ON FUNCTION public.create_labour_worker_with_compensation(text,text,text,date,numeric,uuid,text,numeric,date) TO authenticated;

-- 5. Security fix: deactivated users must lose Tally financial access
CREATE OR REPLACE FUNCTION public.is_tally_ingest_viewer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.auth_user_id = ur.user_id
    WHERE ur.user_id = _uid
      AND p.is_active = true
      AND ur.role IN ('super_admin','managing_director','finance_manager')
  )
$$;