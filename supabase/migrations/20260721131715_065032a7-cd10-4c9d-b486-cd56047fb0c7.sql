-- 1. Compensation table
CREATE TABLE public.labour_worker_compensation (
  worker_id uuid PRIMARY KEY REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL DEFAULT 0,
  salary_review_due date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_worker_compensation TO authenticated;
GRANT ALL ON public.labour_worker_compensation TO service_role;

ALTER TABLE public.labour_worker_compensation ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_labour_compensation(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','hr_executive')
  )
$$;

CREATE POLICY "Finance/HR view compensation"
ON public.labour_worker_compensation FOR SELECT
USING (public.can_access_labour_compensation(auth.uid()));

CREATE POLICY "Finance/HR manage compensation"
ON public.labour_worker_compensation FOR ALL
USING (public.can_access_labour_compensation(auth.uid()))
WITH CHECK (public.can_access_labour_compensation(auth.uid()));

CREATE TRIGGER trg_labour_comp_updated
BEFORE UPDATE ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Backfill from existing labour_workers
INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, salary_review_due)
SELECT id, COALESCE(monthly_salary, 0), salary_review_due
FROM public.labour_workers
ON CONFLICT (worker_id) DO NOTHING;

-- 3. Move snapshot trigger to the compensation table
DROP TRIGGER IF EXISTS trg_worker_rate_insert ON public.labour_workers;
DROP TRIGGER IF EXISTS trg_worker_rate_update ON public.labour_workers;

CREATE OR REPLACE FUNCTION public.snapshot_worker_rate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.labour_worker_rate_history (worker_id, monthly_salary, effective_from, changed_by)
    VALUES (
      NEW.worker_id,
      NEW.monthly_salary,
      COALESCE((SELECT date_joined FROM public.labour_workers WHERE id = NEW.worker_id), CURRENT_DATE),
      auth.uid()
    );
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

CREATE TRIGGER trg_worker_rate_insert
AFTER INSERT ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();

CREATE TRIGGER trg_worker_rate_update
BEFORE UPDATE ON public.labour_worker_compensation
FOR EACH ROW EXECUTE FUNCTION public.snapshot_worker_rate();

-- 4. Drop salary columns from labour_workers
ALTER TABLE public.labour_workers
  DROP COLUMN IF EXISTS monthly_salary,
  DROP COLUMN IF EXISTS salary_review_due;

-- 5. Revoke PII column access from broad directory readers
REVOKE SELECT (phone, email, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM authenticated;
REVOKE SELECT (phone, email, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM anon;