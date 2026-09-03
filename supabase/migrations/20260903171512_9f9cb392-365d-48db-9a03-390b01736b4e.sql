CREATE OR REPLACE FUNCTION public.get_project_by_any_portal_token(_token text)
 RETURNS SETOF projects
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pid UUID;
BEGIN
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

  RETURN QUERY
    SELECT * FROM public.projects
    WHERE client_portal_token = _token
      AND client_portal_enabled = true
      AND (client_portal_expires_at IS NULL OR client_portal_expires_at > now())
    LIMIT 1;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_project_by_any_portal_token(text) TO anon, authenticated;