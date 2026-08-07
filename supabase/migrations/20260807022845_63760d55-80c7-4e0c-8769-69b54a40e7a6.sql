-- 1. Equal-tier unlock group (role-based, no hardcoded person / MD flag)
CREATE OR REPLACE FUNCTION public.can_unlock_locked_document(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND role IN (
        'super_admin','managing_director','chairman',
        'finance_director','sales_director','architecture_director',
        'principal_architect'
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_unlock_locked_document(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_unlock_locked_document(uuid) TO authenticated, service_role;

-- 2. Scope of Work: replace hardcoded MD/super_admin checks with the tier check
CREATE OR REPLACE FUNCTION public.enforce_scope_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_locked BOOLEAN;
  is_unlocker BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_locked := COALESCE(OLD.locked, false);
    is_unlocker := public.can_unlock_locked_document(auth.uid());

    IF old_locked AND NEW.locked = false THEN
      IF NOT is_unlocker THEN
        RAISE EXCEPTION 'Only Managing Director, Chairman, a Director or the Principal Architect can unlock a signed Scope of Work' USING ERRCODE = '42501';
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

    IF old_locked AND NOT is_unlocker THEN
      RAISE EXCEPTION 'This Scope of Work is locked and cannot be edited' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_scope_children_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_locked BOOLEAN;
  target_scope UUID;
BEGIN
  target_scope := COALESCE(NEW.scope_id, OLD.scope_id);
  SELECT locked INTO parent_locked FROM public.project_scope_of_work WHERE id = target_scope;
  IF COALESCE(parent_locked, false) THEN
    IF NOT public.can_unlock_locked_document(auth.uid()) THEN
      RAISE EXCEPTION 'Parent Scope of Work is locked' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP POLICY IF EXISTS "MD/SuperAdmin can log unlock" ON public.scope_unlock_audit;
DROP POLICY IF EXISTS "Admins read unlock audit" ON public.scope_unlock_audit;

CREATE POLICY "Unlock tier can log scope unlock"
ON public.scope_unlock_audit FOR INSERT TO authenticated
WITH CHECK (
  public.can_unlock_locked_document(auth.uid())
  AND unlocked_by = auth.uid()
  AND length(COALESCE(reason, '')) >= 5
);

CREATE POLICY "Unlock tier reads scope unlock audit"
ON public.scope_unlock_audit FOR SELECT TO authenticated
USING (public.can_unlock_locked_document(auth.uid()));

-- 3. 24-hour unlock windows for Sale Agreement + GFC sign-offs
ALTER TABLE public.contracts_register
  ADD COLUMN IF NOT EXISTS unlocked_until timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_by uuid;

ALTER TABLE public.gfc_records
  ADD COLUMN IF NOT EXISTS unlocked_until timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_by uuid;

-- 4. Shared unlock log
CREATE TABLE IF NOT EXISTS public.document_unlock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_table text NOT NULL CHECK (record_table IN ('contracts_register','gfc_records')),
  record_id uuid NOT NULL,
  project_id uuid,
  document_label text,
  unlocked_by uuid NOT NULL,
  unlocked_by_role text,
  unlocked_by_name text,
  reason text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlocked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.document_unlock_audit TO authenticated;
GRANT ALL ON public.document_unlock_audit TO service_role;

ALTER TABLE public.document_unlock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Unlock tier reads document unlock audit"
ON public.document_unlock_audit FOR SELECT TO authenticated
USING (public.can_unlock_locked_document(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_document_unlock_audit_record
  ON public.document_unlock_audit(record_table, record_id, unlocked_at DESC);

-- 5. Unlock RPC — logs the individual, role, timestamp and mandatory reason
CREATE OR REPLACE FUNCTION public.unlock_locked_document(
  p_record_table text,
  p_record_id uuid,
  p_reason text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz := now() + interval '24 hours';
  v_project uuid;
  v_label text;
  v_role text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_unlock_locked_document(v_uid) THEN
    RAISE EXCEPTION 'You are not authorised to unlock this document' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required' USING ERRCODE = '22023';
  END IF;
  IF p_record_table NOT IN ('contracts_register','gfc_records') THEN
    RAISE EXCEPTION 'Unsupported document type' USING ERRCODE = '22023';
  END IF;

  SELECT role::text, display_name INTO v_role, v_name
  FROM public.profiles WHERE auth_user_id = v_uid;

  IF p_record_table = 'contracts_register' THEN
    UPDATE public.contracts_register
      SET unlocked_until = v_until, unlocked_by = v_uid
      WHERE id = p_record_id
      RETURNING project_id, COALESCE(contract_type, 'Contract') INTO v_project, v_label;
  ELSE
    UPDATE public.gfc_records
      SET unlocked_until = v_until, unlocked_by = v_uid
      WHERE id = p_record_id
      RETURNING project_id, COALESCE(gfc_stage, 'GFC') INTO v_project, v_label;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.document_unlock_audit (
    record_table, record_id, project_id, document_label,
    unlocked_by, unlocked_by_role, unlocked_by_name,
    reason, unlocked_until
  ) VALUES (
    p_record_table, p_record_id, v_project, v_label,
    v_uid, v_role, v_name,
    btrim(p_reason), v_until
  );

  RETURN v_until;
END $$;

REVOKE ALL ON FUNCTION public.unlock_locked_document(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.unlock_locked_document(text, uuid, text) TO authenticated;

-- 6. Allow the unlock tier to edit these records while the window is open
DROP POLICY IF EXISTS "Unlock tier can amend unlocked GFC" ON public.gfc_records;
CREATE POLICY "Unlock tier can amend unlocked GFC"
ON public.gfc_records FOR UPDATE TO authenticated
USING (public.can_unlock_locked_document(auth.uid()))
WITH CHECK (public.can_unlock_locked_document(auth.uid()));

DROP POLICY IF EXISTS "Unlock tier can amend unlocked contracts" ON public.contracts_register;
CREATE POLICY "Unlock tier can amend unlocked contracts"
ON public.contracts_register FOR UPDATE TO authenticated
USING (public.can_unlock_locked_document(auth.uid()))
WITH CHECK (public.can_unlock_locked_document(auth.uid()));