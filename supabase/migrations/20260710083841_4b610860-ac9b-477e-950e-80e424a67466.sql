
-- ============================================================
-- SCOPE OF WORK: sign-off columns + status expansion + lock
-- ============================================================
ALTER TABLE public.project_scope_of_work
  ADD COLUMN IF NOT EXISTS client_signed_by TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sales_director_signed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS sales_director_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scope_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- Widen the status set (drop old CHECK if any, then re-add)
DO $$
DECLARE c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.project_scope_of_work'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.project_scope_of_work DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.project_scope_of_work
  ADD CONSTRAINT project_scope_of_work_status_check
  CHECK (status IN ('draft','pending_signoff','signed','finalised'));

-- Trigger: block edits when locked (unless MD/super_admin)
CREATE OR REPLACE FUNCTION public.enforce_scope_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_locked BOOLEAN;
  is_admin BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_locked := COALESCE(OLD.locked, false);
    is_admin := public.has_role(auth.uid(), 'managing_director'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role);

    -- Allow the update that unlocks (locked true -> false) only if admin AND a matching unlock audit row is present in this txn
    IF old_locked AND NEW.locked = false THEN
      IF NOT is_admin THEN
        RAISE EXCEPTION 'Only Managing Director / Super Admin can unlock a signed Scope of Work' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.scope_unlock_audit
        WHERE scope_of_work_id = NEW.id
          AND unlocked_by = auth.uid()
          AND unlocked_at > now() - interval '30 seconds'
      ) THEN
        RAISE EXCEPTION 'Unlock requires an audit reason. Log unlock reason first.' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    -- If currently locked, block any other content change (allow only setting scope_pdf_url, locked change handled above)
    IF old_locked AND NOT is_admin THEN
      RAISE EXCEPTION 'This Scope of Work is locked and cannot be edited' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_scope_lock ON public.project_scope_of_work;
CREATE TRIGGER trg_enforce_scope_lock
  BEFORE UPDATE ON public.project_scope_of_work
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scope_lock();

-- Block edits to scope items / exclusions when parent is locked (non-admins)
CREATE OR REPLACE FUNCTION public.enforce_scope_children_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_locked BOOLEAN;
  is_admin BOOLEAN;
  target_scope UUID;
BEGIN
  target_scope := COALESCE(NEW.scope_id, OLD.scope_id);
  SELECT locked INTO parent_locked FROM public.project_scope_of_work WHERE id = target_scope;
  IF COALESCE(parent_locked, false) THEN
    is_admin := public.has_role(auth.uid(), 'managing_director'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role);
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Parent Scope of Work is locked' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_scope_items_lock ON public.project_scope_items;
CREATE TRIGGER trg_scope_items_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scope_children_lock();

DROP TRIGGER IF EXISTS trg_scope_exclusions_lock ON public.project_scope_exclusions;
CREATE TRIGGER trg_scope_exclusions_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_scope_exclusions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scope_children_lock();

-- ============================================================
-- CONTRACTS REGISTER: Sale Agreement wiring
-- ============================================================
ALTER TABLE public.contracts_register
  ADD COLUMN IF NOT EXISTS scope_of_work_id UUID REFERENCES public.project_scope_of_work(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_file_url TEXT;

-- Extend contract_type check to include Sale Agreement
DO $$
DECLARE c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.contracts_register'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%contract_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.contracts_register DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.contracts_register
  ADD CONSTRAINT contracts_register_contract_type_check
  CHECK (contract_type IN ('Labour','Supply','Labour+Supply','Design','Consultancy','Sale Agreement'));

-- Trigger: Sale Agreement rows require a signed linked scope
CREATE OR REPLACE FUNCTION public.enforce_sale_agreement_requires_signed_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  scope_status TEXT;
BEGIN
  IF NEW.contract_type = 'Sale Agreement' THEN
    IF NEW.scope_of_work_id IS NULL THEN
      RAISE EXCEPTION 'Sale Agreement must be linked to a Scope of Work (scope_of_work_id)' USING ERRCODE = '23514';
    END IF;
    SELECT status INTO scope_status FROM public.project_scope_of_work WHERE id = NEW.scope_of_work_id;
    IF scope_status IS DISTINCT FROM 'signed' THEN
      RAISE EXCEPTION 'Linked Scope of Work must be signed before Sale Agreement can be saved (current status: %)', COALESCE(scope_status, 'missing') USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sale_agreement_requires_signed_scope ON public.contracts_register;
CREATE TRIGGER trg_sale_agreement_requires_signed_scope
  BEFORE INSERT OR UPDATE ON public.contracts_register
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_agreement_requires_signed_scope();

-- ============================================================
-- scope_signoff_tokens (single-use client magic link)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scope_signoff_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  scope_of_work_id UUID NOT NULL REFERENCES public.project_scope_of_work(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  used_at TIMESTAMPTZ,
  client_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scope_signoff_tokens_token ON public.scope_signoff_tokens(token);
CREATE INDEX IF NOT EXISTS idx_scope_signoff_tokens_scope ON public.scope_signoff_tokens(scope_of_work_id);

GRANT SELECT ON public.scope_signoff_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scope_signoff_tokens TO authenticated;
GRANT ALL ON public.scope_signoff_tokens TO service_role;

ALTER TABLE public.scope_signoff_tokens ENABLE ROW LEVEL SECURITY;

-- Anon can read only unused, unexpired tokens (to validate the magic link)
CREATE POLICY "Anon can validate unused tokens"
  ON public.scope_signoff_tokens FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());

-- Anon can mark their own token as used (single-use consume)
CREATE POLICY "Anon can consume own token"
  ON public.scope_signoff_tokens FOR UPDATE TO anon
  USING (used_at IS NULL AND expires_at > now())
  WITH CHECK (used_at IS NOT NULL);

-- Authenticated: sales roles manage tokens for their projects
CREATE POLICY "Sales roles read tokens"
  ON public.scope_signoff_tokens FOR SELECT TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','sales_director','architecture_director','planning_head']::app_role[])
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text LIKE 'sales%')
  );

CREATE POLICY "Sales roles create tokens"
  ON public.scope_signoff_tokens FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','sales_director','architecture_director','planning_head']::app_role[])
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text LIKE 'sales%')
  );

-- ============================================================
-- scope_unlock_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scope_unlock_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_of_work_id UUID NOT NULL REFERENCES public.project_scope_of_work(id) ON DELETE CASCADE,
  unlocked_by UUID NOT NULL REFERENCES auth.users(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scope_unlock_audit_scope ON public.scope_unlock_audit(scope_of_work_id);

GRANT SELECT, INSERT ON public.scope_unlock_audit TO authenticated;
GRANT ALL ON public.scope_unlock_audit TO service_role;

ALTER TABLE public.scope_unlock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read unlock audit"
  ON public.scope_unlock_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'managing_director'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
      OR public.has_role(auth.uid(),'sales_director'::app_role));

CREATE POLICY "MD/SuperAdmin can log unlock"
  ON public.scope_unlock_audit FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'managing_director'::app_role)
            OR public.has_role(auth.uid(),'super_admin'::app_role))
            AND unlocked_by = auth.uid()
            AND length(coalesce(reason,'')) >= 5);
