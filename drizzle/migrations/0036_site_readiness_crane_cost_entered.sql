CREATE OR REPLACE FUNCTION public.crane_cost_entered(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.can_read_site_readiness(auth.uid(), p_project_id) THEN EXISTS (
    SELECT 1 FROM public.site_readiness_crane_cost c
     WHERE c.project_id = p_project_id AND (c.rate_inr IS NOT NULL OR c.total_cost_inr IS NOT NULL)
  ) ELSE false END
$$;
REVOKE ALL ON FUNCTION public.crane_cost_entered(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crane_cost_entered(uuid) TO authenticated;