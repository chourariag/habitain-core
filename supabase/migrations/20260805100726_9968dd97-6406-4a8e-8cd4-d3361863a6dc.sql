-- 1. Fail-closed storage project scoping
CREATE OR REPLACE FUNCTION public.storage_object_project_allowed(_uid uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nm   text := COALESCE(_object_name, '');
  seg1 text := split_part(COALESCE(_object_name, ''), '/', 1);
  seg2 text := split_part(COALESCE(_object_name, ''), '/', 2);
  pid  uuid;
  mid  uuid;
BEGIN
  IF _uid IS NULL OR nm = '' THEN
    RETURN false;
  END IF;

  IF public.is_full_admin(_uid) OR public.is_director(_uid) THEN
    RETURN true;
  END IF;

  BEGIN
    pid := NULLIF(seg1, '')::uuid;
  EXCEPTION WHEN others THEN
    pid := NULL;
  END;

  IF pid IS NULL THEN
    BEGIN
      pid := NULLIF(seg2, '')::uuid;
    EXCEPTION WHEN others THEN
      pid := NULL;
    END;
  END IF;

  IF pid IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = pid) THEN
      RETURN public.user_can_access_project(_uid, pid);
    END IF;

    SELECT m.project_id INTO mid FROM public.modules m WHERE m.id = pid;
    IF mid IS NOT NULL THEN
      RETURN public.user_can_access_project(_uid, mid);
    END IF;

    -- UUID path segment that maps to no known project/module: deny
    RETURN false;
  END IF;

  -- Personal folders: only the owning user
  IF seg1 IN ('avatars', 'expense-receipts') AND seg2 = _uid::text THEN
    RETURN true;
  END IF;

  -- Known non project-scoped operational folders: active staff only
  IF seg1 IN (
      'reinspection', 'inspections', 'installation', 'sop', 'dry-assembly',
      'safety', 'diary', 'production', 'handover', 'site-receipts',
      'site-feedback', 'dispatch-packs', 'dq-photos', 'punch-list'
     )
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE auth_user_id = _uid AND is_active = true
     )
  THEN
    RETURN true;
  END IF;

  -- Default deny
  RETURN false;
END;
$function$;

-- 2. safety-photos: scope uploads to safety/site roles and require ownership
DROP POLICY IF EXISTS "Authenticated can upload safety photos" ON storage.objects;

CREATE POLICY "safety_photos_insert_role_scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'safety-photos'
  AND owner = auth.uid()
  AND (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.can_manage_safety(auth.uid())
    OR public.user_has_any_role(auth.uid(), ARRAY[
        'head_of_projects'::app_role, 'head_operations'::app_role,
        'site_installation_mgr'::app_role, 'site_engineer'::app_role,
        'qc_inspector'::app_role, 'production_head'::app_role,
        'factory_floor_supervisor'::app_role, 'senior_factory_supervisor'::app_role,
        'factory_supervisor'::app_role, 'hr_admin'::app_role, 'hr_executive'::app_role
      ])
  )
);

-- 3. experience_centre_visits: restrict to sales/marketing/leadership
DROP POLICY IF EXISTS "Authenticated users can create EC visits" ON public.experience_centre_visits;
DROP POLICY IF EXISTS "Authenticated users can view EC visits" ON public.experience_centre_visits;

CREATE POLICY "ec_visits_select_sales_scoped"
ON public.experience_centre_visits
FOR SELECT
TO authenticated
USING (
  public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
  OR hosted_by = auth.uid()
  OR public.user_has_any_role(auth.uid(), ARRAY[
      'sales_director'::app_role, 'sales_executive'::app_role, 'sales_associate'::app_role,
      'marketing'::app_role, 'head_of_projects'::app_role, 'head_operations'::app_role,
      'principal_architect'::app_role, 'chairman'::app_role
    ])
);

CREATE POLICY "ec_visits_insert_sales_scoped"
ON public.experience_centre_visits
FOR INSERT
TO authenticated
WITH CHECK (
  hosted_by = auth.uid()
  AND (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.user_has_any_role(auth.uid(), ARRAY[
        'sales_director'::app_role, 'sales_executive'::app_role, 'sales_associate'::app_role,
        'marketing'::app_role, 'head_of_projects'::app_role, 'head_operations'::app_role,
        'principal_architect'::app_role, 'chairman'::app_role
      ])
  )
);
