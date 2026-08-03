
CREATE OR REPLACE FUNCTION public.is_sales_writer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('sales_executive','sales_associate')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_sales_edit_scope(_user_id uuid, _scope_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_sales_writer(_user_id) AND EXISTS (
    SELECT 1 FROM public.project_scope_of_work s
    WHERE s.id = _scope_id
      AND s.created_by = _user_id::text
      AND COALESCE(s.locked, false) = false
      AND s.client_signed_at IS NULL
      AND s.sales_director_signed_at IS NULL
      AND s.status IN ('draft','pending_signoff')
  );
$$;

REVOKE ALL ON FUNCTION public.is_sales_writer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_sales_edit_scope(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_writer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_sales_edit_scope(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Sales writers can insert own scope"
ON public.project_scope_of_work FOR INSERT TO authenticated
WITH CHECK (
  public.is_sales_writer(auth.uid())
  AND created_by = auth.uid()::text
  AND COALESCE(locked, false) = false
  AND status IN ('draft','pending_signoff')
  AND client_signed_at IS NULL
  AND sales_director_signed_at IS NULL
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND COALESCE(p.is_archived,false) = false)
);

CREATE POLICY "Sales writers can update own draft scope"
ON public.project_scope_of_work FOR UPDATE TO authenticated
USING (public.can_sales_edit_scope(auth.uid(), id))
WITH CHECK (
  created_by = auth.uid()::text
  AND client_signed_at IS NULL
  AND sales_director_signed_at IS NULL
  AND status IN ('draft','pending_signoff')
);

CREATE POLICY "Sales writers can insert own scope items"
ON public.project_scope_items FOR INSERT TO authenticated
WITH CHECK (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Sales writers can update own scope items"
ON public.project_scope_items FOR UPDATE TO authenticated
USING (public.can_sales_edit_scope(auth.uid(), scope_id))
WITH CHECK (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Sales writers can delete own scope items"
ON public.project_scope_items FOR DELETE TO authenticated
USING (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Sales writers can insert own scope exclusions"
ON public.project_scope_exclusions FOR INSERT TO authenticated
WITH CHECK (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Sales writers can update own scope exclusions"
ON public.project_scope_exclusions FOR UPDATE TO authenticated
USING (public.can_sales_edit_scope(auth.uid(), scope_id))
WITH CHECK (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Sales writers can delete own scope exclusions"
ON public.project_scope_exclusions FOR DELETE TO authenticated
USING (public.can_sales_edit_scope(auth.uid(), scope_id));

CREATE POLICY "Scope editors can delete scope items"
ON public.project_scope_items FOR DELETE TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));

CREATE POLICY "Scope editors can delete scope exclusions"
ON public.project_scope_exclusions FOR DELETE TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
