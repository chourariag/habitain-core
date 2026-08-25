CREATE OR REPLACE FUNCTION public.user_has_projects_module_access(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = _uid
      AND p.is_active = true
      AND p.role IN (
        'super_admin'::public.app_role,
        'managing_director'::public.app_role,
        'chairman'::public.app_role,
        'sales_director'::public.app_role,
        'architecture_director'::public.app_role,
        'finance_director'::public.app_role,
        'head_of_projects'::public.app_role,
        'planning_head'::public.app_role,
        'head_operations'::public.app_role,
        'production_head'::public.app_role,
        'site_installation_mgr'::public.app_role,
        'planning_engineer'::public.app_role,
        'costing_engineer'::public.app_role,
        'quantity_surveyor'::public.app_role,
        'senior_architect'::public.app_role,
        'project_architect'::public.app_role,
        'structural_architect'::public.app_role,
        'principal_architect'::public.app_role,
        'finance_manager'::public.app_role,
        'sales_executive'::public.app_role,
        'sales_associate'::public.app_role,
        'procurement'::public.app_role,
        'purchase_assistant'::public.app_role,
        'assistant_manager'::public.app_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_project_participant(_uid uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _project_id IS NOT NULL
     AND public.user_has_projects_module_access(_uid);
$$;

CREATE OR REPLACE FUNCTION public.get_project_chat_participants(_project_id uuid)
RETURNS TABLE(auth_user_id uuid, display_name text, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.auth_user_id, p.display_name, p.role
  FROM public.profiles p
  WHERE _project_id IS NOT NULL
    AND public.user_has_projects_module_access(auth.uid())
    AND p.auth_user_id IS NOT NULL
    AND p.is_active = true
    AND public.user_has_projects_module_access(p.auth_user_id)
  ORDER BY p.display_name NULLS LAST, p.role::text;
$$;

REVOKE ALL ON FUNCTION public.user_has_projects_module_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_project_participant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_project_chat_participants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_projects_module_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_project_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_chat_participants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_projects_module_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_project_participant(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_project_chat_participants(uuid) TO service_role;

DROP POLICY IF EXISTS "Project participants can read messages" ON public.project_messages;
CREATE POLICY "Project viewers can read messages"
ON public.project_messages
FOR SELECT
TO authenticated
USING (public.user_is_project_participant(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can insert own messages" ON public.project_messages;
CREATE POLICY "Project viewers can send messages"
ON public.project_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.user_is_project_participant(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Senders can update own messages" ON public.project_messages;
CREATE POLICY "Project viewers can update own messages"
ON public.project_messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  AND public.user_is_project_participant(auth.uid(), project_id)
)
WITH CHECK (
  sender_id = auth.uid()
  AND public.user_is_project_participant(auth.uid(), project_id)
);