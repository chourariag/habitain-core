
REVOKE SELECT (client_phone, client_email, client_portal_token) ON public.projects FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_project_client_contact(_project_id uuid)
RETURNS TABLE(client_phone text, client_email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_phone, p.client_email
  FROM public.projects p
  WHERE p.id = _project_id
    AND (
      public.is_director(auth.uid())
      OR public.user_has_any_role(
        auth.uid(),
        ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
              'head_operations','finance_manager','accounts_executive','principal_architect','project_architect',
              'site_installation_mgr','sales_executive','sales_associate','marketing']::app_role[]
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_project_client_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_subcontractors(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','head_operations',
        'production_head','site_installation_mgr','procurement','stores_executive','finance_manager'
      )
  )
$$;
