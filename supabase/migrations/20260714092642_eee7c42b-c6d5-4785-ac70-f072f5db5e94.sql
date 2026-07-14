CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role THEN
    -- Bypass for edge functions / backend using the service role key.
    -- SECURITY DEFINER makes current_user = function owner, so use session_user
    -- and the JWT claim to detect the service role.
    BEGIN
      jwt_role := current_setting('request.jwt.claim.role', true);
    EXCEPTION WHEN OTHERS THEN
      jwt_role := NULL;
    END;

    IF session_user = 'service_role'
       OR current_user = 'service_role'
       OR jwt_role = 'service_role'
       OR auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_full_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can change a user role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;