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
  seg  text;
  pid  uuid;
  mid  uuid;
BEGIN
  IF _uid IS NULL OR nm = '' THEN
    RETURN false;
  END IF;

  IF public.is_full_admin(_uid) OR public.is_director(_uid) THEN
    RETURN true;
  END IF;

  -- Personal folders: only the owning user
  IF seg1 IN ('avatars', 'expense-receipts') AND seg2 = _uid::text THEN
    RETURN true;
  END IF;

  -- Resolve the owning project from any UUID segment in the path
  FOREACH seg IN ARRAY string_to_array(nm, '/')
  LOOP
    BEGIN
      pid := NULLIF(seg, '')::uuid;
    EXCEPTION WHEN others THEN
      pid := NULL;
    END;

    IF pid IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.projects WHERE id = pid) THEN
        RETURN public.user_can_access_project(_uid, pid);
      END IF;

      SELECT m.project_id INTO mid FROM public.modules m WHERE m.id = pid;
      IF mid IS NOT NULL THEN
        RETURN public.user_can_access_project(_uid, mid);
      END IF;
    END IF;
  END LOOP;

  -- No resolvable project scope: default deny
  RETURN false;
END;
$function$;