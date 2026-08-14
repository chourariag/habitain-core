CREATE OR REPLACE FUNCTION public.can_upload_stage_files(_uid uuid, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _object_name LIKE 'design-stages/%'
    AND (
      public.user_has_any_role(_uid, ARRAY[
        'super_admin','managing_director','chairman','architecture_director',
        'principal_architect','project_architect','structural_architect',
        'operations_architect','senior_architect','planning_head','planning_engineer',
        'head_operations','head_of_projects','director','costing_engineer'
      ]::app_role[])
      OR EXISTS (
        SELECT 1
        FROM public.project_design_stages s
        JOIN public.profiles p ON p.id = s.owner_id
        WHERE s.id::text = split_part(_object_name, '/', 3)
          AND p.auth_user_id = _uid
      )
    )
$$;