
-- 1) Helper: who can see individual salary data
CREATE OR REPLACE FUNCTION public.can_access_labour_salary(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','hr_executive')
  )
$$;

-- 2) Revoke column-level SELECT on monthly_salary from broad roles.
REVOKE SELECT (monthly_salary) ON public.labour_workers FROM anon, authenticated;
REVOKE SELECT (monthly_salary) ON public.labour_worker_rate_history FROM anon, authenticated;

-- 3) Tighten the rate-history row policy to finance/HR only.
DROP POLICY IF EXISTS "View worker rate history" ON public.labour_worker_rate_history;
CREATE POLICY "View worker rate history (finance/HR)"
  ON public.labour_worker_rate_history
  FOR SELECT
  USING (public.can_access_labour_salary(auth.uid()));

-- 4) RPCs for authorized access to salary-bearing data
CREATE OR REPLACE FUNCTION public.get_labour_workers_full()
RETURNS SETOF public.labour_workers
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_labour_salary(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.labour_workers ORDER BY name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_labour_worker_rate_history(_worker_id uuid)
RETURNS SETOF public.labour_worker_rate_history
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_labour_salary(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.labour_worker_rate_history
    WHERE worker_id = _worker_id
    ORDER BY effective_from DESC;
END;
$$;

-- 5) Aggregated daily rates per skill — no individual salary leak.
-- Available to any authenticated user for labour cost planning.
CREATE OR REPLACE FUNCTION public.get_labour_avg_daily_rate_by_skill()
RETURNS TABLE (skill_type text, avg_daily_rate numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT skill_type, ROUND(AVG(monthly_salary) / 26.0, 2) AS avg_daily_rate
  FROM public.labour_workers
  WHERE status = 'active' AND monthly_salary > 0
  GROUP BY skill_type
$$;

GRANT EXECUTE ON FUNCTION public.can_access_labour_salary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_labour_workers_full() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_labour_worker_rate_history(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_labour_avg_daily_rate_by_skill() TO authenticated, service_role;

-- 6) Re-affirm profiles PII column revocations (children, DOB, anniversary, phone, email, home_base).
REVOKE SELECT (children, date_of_birth, wedding_anniversary, phone, email, home_base)
  ON public.profiles FROM anon, authenticated;
