
-- Role Permissions matrix (UI visibility control)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  page_key text NOT NULL,
  permission_level text NOT NULL CHECK (permission_level IN ('full','view','hidden','locked')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_code, page_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_code);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perms_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_perms_write_md_only"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_md(auth.uid()))
  WITH CHECK (public.is_md(auth.uid()));

CREATE TABLE IF NOT EXISTS public.role_permissions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  page_key text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_perms_audit_time ON public.role_permissions_audit(changed_at DESC);

ALTER TABLE public.role_permissions_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perms_audit_select_md"
  ON public.role_permissions_audit FOR SELECT TO authenticated
  USING (public.is_md(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_role_permission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_permissions_audit(role_code, page_key, old_value, new_value, changed_by)
    VALUES (NEW.role_code, NEW.page_key, NULL, NEW.permission_level, NEW.updated_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.permission_level IS DISTINCT FROM OLD.permission_level THEN
    INSERT INTO public.role_permissions_audit(role_code, page_key, old_value, new_value, changed_by)
    VALUES (NEW.role_code, NEW.page_key, OLD.permission_level, NEW.permission_level, NEW.updated_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_permissions_audit(role_code, page_key, old_value, new_value, changed_by)
    VALUES (OLD.role_code, OLD.page_key, OLD.permission_level, NULL, auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_role_permissions_audit ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.log_role_permission_change();
