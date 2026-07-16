-- Restrict SELECT on labour_workers.monthly_salary to service_role only.
-- Authorized reads must go through the SECURITY DEFINER RPC get_labour_workers_full,
-- which is gated by can_access_labour_salary().
REVOKE SELECT (monthly_salary) ON public.labour_workers FROM anon, authenticated, PUBLIC;
GRANT SELECT (monthly_salary) ON public.labour_workers TO service_role;
-- Preserve HR ability to insert/update salary from the client (RLS still enforces manage role).
GRANT INSERT (monthly_salary), UPDATE (monthly_salary) ON public.labour_workers TO authenticated;