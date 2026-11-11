CREATE OR REPLACE FUNCTION public.set_feature_flag(_key text, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_enabled boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to change module settings';
  END IF;

  SELECT enabled INTO previous_enabled
  FROM public.feature_flags
  WHERE key = _key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Module setting not found';
  END IF;

  IF previous_enabled = _enabled THEN
    RETURN previous_enabled;
  END IF;

  UPDATE public.feature_flags
  SET enabled = _enabled, updated_at = now()
  WHERE key = _key;

  INSERT INTO public.admin_audit_log (action, performed_by, entity_type, old_value, new_value)
  VALUES (
    'feature_flag_changed',
    auth.uid(),
    'feature_flag:' || _key,
    jsonb_build_object('enabled', previous_enabled),
    jsonb_build_object('enabled', _enabled)
  );

  RETURN _enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_feature_flag(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) TO authenticated, service_role;