DROP POLICY IF EXISTS "Anon can validate unused tokens" ON public.scope_signoff_tokens;
DROP POLICY IF EXISTS "Anon can consume own token" ON public.scope_signoff_tokens;
REVOKE SELECT ON public.scope_signoff_tokens FROM anon;

CREATE OR REPLACE FUNCTION public.get_scope_signoff_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row public.scope_signoff_tokens%ROWTYPE;
  v_scope     public.project_scope_of_work%ROWTYPE;
  v_items     jsonb;
  v_excl      jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_token_row
  FROM public.scope_signoff_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_scope
  FROM public.project_scope_of_work
  WHERE id = v_token_row.scope_of_work_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'section', section,
      'item_name', item_name,
      'responsibility', responsibility,
      'area_sqft', area_sqft,
      'remarks', remarks
    ) ORDER BY sort_order
  ), '[]'::jsonb) INTO v_items
  FROM public.project_scope_items
  WHERE scope_id = v_token_row.scope_of_work_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('exclusion_text', exclusion_text) ORDER BY sort_order
  ), '[]'::jsonb) INTO v_excl
  FROM public.project_scope_exclusions
  WHERE scope_id = v_token_row.scope_of_work_id;

  RETURN jsonb_build_object(
    'token_id', v_token_row.id,
    'scope', to_jsonb(v_scope),
    'items', v_items,
    'exclusions', v_excl
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_scope_signoff_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scope_signoff_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_scope_signoff_token(
  p_token text,
  p_signer_name text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row public.scope_signoff_tokens%ROWTYPE;
  v_now       timestamptz := now();
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN false;
  END IF;
  IF p_signer_name IS NULL OR length(btrim(p_signer_name)) = 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_token_row
  FROM public.scope_signoff_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.project_scope_of_work
  SET client_signed_by = btrim(p_signer_name),
      client_signed_at = v_now
  WHERE id = v_token_row.scope_of_work_id
    AND client_signed_at IS NULL;

  UPDATE public.scope_signoff_tokens
  SET used_at = v_now,
      client_name = btrim(p_signer_name)
  WHERE id = v_token_row.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_scope_signoff_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_scope_signoff_token(text, text) TO anon, authenticated;