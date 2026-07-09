-- Prevent privilege escalation via profiles self-update.
-- Any change to the role column must be performed by an admin (is_full_admin).

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NULL OR NOT public.is_full_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can change a user role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Also tighten the UPDATE policy with an explicit WITH CHECK
DROP POLICY IF EXISTS "Users can update own or admin update any" ON public.profiles;
CREATE POLICY "Users can update own or admin update any"
ON public.profiles
FOR UPDATE
USING (auth_user_id = auth.uid() OR public.is_full_admin(auth.uid()))
WITH CHECK (auth_user_id = auth.uid() OR public.is_full_admin(auth.uid()));
