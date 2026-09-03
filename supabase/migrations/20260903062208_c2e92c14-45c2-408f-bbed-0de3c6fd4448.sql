CREATE OR REPLACE FUNCTION public.user_is_project_participant(_uid uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _project_id IS NOT NULL
     AND (
          public.is_full_admin(_uid)
       OR public.is_director(_uid)
       OR public.user_has_projects_module_access(_uid)
       OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            JOIN public.profiles p ON p.id = ptm.profile_id
            WHERE ptm.project_id = _project_id
              AND p.auth_user_id = _uid
              AND p.is_active = true
              AND COALESCE(ptm.is_active, true)
          )
     );
$function$;

GRANT EXECUTE ON FUNCTION public.user_is_project_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_project_participant(uuid, uuid) TO service_role;