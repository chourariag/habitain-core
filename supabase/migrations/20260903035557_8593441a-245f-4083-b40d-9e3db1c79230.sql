-- 1. Backfill project team membership from existing structured assignment data.

-- a) Project Architect
INSERT INTO public.project_team_members (project_id, profile_id, role, access_level, is_active)
SELECT p.id, p.project_architect_id, 'project_architect', 'edit', true
FROM public.projects p
WHERE p.project_architect_id IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;

-- b) Design stage owners
INSERT INTO public.project_team_members (project_id, profile_id, role, access_level, is_active)
SELECT DISTINCT ds.project_id, ds.owner_id, 'design_stage_owner', 'edit', true
FROM public.project_design_stages ds
WHERE ds.owner_id IS NOT NULL AND ds.project_id IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;

-- c) Holders of roles referenced by project tasks
INSERT INTO public.project_team_members (project_id, profile_id, role, access_level, is_active)
SELECT DISTINCT t.project_id, pr.id, 'task_role_holder', 'edit', true
FROM public.project_tasks t
JOIN public.profiles pr
  ON pr.is_active = true
 AND pr.role::text = t.responsible_role
WHERE t.project_id IS NOT NULL AND t.responsible_role IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;

-- d) Kickoff meeting assignees (column stores an auth user id, map it to the profile)
INSERT INTO public.project_team_members (project_id, profile_id, role, access_level, is_active)
SELECT DISTINCT k.project_id, pr.id, 'kickoff_assignee', 'edit', true
FROM public.kickoff_meetings k
JOIN public.profiles pr
  ON pr.id = k.task_assigned_to_id OR pr.auth_user_id = k.task_assigned_to_id
WHERE k.task_assigned_to_id IS NOT NULL AND k.project_id IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;

-- 2. Scope the participant check to the specific project.
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