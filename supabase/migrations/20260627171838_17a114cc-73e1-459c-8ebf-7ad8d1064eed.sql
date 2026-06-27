
CREATE OR REPLACE FUNCTION public.get_project_by_any_portal_token(_token TEXT)
RETURNS SETOF public.projects
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  -- Try new client_portal_tokens (uuid)
  BEGIN
    SELECT project_id INTO pid
    FROM public.client_portal_tokens
    WHERE token = _token::uuid
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    pid := NULL;
  END;

  IF pid IS NOT NULL THEN
    UPDATE public.client_portal_tokens
       SET last_accessed_at = now()
     WHERE token = _token::uuid;
    RETURN QUERY SELECT * FROM public.projects WHERE id = pid LIMIT 1;
    RETURN;
  END IF;

  -- Fallback: legacy project-level token
  RETURN QUERY
    SELECT * FROM public.projects
    WHERE client_portal_token = _token
      AND client_portal_enabled = true
      AND (client_portal_expires_at IS NULL OR client_portal_expires_at > now())
    LIMIT 1;
END $$;

GRANT EXECUTE ON FUNCTION public.get_project_by_any_portal_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_design_stages_by_portal_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  stage_name TEXT,
  stage_order INT,
  stage_group TEXT,
  status TEXT,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  approval_date DATE,
  revision_comments TEXT,
  deliverable_url TEXT,
  deliverable_required BOOLEAN
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT ds.id, ds.stage_name, ds.stage_order, ds.stage_group, ds.status,
         ds.planned_start_date, ds.planned_end_date, ds.actual_end_date,
         ds.approval_date, ds.revision_comments, ds.deliverable_url, ds.deliverable_required
  FROM public.design_stages ds
  WHERE ds.project_id = pid
  ORDER BY ds.stage_order;
END $$;

GRANT EXECUTE ON FUNCTION public.get_design_stages_by_portal_token(TEXT) TO anon, authenticated;
