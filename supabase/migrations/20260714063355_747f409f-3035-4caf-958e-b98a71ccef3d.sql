CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allow service_role (edge functions using service key) to bypass
    IF current_setting('request.jwt.claim.role', true) = 'service_role'
       OR current_user = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NULL OR NOT public.is_full_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can change a user role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;