
-- 1) project_material_plans: restrict INSERT to planning/procurement/operations roles
DROP POLICY IF EXISTS "Authenticated users can insert material plans" ON public.project_material_plans;
CREATE POLICY "Allowed roles can insert material plans"
ON public.project_material_plans
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND is_active = true
      AND role IN ('super_admin','managing_director','head_operations',
                   'planning_head','planning_engineer','costing_engineer',
                   'procurement','stores_executive','production_head')
  )
);

-- 2) project_tender_budget_items: restrict INSERT to finance/planning roles
DROP POLICY IF EXISTS "Authenticated users can create tender budget items" ON public.project_tender_budget_items;
CREATE POLICY "Allowed roles can insert tender budget items"
ON public.project_tender_budget_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director',
                   'finance_manager','accounts_executive','head_operations',
                   'planning_head','planning_engineer','costing_engineer','quantity_surveyor')
  )
);

-- 3) project_task_schedule_uploads: restrict INSERT to planning/operations
DROP POLICY IF EXISTS "Authenticated users can insert schedule uploads" ON public.project_task_schedule_uploads;
CREATE POLICY "Allowed roles can insert schedule uploads"
ON public.project_task_schedule_uploads
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND is_active = true
      AND role IN ('super_admin','managing_director','head_operations',
                   'planning_head','planning_engineer')
  )
);

-- 4) projects.client_portal_token exposure: hide column from authenticated employees,
--    provide SECURITY DEFINER RPCs for the two legitimate access paths.

-- RPC for authenticated team managing the portal (returns token only to project team + directors)
CREATE OR REPLACE FUNCTION public.get_project_client_portal_token(_project_id uuid)
RETURNS TABLE(
  client_portal_token text,
  client_portal_enabled boolean,
  client_portal_expires_at timestamptz,
  client_portal_status_message text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_portal_token, p.client_portal_enabled,
         p.client_portal_expires_at, p.client_portal_status_message
  FROM public.projects p
  WHERE p.id = _project_id
    AND (
      public.is_director(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.project_team_members ptm
        JOIN public.profiles pr ON pr.id = ptm.profile_id
        WHERE ptm.project_id = _project_id AND pr.auth_user_id = auth.uid()
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_project_client_portal_token(uuid) TO authenticated;

-- RPC for anonymous client-portal magic-link access (lookup project by token)
CREATE OR REPLACE FUNCTION public.get_project_by_portal_token(_token text)
RETURNS SETOF public.projects
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.projects
  WHERE client_portal_token = _token
    AND client_portal_enabled = true
    AND (client_portal_expires_at IS NULL OR client_portal_expires_at > now())
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_project_by_portal_token(text) TO anon, authenticated;

-- Revoke column read from authenticated employees (anon retains access for portal lookups via RPC's SECURITY DEFINER).
REVOKE SELECT (client_portal_token) ON public.projects FROM authenticated;
REVOKE SELECT (client_portal_token) ON public.projects FROM anon;
REVOKE SELECT (client_portal_token) ON public.projects FROM PUBLIC;

-- 5) realtime.messages: drop the open broadcast INSERT policy. Postgres Changes subscriptions
--    continue to work via the SELECT policy; broadcast/presence is not used by this app.
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
