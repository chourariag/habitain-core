-- 1) Helper: is the caller a member of a project (or an admin/director)?
CREATE OR REPLACE FUNCTION public.user_can_access_project(_uid uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_full_admin(_uid)
      OR public.is_director(_uid)
      OR EXISTS (
        SELECT 1
        FROM public.project_team_members ptm
        JOIN public.profiles p ON p.id = ptm.profile_id
        WHERE ptm.project_id = _project_id
          AND p.auth_user_id = _uid
          AND COALESCE(ptm.is_active, true)
      );
$$;

-- 2) Helper: for storage objects whose first path segment is a project id,
--    require project membership. Other (non project-scoped) paths stay open
--    to authenticated users.
CREATE OR REPLACE FUNCTION public.storage_object_project_allowed(_uid uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seg text := split_part(COALESCE(_object_name, ''), '/', 1);
  pid uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    pid := seg::uuid;
  EXCEPTION WHEN others THEN
    RETURN true; -- not a project-scoped path
  END;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = pid) THEN
    RETURN true;
  END IF;
  RETURN public.user_can_access_project(_uid, pid);
END;
$$;

-- 3) profiles: make the email/PII lockdown explicit and scope the directory
--    policy to authenticated users only.
REVOKE ALL (email) ON public.profiles FROM anon, authenticated;

DROP POLICY IF EXISTS "Directory view of active non-archived profiles" ON public.profiles;
CREATE POLICY "Directory view of active non-archived profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_active = true AND COALESCE(is_archived, false) = false);

COMMENT ON COLUMN public.profiles.email IS
  'PII: column-level SELECT revoked from anon/authenticated. Read only via get_admin_profiles_full()/get_my_profile_email().';

-- 4) floor-plans: project-scoped reads
DROP POLICY IF EXISTS "floor_plans_read_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Floor plans are publicly readable" ON storage.objects;
CREATE POLICY "floor_plans_read_project_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'floor-plans'
    AND (
      public.can_manage_floor_plan(auth.uid())
      OR public.storage_object_project_allowed(auth.uid(), name)
    )
  );

-- 5) safety-photos: role-scoped reads
DROP POLICY IF EXISTS "Authenticated can read safety-photos" ON storage.objects;
DROP POLICY IF EXISTS "Safety photos are publicly readable" ON storage.objects;
CREATE POLICY "safety_photos_read_role_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'safety-photos'
    AND (
      public.is_full_admin(auth.uid())
      OR public.is_director(auth.uid())
      OR public.can_manage_safety(auth.uid())
      OR public.user_has_any_role(auth.uid(), ARRAY[
        'head_of_projects'::app_role,'head_operations'::app_role,
        'site_installation_mgr'::app_role,'site_engineer'::app_role,
        'qc_inspector'::app_role,'production_head'::app_role,
        'hr_admin'::app_role,'hr_executive'::app_role
      ])
    )
  );

-- 6) site-photos: authenticated + project scoped
DROP POLICY IF EXISTS "Anyone can read site photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload site photos" ON storage.objects;
CREATE POLICY "site_photos_read_project_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos' AND public.storage_object_project_allowed(auth.uid(), name));
CREATE POLICY "site_photos_insert_project_scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos' AND public.storage_object_project_allowed(auth.uid(), name));

-- 7) qc-photos: authenticated + project scoped
DROP POLICY IF EXISTS "Anyone can view qc photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload qc photos" ON storage.objects;
CREATE POLICY "qc_photos_read_project_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qc-photos' AND public.storage_object_project_allowed(auth.uid(), name));
CREATE POLICY "qc_photos_insert_project_scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-photos' AND public.storage_object_project_allowed(auth.uid(), name));