DROP FUNCTION IF EXISTS public.get_design_stages_by_portal_token(uuid);

CREATE FUNCTION public.get_design_stages_by_portal_token(_token text)
RETURNS TABLE(
  id uuid,
  stage_code text,
  stage_name text,
  stage_order integer,
  stage_group text,
  status text,
  planned_start_date date,
  planned_end_date date,
  actual_date date,
  deliverable_url text,
  deliverable_required boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pid UUID;
BEGIN
  BEGIN
    SELECT project_id INTO pid FROM public.client_portal_tokens
    WHERE token = _token::uuid AND is_active = true
      AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;
  EXCEPTION WHEN OTHERS THEN pid := NULL; END;

  IF pid IS NULL THEN
    SELECT p.id INTO pid FROM public.projects p
    WHERE p.client_portal_token = _token
      AND p.client_portal_enabled = true
      AND (p.client_portal_expires_at IS NULL OR p.client_portal_expires_at > now())
    LIMIT 1;
  END IF;

  IF pid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT pds.id,
         d.stage_code,
         d.stage_name,
         d.stage_order,
         d.stage_group,
         pds.status,
         pds.planned_start_date,
         COALESCE(pds.planned_end_date, pds.planned_date),
         pds.actual_date,
         pds.deliverable_url,
         d.deliverable_required
  FROM public.project_design_stages pds
  JOIN public.design_stage_definitions d ON d.id = pds.stage_definition_id
  WHERE pds.project_id = pid
    AND d.is_combined_child IS NOT TRUE
  ORDER BY d.stage_order;
END
$function$;

REVOKE ALL ON FUNCTION public.get_design_stages_by_portal_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_design_stages_by_portal_token(text) TO anon, authenticated;